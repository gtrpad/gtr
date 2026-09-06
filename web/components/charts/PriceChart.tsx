"use client";
import { useEffect, useState } from "react";
import type { Candle, TradeRow } from "@/lib/types";
import { InterestChart, type ChartPoint } from "./InterestChart";
import { Change } from "@/components/ui/Primitives";
import { Odometer } from "@/components/motion/Odometer";
import { fmtPrice, fmtUsd } from "@/components/util/format";

type TF = "1m" | "5m" | "1h" | "1d";
const TFS: TF[] = ["1m", "5m", "1h", "1d"];

type Props = { token: string; coinSymbol: string; initial: Candle[]; initialTf?: TF; priceCoin: number; priceUsd: number; trades?: TradeRow[] };

function fmtT(t: number, tf: TF) {
  const d = new Date(t * 1000);
  return tf === "1d" ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}

/** Price line on paper. Fetches /api/markets/[token]/candles?tf=… on timeframe change; falls back to trades when a window has fewer than 3 candles. */
export function PriceChart({ token, coinSymbol, initial, initialTf = "5m", priceCoin, priceUsd, trades = [] }: Props) {
  const [tf, setTf] = useState<TF>(initialTf);
  const [usd, setUsd] = useState(false);
  const [data, setData] = useState<Record<string, Candle[]>>({ [initialTf]: initial });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const err = errs[tf] ?? null;
  const loading = !data[tf] && !err;

  useEffect(() => {
    if (data[tf] || errs[tf]) return;
    let alive = true;
    fetch(`/api/markets/${token}/candles?tf=${tf}&limit=300`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Chart data unavailable (${r.status})`);
        const j = (await r.json()) as Candle[] | { candles: Candle[] };
        return Array.isArray(j) ? j : j.candles ?? [];
      })
      .then((c) => alive && setData((d) => ({ ...d, [tf]: c })))
      .catch((e) => alive && setErrs((x) => ({ ...x, [tf]: e.message })));
    return () => {
      alive = false;
    };
  }, [tf, token, data, errs]);

  const candles = data[tf] ?? [];
  const usdPerCoin = priceCoin > 0 ? priceUsd / priceCoin : 0;
  const fromTrades = candles.length < 3 && trades.length > 0;
  const tradePts = fromTrades ? [...trades].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()) : [];
  const raw: { t: number; c: number; cUsd: number; v: number }[] = fromTrades
    ? tradePts.map((t) => ({ t: Math.floor(new Date(t.ts).getTime() / 1000), c: t.priceCoin, cUsd: t.priceCoin * usdPerCoin, v: t.usdValue }))
    : candles.map((c) => ({ t: c.t, c: c.c, cUsd: c.cUsd, v: c.v }));
  const series = raw.map((r) => (usd ? r.cUsd : r.c));
  // y range: min..max with a little headroom, so a flat market draws a centred line
  const sMin = series.length ? Math.min(...series) : 0, sMax = series.length ? Math.max(...series) : 0;
  const pad = sMax - sMin > 0 ? (sMax - sMin) * 0.15 : sMax * 0.01 || 1;
  const lo = Math.max(0, sMin - pad), hi = sMax + pad;
  const yOf = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  const points: ChartPoint[] = raw.map((r, i) => ({
    x: fmtT(r.t, fromTrades ? "5m" : tf),
    y: yOf(series[i]),
    tip: { title: new Date(r.t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC", rows: [[`Price in ${coinSymbol}`, fmtPrice(r.c)], ["Price in USD", `$${fmtPrice(r.cUsd)}`], ["Volume", fmtUsd(r.v)]] },
  }));
  const first = series[0], last = series[series.length - 1];
  const change = first && last ? ((last - first) / first) * 100 : null;
  const label = fromTrades ? `${tradePts.length} trade${tradePts.length === 1 ? "" : "s"}` : `${tf} closes`;

  return (
    <div className="section">
      <div className="section-head" style={{ alignItems: "center" }}>
        <div className="price-line">
          <span className="big num"><Odometer value={usd ? `$${fmtPrice(priceUsd)}` : fmtPrice(priceCoin)} delay={260} />{!usd ? <> <span className="price-unit">{coinSymbol}</span></> : null}</span>
          <span className="muted num">{usd ? `${fmtPrice(priceCoin)} ${coinSymbol}` : `$${fmtPrice(priceUsd)}`}</span>
          {change !== null ? <span className="num" style={{ fontWeight: 500 }}><Change value={change} /></span> : null}
          <span className="cap">{label}</span>
        </div>
        <span className="chips nowrap">
          {TFS.map((t) => (
            <button key={t} type="button" className={`chip ${t === tf ? "on" : ""}`} onClick={() => setTf(t)}>{t}</button>
          ))}
          <button type="button" className={`chip ${usd ? "on" : ""}`} onClick={() => setUsd((u) => !u)} title="Show the price in USD">USD</button>
        </span>
      </div>
      <div className="chart-stage">
        {series.length > 0 ? (
          <InterestChart points={points} w={640} h={220} yMax={100} yLabels={[100, 50, 0]} padL={84} area fmtY={(v) => (usd ? `$${fmtPrice(lo + (v / 100) * (hi - lo))}` : fmtPrice(lo + (v / 100) * (hi - lo)))} />
        ) : (
          loading ? (
            <div style={{ minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, padding: "20px 0 30px 84px" }}><div className="skeleton" style={{ width: "90%", height: 2 }} /><div className="skeleton" style={{ width: "70%", height: 2 }} /><div className="skeleton" style={{ width: "95%", height: 2 }} /></div>
          ) : (
            <div className="empty" style={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>{err ? err : "No trades in this window yet."}</div>
          )
        )}
      </div>
    </div>
  );
}
