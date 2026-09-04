"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi, formatUnits, maxUint256, parseUnits, type Address, type Hex } from "viem";
import { ADDR } from "../wagmi";
import RouterAbi from "../abi/Router.json";

export type PayCur = "ETH" | "USDG" | "COIN";
const CUR_INDEX: Record<PayCur, number> = { ETH: 0, USDG: 1, COIN: 2 };
const DEC: Record<PayCur, number> = { ETH: 18, USDG: 6, COIN: 18 };

export type TradeState = {
  side: "buy" | "sell";
  setSide: (s: "buy" | "sell") => void;
  cur: PayCur;
  setCur: (c: PayCur) => void;
  amount: string;
  setAmount: (a: string) => void;
  slippageBps: number;
  setSlippageBps: (b: number) => void;
  /** quoted output: tokens for a buy, `cur` units for a sell (formatted) */
  quote: { out: string | null; raw: bigint | null; loading: boolean; error: string | null };
  balances: { eth: string; usdg: string; coin: string; token: string };
  needsApproval: boolean;
  approve: () => Promise<void>;
  submit: () => Promise<void>;
  tx: { hash: Hex | null; status: "idle" | "signing" | "pending" | "success" | "error"; error: string | null };
  connected: boolean;
  route: string;
};

const fmt = (v: bigint, d: number) => {
  const n = Number(formatUnits(v, d));
  return n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toLocaleString("en-US", { maximumFractionDigits: n < 0.01 ? 6 : 4 });
};

