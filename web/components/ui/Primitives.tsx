import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";
import { pct, hueOf } from "@/components/util/format";

export function Card({ children, className = "", pad24 = false, style }: { children: ReactNode; className?: string; pad24?: boolean; style?: CSSProperties }) {
  return (
    <div className={`card ${pad24 ? "card-pad-24" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardTitle({ children, size, actions, style }: { children: ReactNode; size?: 16; actions?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="card-title" style={{ ...(size ? { fontSize: size, marginBottom: 12 } : {}), ...style }}>
      {children}
      {actions ? <span className="acts">{actions}</span> : null}
    </div>
  );
}

/** Stat strip: 24px/32px number, 12px caption, 1px dividers. */
export function StatStrip({ items, cols = 6 }: { items: { value: ReactNode; label: ReactNode; sub?: ReactNode }[]; cols?: 4 | 6 }) {
  return (
    <div className={`stats ${cols === 6 ? "stats-6" : ""}`}>
      {items.map((it, i) => (
        <div className="stat" key={i}>
          <b className="num">{it.value}</b>
          <span>
            {it.label}
            {it.sub ? <small> · {it.sub}</small> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Chip({ children, on = false, onClick, href, className = "", style, disabled, title }: { children: ReactNode; on?: boolean; onClick?: () => void; href?: string; className?: string; style?: CSSProperties; disabled?: boolean; title?: string }) {
  const cls = `chip ${on ? "on" : ""} ${className}`;
  if (href) {
    const ext = href.startsWith("http");
    return ext ? (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer" style={style} title={title}>
        {children}
      </a>
    ) : (
      <Link className={cls} href={href} style={style} title={title}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} style={style} disabled={disabled} title={title}>
        {children}
      </button>
    );
  }
  return (
    <span className={cls} style={style} title={title}>
      {children}
    </span>
  );
}

const KIND: Record<string, string> = { p: "primary", d: "primary", a: "accent", t: "", o: "", x: "" };
export function Button({ children, kind = "p", size, block, href, onClick, disabled, type = "button", style, className = "" }: { children: ReactNode; kind?: "p" | "d" | "a" | "t" | "o" | "x"; size?: "sm" | "lg"; block?: boolean; href?: string; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; style?: CSSProperties; className?: string }) {
  const cls = `btn ${KIND[kind]} ${size ?? ""} ${block ? "block" : ""} ${className}`;
  if (href) {
    return href.startsWith("http") ? (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer" style={style}>
        {children}
      </a>
    ) : (
      <Link className={cls} href={href} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

export function Tag({ children, kind = "n", href, style }: { children: ReactNode; kind?: "up" | "down" | "n" | "b" | "w"; href?: string; style?: CSSProperties }) {
  if (href)
    return (
      <Link className={`tag tag-${kind}`} href={href} style={style}>
        {children}
      </Link>
    );
  return (
    <span className={`tag tag-${kind}`} style={style}>
      {children}
    </span>
  );
}

/** Signed, colored percentage. */
export function Change({ value, digits = 1 }: { value: number | null | undefined; digits?: number }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="flat">–</span>;
  if (value === 0) return <span className="flat">0.0%</span>;
  const up = value > 0;
  return (
    <span className={up ? "up" : "down"}>
      <i className="arr">{up ? "↑" : "↓"}</i>
      {pct(value, digits)}
    </span>
  );
}

/** Neutral grey circle with the first letter in ink. */
export function WordDot({ symbol, size = 28 }: { symbol: string; size?: number }) {
  return (
    <span className={`av av-${hueOf(symbol) % 4}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {symbol.slice(0, 1)}
    </span>
  );
}

/** Neutral grey circle with the token image, or the first letter in ink. */
export function MemeAvatar({ symbol, image, size = 28 }: { symbol: string; image?: string | null; size?: number }) {
  return (
    <span className={`av ${image ? "" : `av-${hueOf(symbol) % 4}`}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img src={image} alt="" width={size} height={size} /> : symbol.slice(0, 1)}
    </span>
  );
}

export function Meter({ value, d = 0 }: { value: number; d?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="meter">
      <span className="mv">{v}</span>
      <span className="mt">
        <span className="mf" style={{ width: `${v}%`, ["--d" as string]: d }} />
      </span>
    </span>
  );
}

export function Progress({ value, thin, d = 0 }: { value: number; thin?: boolean; d?: number }) {
  return (
    <div className={`prog ${thin ? "thin" : ""}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, ["--d" as string]: d }} />
    </div>
  );
}

export function KV({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <b>{children}</b>
    </div>
  );
}

/** Scrolling list container: max-height + inner overflow. */
export function Scroll({ children, h = 360 }: { children: ReactNode; h?: 240 | 360 | 440 | 520 }) {
  return <div className={`scroll scroll-${h}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function FeeSplit({ maxWidth }: { maxWidth?: number }) {
  return (
    <div className="split" style={maxWidth ? { maxWidth } : undefined}>
      <i style={{ width: "40%", background: "var(--purple)" }} />
      <i style={{ width: "30%", background: "#8ab4f8" }} />
      <i style={{ width: "30%", background: "var(--tp-outline)" }} />
    </div>
  );
}
