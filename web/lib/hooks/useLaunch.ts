"use client";
import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { decodeEventLog, erc20Abi, maxUint256, parseUnits, type Address, type Hex } from "viem";
import { ADDR } from "../wagmi";
import RouterAbi from "../abi/Router.json";
import LaunchpadAbi from "../abi/Launchpad.json";
import { shortErr } from "./useTrade";

export type LaunchInput = {
  name: string;
  symbol: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  image: File | null;
  wordId: Hex; // bytes32
  feeBps: 100 | 200 | 300;
  cur: "ETH" | "USDG";
  amount: string; // first buy, may be "0"
};

export type LaunchState = {
  status: "idle" | "uploading" | "approving" | "signing" | "pending" | "success" | "error";
  error: string | null;
  hash: Hex | null;
  token: Address | null;
};

export function useLaunch() {
  const { address } = useAccount();
  const pc = usePublicClient();
  const { data: wc } = useWalletClient();
  const [state, setState] = useState<LaunchState>({ status: "idle", error: null, hash: null, token: null });

  const launch = useCallback(
    async (input: LaunchInput) => {
      if (!wc || !pc || !address) {
        setState({ status: "error", error: "Connect a wallet first.", hash: null, token: null });
        return;
      }
      try {
        setState({ status: "uploading", error: null, hash: null, token: null });
        const fd = new FormData();
        fd.set("name", input.name);
        fd.set("symbol", input.symbol);
        fd.set("description", input.description ?? "");
        fd.set("website", input.website ?? "");
        fd.set("twitter", input.twitter ?? "");
        fd.set("telegram", input.telegram ?? "");
        fd.set("creator", address);
        if (input.image) fd.set("image", input.image);
        const r = await fetch("/api/launch/meta", { method: "POST", body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Upload failed" }))).error ?? "Upload failed");
        const { uri } = (await r.json()) as { uri: string };

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        let hash: Hex;
        if (input.cur === "ETH") {
          const value = parseUnits(input.amount || "0", 18);
          setState((s) => ({ ...s, status: "signing" }));
          hash = await wc.writeContract({
            address: ADDR.router,
            abi: RouterAbi,
            functionName: "createWithEth",
            args: [input.name, input.symbol, uri, input.wordId, input.feeBps, 0n, deadline],
            value,
          });
        } else {
          const usdgIn = parseUnits(input.amount || "0", 6);
          if (usdgIn > 0n) {
            const allowance = await pc.readContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "allowance", args: [address, ADDR.router] });
            if (allowance < usdgIn) {
              setState((s) => ({ ...s, status: "approving" }));
              const h = await wc.writeContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "approve", args: [ADDR.router, maxUint256] });
              await pc.waitForTransactionReceipt({ hash: h });
            }
          }
          setState((s) => ({ ...s, status: "signing" }));
          hash = await wc.writeContract({
            address: ADDR.router,
            abi: RouterAbi,
            functionName: "createWithUsdg",
            args: [input.name, input.symbol, uri, input.wordId, input.feeBps, usdgIn, 0n, deadline],
          });
        }
        setState({ status: "pending", error: null, hash, token: null });
        const rc = await pc.waitForTransactionReceipt({ hash });
        if (rc.status !== "success") throw new Error("Transaction reverted");
        let token: Address | null = null;
        for (const log of rc.logs) {
          try {
            const ev = decodeEventLog({ abi: LaunchpadAbi, data: log.data, topics: log.topics });
            if (ev.eventName === "MarketCreated") token = (ev.args as unknown as { token: Address }).token;
          } catch {
            /* not ours */
          }
        }
        setState({ status: "success", error: null, hash, token });
      } catch (e) {
        setState({ status: "error", error: shortErr(e), hash: null, token: null });
      }
    },
    [wc, pc, address],
  );

  return { state, launch, connected: !!address };
}