export function useTrade(token: Address, coin: Address, migrated: boolean, coinSymbol: string): TradeState {
  const { address } = useAccount();
  const pc = usePublicClient();
  const { data: wc } = useWalletClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [cur, setCur] = useState<PayCur>("ETH");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [quote, setQuote] = useState<TradeState["quote"]>({ out: null, raw: null, loading: false, error: null });
  const [balances, setBalances] = useState({ eth: "0", usdg: "0", coin: "0", token: "0" });
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [tx, setTx] = useState<TradeState["tx"]>({ hash: null, status: "idle", error: null });

  const amountIn = useMemo(() => {
    try {
      if (!amount || Number(amount) <= 0) return 0n;
      return parseUnits(amount, side === "buy" ? DEC[cur] : 18);
    } catch {
      return 0n;
    }
  }, [amount, cur, side]);

  const refreshBalances = useCallback(async () => {
    if (!pc || !address) return;
    const [eth, usdg, c, t] = await Promise.all([
      pc.getBalance({ address }),
      pc.readContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      pc.readContract({ address: coin, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      pc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    ]);
    setBalances({ eth: fmt(eth, 18), usdg: fmt(usdg, 6), coin: fmt(c, 18), token: fmt(t, 18) });
    if (side === "buy" && cur !== "ETH") {
      const a = await pc.readContract({ address: cur === "USDG" ? ADDR.usdg : coin, abi: erc20Abi, functionName: "allowance", args: [address, ADDR.router] });
      setAllowance(a);
    } else {
      setAllowance(maxUint256);
    }
  }, [pc, address, coin, token, side, cur]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // quote via eth_call to Router.quoteBuy / quoteSell (they revert internally and return the amount)
  useEffect(() => {
    let alive = true;
    if (!pc || amountIn === 0n) {
      setQuote({ out: null, raw: null, loading: false, error: null });
      return;
    }
    setQuote((q) => ({ ...q, loading: true, error: null }));
    const run = async () => {
      try {
        const { result } = await pc.simulateContract({
          address: ADDR.router,
          abi: RouterAbi,
          functionName: side === "buy" ? "quoteBuy" : "quoteSell",
          args: [token, CUR_INDEX[cur], amountIn],
          account: address ?? "0x0000000000000000000000000000000000000001",
        });
        const raw = result as bigint;
        if (alive) setQuote({ out: fmt(raw, side === "buy" ? 18 : DEC[cur]), raw, loading: false, error: null });
      } catch (e) {
        if (alive) setQuote({ out: null, raw: null, loading: false, error: shortErr(e) });
      }
    };
    const t = setTimeout(run, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pc, amountIn, side, cur, token, address]);

  const needsApproval = side === "buy" && cur !== "ETH" && amountIn > 0n && allowance < amountIn;

  const approve = useCallback(async () => {
    if (!wc || !pc) return;
    setTx({ hash: null, status: "signing", error: null });
    try {
      const hash = await wc.writeContract({ address: cur === "USDG" ? ADDR.usdg : coin, abi: erc20Abi, functionName: "approve", args: [ADDR.router, maxUint256] });
      setTx({ hash, status: "pending", error: null });
      await pc.waitForTransactionReceipt({ hash });
      setTx({ hash, status: "idle", error: null });
      await refreshBalances();
    } catch (e) {
      setTx({ hash: null, status: "error", error: shortErr(e) });
    }
  }, [wc, pc, cur, coin, refreshBalances]);

  const submit = useCallback(async () => {
    if (!wc || !pc || !address || amountIn === 0n || quote.raw === null) return;
    const minOut = (quote.raw * BigInt(10_000 - slippageBps)) / 10_000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    setTx({ hash: null, status: "signing", error: null });
    try {
      let hash: Hex;
      if (side === "buy") {
        if (cur === "ETH") {
          hash = await wc.writeContract({ address: ADDR.router, abi: RouterAbi, functionName: "buyWithEth", args: [token, minOut, address, deadline], value: amountIn });
        } else if (cur === "USDG") {
          hash = await wc.writeContract({ address: ADDR.router, abi: RouterAbi, functionName: "buyWithUsdg", args: [token, amountIn, minOut, address, deadline] });
        } else {
          hash = await wc.writeContract({ address: ADDR.router, abi: RouterAbi, functionName: "buyWithCoin", args: [token, amountIn, minOut, address, deadline] });
        }
      } else {
        const fn = cur === "ETH" ? "sellForEth" : cur === "USDG" ? "sellForUsdg" : "sellForCoin";
        hash = await wc.writeContract({ address: ADDR.router, abi: RouterAbi, functionName: fn, args: [token, amountIn, minOut, address, deadline] });
      }
      setTx({ hash, status: "pending", error: null });
      const rc = await pc.waitForTransactionReceipt({ hash });
      setTx({ hash, status: rc.status === "success" ? "success" : "error", error: rc.status === "success" ? null : "Transaction reverted" });
      setAmount("");
      await refreshBalances();
    } catch (e) {
      setTx({ hash: null, status: "error", error: shortErr(e) });
    }
  }, [wc, pc, address, amountIn, quote.raw, slippageBps, side, cur, token, refreshBalances]);

  const venue = migrated ? "pool" : "curve";
  const route =
    side === "buy"
      ? cur === "ETH" ? `ETH → USDG → ${coinSymbol} → ${venue}` : cur === "USDG" ? `USDG → ${coinSymbol} → ${venue}` : `${coinSymbol} → ${venue}`
      : cur === "ETH" ? `${venue} → ${coinSymbol} → USDG → ETH` : cur === "USDG" ? `${venue} → ${coinSymbol} → USDG` : `${venue} → ${coinSymbol}`;

  return { side, setSide, cur, setCur, amount, setAmount, slippageBps, setSlippageBps, quote, balances, needsApproval, approve, submit, tx, connected: !!address, route };
}

export function shortErr(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/InsufficientReserve/.test(m)) return "The word coin reserve cannot cover this sale right now. Try a smaller amount.";
  if (/StalePrice/.test(m)) return "The attention feed for this word is stale. Trading resumes after the next update.";
  if (/Slippage/.test(m)) return "Price moved beyond your slippage. Try again.";
  if (/User rejected|denied/i.test(m)) return "Rejected in wallet.";
  return m.length > 160 ? m.slice(0, 160) + "…" : m;
}
