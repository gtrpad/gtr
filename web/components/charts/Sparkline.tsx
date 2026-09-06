import { useId } from "react";

/** 124x36 sparkline, 2px line, gradient fill 0.6 to 0.1, colored by direction. */
export function Sparkline({ values, dir, w = 124, h = 36, stagger = 0 }: { values: number[]; dir?: "up" | "down" | "flat"; w?: number; h?: number; stagger?: number }) {
  const id = useId().replace(/:/g, "");
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length === 0) return <svg className="spark" width={w} height={h} aria-hidden="true" />;
  const d = dir ?? (v.length > 1 ? (v[v.length - 1] > v[0] ? "up" : v[v.length - 1] < v[0] ? "down" : "flat") : "flat");
  const col = d === "up" ? "var(--tp-spark-up)" : d === "down" ? "var(--tp-spark-down)" : "var(--tp-spark-flat)";
  const fill = d === "up" ? "rgba(196,238,208,1)" : d === "down" ? "rgba(250,210,207,1)" : "rgba(228,229,228,1)";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const n = v.length;
  const pts = v.map((x, i) => [n === 1 ? w / 2 : (i / (n - 1)) * (w - 4) + 2, h - 3 - ((x - min) / (max - min || 1)) * (h - 8)] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${pts[0][0].toFixed(1)},${h} ${line} ${pts[n - 1][0].toFixed(1)},${h}`;
  const last = pts[n - 1];
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ ["--d" as string]: stagger }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fill} stopOpacity=".6" />
          <stop offset="1" stopColor={fill} stopOpacity=".1" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} pathLength={1} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3" fill={col} />
    </svg>
  );
}
