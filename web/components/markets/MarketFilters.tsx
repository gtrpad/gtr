"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { WordCard } from "@/lib/types";

type Props = { words: Pick<WordCard, "slug" | "name" | "symbol">[] };

function Sel({ name, value, opts, onSet }: { name: string; value: string; opts: [string, string][]; onSet: (p: Record<string, string>) => void }) {
  return (
    <span className="select-chip">
      <select value={value} onChange={(e) => onSet({ [name]: e.target.value })} aria-label={name}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <svg viewBox="0 0 10 5"><path d="M0 0h10L5 5z" fill="currentColor" /></svg>
    </span>
  );
}

/** Search + three selects writing ?q= &word= &filter= &sort= into the URL. */
export function MarketFilters({ words }: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  };
  useEffect(() => {
    const t = setTimeout(() => {
      if (urlQ !== q) set({ q });
    }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="toolbar">
      <label className="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markets" aria-label="Search markets" />
      </label>
      <span className="grow" />
      <Sel name="word" onSet={set} value={sp.get("word") ?? ""} opts={[["", "All words"], ...words.map((w) => [w.slug, `${w.name} · ${w.symbol}`] as [string, string])]} />
      <Sel name="filter" onSet={set} value={sp.get("filter") ?? "all"} opts={[["all", "Curve and migrated"], ["curve", "On the curve"], ["migrated", "Migrated"]]} />
      <Sel name="sort" onSet={set} value={sp.get("sort") ?? "volume"} opts={[["volume", "By 24h volume"], ["new", "Newest"], ["fdv", "By FDV"]]} />
    </div>
  );
}
