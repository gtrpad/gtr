"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi, formatUnits, maxUint256, parseUnits, type Address, type Hex } from "viem";
import { ADDR } from "../wagmi";
import VaultAbi from "../abi/PegVault.json";
import { shortErr } from "./useTrade";

/** Buy / sell a word coin against USDG at the feed price through the PegVault. */
export function useWordCoin(wordId: Hex, coin: Address | null) {
  const { address } = useAccount();
  const pc = usePublicClient();
  const { data: wc } = useWalletClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [balances, setBalances] = useState({ usdg: "0", coin: "0" });
  const [maxSellable, setMaxSellable] = useState<string | null>(null);
  const [tx, setTx] = useState<{ hash: Hex | null; status: "idle" | "signing" | "pending" | "success" | "error"; error: string | null }>({ hash: null, status: "idle", error: null });

  const refresh = useCallback(async () => {
    if (!pc || !coin) return;
    try {
      const ms = (await pc.readContract({ address: ADDR.vault, abi: VaultAbi, functionName: "maxSellable", args: [wordId] })) as bigint;
      setMaxSellable(Number(formatUnits(ms, 18)).toLocaleString("en-US", { maximumFractionDigits: 2 }));
    } catch {
      setMaxSellable(null);
    }
    if (!address) return;
    const [u, c] = await Promise.all([
      pc.readContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      pc.readContract({ address: coin, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    ]);
    setBalances({ usdg: Number(formatUnits(u, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 }), coin: Number(formatUnits(c, 18)).toLocaleString("en-US", { maximumFractionDigits: 4 }) });
  }, [pc, coin, wordId, address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    if (!pc || !coin || !amount || Number(amount) <= 0) {
      setQuote(null);
      return;
    }
    (async () => {
      try {
        if (side === "buy") {
          const [out] = (await pc.readContract({ address: ADDR.vault, abi: VaultAbi, functionName: "quoteBuy", args: [wordId, parseUnits(amount, 6)] })) as [bigint, bigint];
          if (alive) setQuote(Number(formatUnits(out, 18)).toLocaleString("en-US", { maximumFractionDigits: 4 }));
        } else {
          const [out] = (await pc.readContract({ address: ADDR.vault, abi: VaultAbi, functionName: "quoteSell", args: [wordId, parseUnits(amount, 18)] })) as [bigint, bigint, bigint];
          if (alive) setQuote(Number(formatUnits(out, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 }));
        }
      } catch {
        if (alive) setQuote(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pc, coin, wordId, amount, side]);

  const submit = useCallback(async () => {
    if (!wc || !pc || !address || !coin || !amount) return;
    setTx({ hash: null, status: "signing", error: null });
    try {
      if (side === "buy") {
        const usdgIn = parseUnits(amount, 6);
        const allowance = await pc.readContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "allowance", args: [address, ADDR.vault] });
        if (allowance < usdgIn) {
          const h = await wc.writeContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "approve", args: [ADDR.vault, maxUint256] });
          await pc.waitForTransactionReceipt({ hash: h });
        }
        const hash = await wc.writeContract({ address: ADDR.vault, abi: VaultAbi, functionName: "buy", args: [wordId, usdgIn, 0n, address] });
        setTx({ hash, status: "pending", error: null });
        await pc.waitForTransactionReceipt({ hash });
        setTx({ hash, status: "success", error: null });
      } else {
        const coinIn = parseUnits(amount, 18);
        const hash = await wc.writeContract({ address: ADDR.vault, abi: VaultAbi, functionName: "sell", args: [wordId, coinIn, 0n, address] });
        setTx({ hash, status: "pending", error: null });
        await pc.waitForTransactionReceipt({ hash });
        setTx({ hash, status: "success", error: null });
      }
      setAmount("");
      await refresh();
    } catch (e) {
      setTx({ hash: null, status: "error", error: shortErr(e) });
    }
  }, [wc, pc, address, coin, amount, side, wordId, refresh]);

  return { side, setSide, amount, setAmount, quote, balances, maxSellable, submit, tx, connected: !!address };
}
