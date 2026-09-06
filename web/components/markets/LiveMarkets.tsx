"use client";
import { useEffect, useRef, useState } from "react";
import type { MarketCard } from "@/lib/types";
import { MarketsTable } from "./MarketsTable";

type Query = { filter?: string; sort?: string; q?: string; word?: string; limit?: number };

/** Markets table that re-fetches /api/markets every 15s; rows that were not there before burst in. */
export function LiveMarkets({ initial, query, h = 520, compact = false, every = 15000, sparks }: { initial: MarketCard[]; query: Query; h?: 240 | 360 | 440 | 520; compact?: boolean; every?: number; sparks?: Record<string, number[]> }) {
  const [rows, setRows] = useState(initial);
  const [burst, setBurst] = useState<string[]>([]);
  const seen = useRef(new Set(initial.map((m) => m.token)));
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))).toString();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/markets?${qs}`, { cache: "no-store" });
        if (!r.ok) return;
        const next = (await r.json()) as MarketCard[];
        if (!alive) return;
        const fresh = next.filter((m) => !seen.current.has(m.token)).map((m) => m.token);
        next.forEach((m) => seen.current.add(m.token));
        setRows(next);
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
  }, [qs, every]);

  return <MarketsTable markets={rows} h={h} compact={compact} burst={burst} sparks={sparks} />;
}
