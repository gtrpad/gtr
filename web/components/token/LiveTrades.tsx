"use client";
import { useEffect, useRef, useState } from "react";
import type { MarketDetail, TradeRow } from "@/lib/types";
import { TradesTable } from "./TradesTable";

/** Trades table that polls /api/markets/[token] every 10s; new trades burst in. */
export function LiveTrades({ token, initial, coinSymbol, every = 10000 }: { token: string; initial: TradeRow[]; coinSymbol: string; every?: number }) {
  const [trades, setTrades] = useState(initial);
  const [burst, setBurst] = useState<string[]>([]);
  const seen = useRef(new Set(initial.map((t) => t.txHash + t.ts)));
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/markets/${token}`, { cache: "no-store" });
        if (!r.ok) return;
        const m = (await r.json()) as MarketDetail;
        if (!alive) return;
        const fresh = m.trades.filter((t) => !seen.current.has(t.txHash + t.ts)).map((t) => t.txHash + t.ts);
        m.trades.forEach((t) => seen.current.add(t.txHash + t.ts));
        setTrades(m.trades);
        if (fresh.length) {
          setBurst(fresh);
          setTimeout(() => alive && setBurst([]), 1500);
        }
      } catch {
        /* keep the last rows */
      }
    };
    const id = setInterval(tick, every);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, every]);
  return <TradesTable trades={trades} coinSymbol={coinSymbol} burst={burst} />;
}
