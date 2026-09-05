import type { CSSProperties } from "react";

export type Service = "x" | "rhc" | "blockscout" | "uniswap" | "wiki" | "eth" | "usdg" | "telegram" | "web" | "github";

/* 16x16 monochrome brand marks, drawn inline. Dark variants for a light site. */
const MARKS: Record<Service, { label: string; color?: string; svg: React.ReactNode }> = {
  x: {
    label: "X",
    // official X glyph, 2px padding since the glyph has no internal margin
    svg: (
      <svg viewBox="-2.5 -2.5 29 29" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
      </svg>
    ),
  },
  rhc: {
    label: "Robinhood Chain",
    // official Robinhood badge, supplied by the founder
    svg: <img src="/brand/hood-badge.svg" alt="" width={16} height={16} style={{ display: "block", width: 16, height: 16 }} />,
  },
  blockscout: {
    label: "Blockscout",
    // explorer links carry the Robinhood badge
    svg: <img src="/brand/hood-badge.svg" alt="" width={16} height={16} style={{ display: "block", width: 16, height: 16 }} />,
  },
  uniswap: {
    label: "Uniswap",
    // official Uniswap app logo
    svg: <img src="/brand/uniswap.svg" alt="" width={16} height={16} style={{ display: "block", width: 16, height: 16 }} />,
  },
  wiki: {
    label: "Wikipedia",
    color: "#1f1f1f",
    svg: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <text x="8" y="13.2" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="15" fontWeight="700" fill="currentColor">W</text>
      </svg>
    ),
  },
  eth: {
    label: "ETH",
    color: "#3c3c3d",
    svg: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 .8 3.4 8.2 8 10.9l4.6-2.7L8 .8z" fill="currentColor" opacity=".85" />
        <path d="M8 6.1 3.4 8.2 8 10.9l4.6-2.7L8 6.1z" fill="currentColor" opacity=".55" />
        <path d="M8 11.8 3.4 9.1 8 15.4l4.6-6.3L8 11.8z" fill="currentColor" opacity=".7" />
      </svg>
    ),
  },
  usdg: {
    label: "USDG",
    color: "#0b57d0",
    svg: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <text x="8" y="11.2" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="9" fontWeight="700" fill="#fff">$</text>
      </svg>
    ),
  },
  telegram: {
    label: "Telegram",
    color: "#229ed9",
    svg: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M14.7 2.1 1.9 7.1c-.7.3-.7.8-.1 1l3.3 1 1.3 3.9c.2.4.3.6.7.6.3 0 .5-.1.7-.4l1.8-1.8 3.4 2.5c.6.3 1.1.2 1.2-.6L15.9 3c.2-.9-.4-1.3-1.2-.9zM5.6 8.8l6.6-4.2c.3-.2.6-.1.4.1L7 9.9l-.2 2.3-1.2-3.4z" fill="currentColor" />
      </svg>
    ),
  },
  github: {
    label: "GitHub",
    color: "#1d1d1f",
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" fill="currentColor" />
      </svg>
    ),
  },
  web: {
    label: "Website",
    color: "#444746",
    svg: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1.8 8h12.4M8 1.8c-2 2-2 10.4 0 12.4M8 1.8c2 2 2 10.4 0 12.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
};

export function svcLabel(name: Service) {
  return MARKS[name].label;
}

/** A 16x16 icon box, optionally followed by the service label. */
export function ServiceIcon({ name, label = true, text, style }: { name: Service; label?: boolean; text?: string; style?: CSSProperties }) {
  const m = MARKS[name];
  return (
    <span className="svcw" style={style}>
      <span className="svc" style={m.color ? { color: m.color } : undefined} aria-hidden="true">
        {m.svg}
      </span>
      {label ? <span>{text ?? m.label}</span> : null}
    </span>
  );
}
