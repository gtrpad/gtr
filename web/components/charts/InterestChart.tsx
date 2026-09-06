"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type ChartPoint = { x: string; y: number; tip?: { title: string; rows: [string, string][] } };

type Props = { points: ChartPoint[]; w?: number; h?: number; yMax?: number; yLabels?: number[]; fmtY?: (v: number) => string; xLabels?: string[]; color?: string; padL?: number; area?: boolean };

/** Line chart with soft glow, light gridlines, hover rule + tooltip. Pure SVG. */
export function InterestChart({ points, w: preferredWidth = 640, h = 220, yMax = 100, yLabels, fmtY = (v) => String(Math.round(v)), xLabels, color = "var(--purple)", padL = 34, area = false }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const w = Math.max(padL + 40, Math.min(preferredWidth, width ?? preferredWidth));
  const padR = 8, padT = 12, padB = 26;
  const pw = w - padL - padR, ph = h - padT - padB;
  const n = points.length;
  const ys = yLabels ?? [yMax, yMax * 0.5];
  const y = (v: number) => padT + ph - (Math.max(0, Math.min(yMax, v)) / yMax) * ph;
  const pts = useMemo(() => points.map((p, i) => [padL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw), y(p.y)] as const), [points, n, pw, ph, padL, padT, yMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const xl = xLabels ?? (n > 0 ? [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => points[i].x) : []);
  const visibleLabels = w < 420 && xl.length > 2 ? [xl[0], xl[xl.length - 1]] : xl;
  const last = pts[n - 1];
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * w;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((sx - padL) / pw) * (n - 1)))));
  };
  const hp = hover !== null ? pts[hover] : null;
  const tipLeft = hp ? (hp[0] / w) * 100 : 0;
  return (
    <div className="chart-wrap" ref={container}>
      <svg className="ichart" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ width: "100%", color }}>
        {ys.map((v) => (
          <g key={v}>
            <rect x={padL} y={y(v).toFixed(1)} width={pw} height="1" fill="var(--tp-chart-grid)" />
            <text x={padL - 8} y={(y(v) + 3).toFixed(1)} textAnchor="end" className="ay">
              {fmtY(v)}
            </text>
          </g>
        ))}
        <rect x={padL} y={(padT + ph).toFixed(1)} width={pw} height="1" fill="var(--tp-chart-baseline)" />
        {n > 1 && area ? <path className="area" d={`${d} L${last[0].toFixed(1)} ${(padT + ph).toFixed(1)} L${padL} ${(padT + ph).toFixed(1)} Z`} fill="currentColor" opacity=".08" /> : null}
        {n > 1 ? <path className="line" d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {n > 0 && hover === null ? <circle className="end" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="4.5" fill="currentColor" stroke="#fff" strokeWidth="2" /> : null}
        {hp ? (
          <g>
            <rect x={(hp[0] - 0.5).toFixed(1)} y={padT} width="1" height={ph} fill="var(--tp-ink-4)" />
            <circle cx={hp[0].toFixed(1)} cy={hp[1].toFixed(1)} r="4.5" fill="currentColor" stroke="#fff" strokeWidth="2" />
          </g>
        ) : null}
        {visibleLabels.map((t, i) => {
          const x = padL + (visibleLabels.length <= 1 ? 0 : (i / (visibleLabels.length - 1)) * pw);
          return (
            <text key={i} x={x.toFixed(1)} y={h - 6} className="ax" textAnchor={i === 0 ? "start" : i === visibleLabels.length - 1 ? "end" : "middle"}>
              {t}
            </text>
          );
        })}
      </svg>
      {hover !== null && hp ? (
        <div className="tip" style={{ left: `clamp(0px, calc(${tipLeft}% - 130px), max(0px, 100% - 260px))`, top: (hp[1] / h) * 100 + "%", transform: "translateY(-110%)" }}>
          <b>{points[hover].tip?.title ?? points[hover].x}</b>
          {(points[hover].tip?.rows ?? []).map(([k, v]) => (
            <div key={k}>
              {k}: <span style={{ color: "var(--ink)" }}>{v}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
