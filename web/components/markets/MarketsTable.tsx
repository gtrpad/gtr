import Link from "next/link";
import type { MarketCard } from "@/lib/types";
import { MemeAvatar, Empty, Tag, Progress } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { fmtUsd, fmtCompact, ago, short } from "@/components/util/format";
import { Sparkline } from "@/components/charts/Sparkline";
import { IconLinks } from "@/components/ui/IconLinks";

/** Plain table on paper: thin lines, inner scroll. */
export function MarketsTable({ markets, h = 520, compact = false, burst, sparks }: { markets: MarketCard[]; h?: 240 | 360 | 440 | 520; compact?: boolean; burst?: string[]; sparks?: Record<string, number[]> }) {
  const hasSparks = !!sparks && markets.some((m) => (sparks[m.token]?.length ?? 0) > 1);
  if (markets.length === 0)
    return (
      <Empty>
        No markets yet. <Link href="/launch">Launch the first one.</Link>
      </Empty>
    );
  return (
    <div className={`scroll scroll-${h}`}>
      <table className={`tbl markets-table ${compact ? "compact" : ""}`}>
        <colgroup>
          <col style={{ width: compact ? "36%" : hasSparks ? "22%" : "32%" }} />
          {!compact ? <col style={{ width: "18%" }} /> : null}
          <col style={{ width: compact ? "16%" : "14%" }} />
          <col style={{ width: compact ? "24%" : "16%" }} />
          {hasSparks ? <col style={{ width: "10%" }} /> : null}
          <col style={{ width: compact ? "24%" : "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Market</th>
            {!compact ? <th>Word</th> : null}
            <th className="r">FDV</th>
            <th>Status</th>
            {hasSparks ? <th className="r">24h</th> : null}
            <th className="r">24h volume</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m, i) => (
            <tr key={m.token} className={burst?.includes(m.token) ? "burst" : undefined}>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, maxWidth: "100%" }}>
                  <Link className="cell plain" href={`/token/${m.token}`} style={{ minWidth: 0 }}>
                    <MemeAvatar symbol={m.symbol} image={m.imageUrl} />
                    <div style={{ minWidth: 0 }}>
                      <span className="p2">{m.name} <span className="muted" style={{ fontWeight: 400 }}>${m.symbol}</span></span>
                      <span className="c">{m.feeBps / 100}% fee · {ago(m.createdAt)} · <span className="mono">{short(m.creator)}</span></span>
                    </div>
                  </Link>
                  <IconLinks token={m.token} gap={6} />
                </span>
              </td>
              {!compact ? (
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Tag kind="b" href={`/words/${m.word.slug}`}>{m.word.name} · {m.word.symbol}</Tag>
                    <IconLinks wiki={m.word.wikiTitle} coin={m.word.coin} gap={6} />
                  </span>
                </td>
              ) : null}
              <td className="r">
                <span className="p2 num">{fmtUsd(m.fdvUsd)}</span>
                <span className="c num">{m.word.price > 0 ? `${fmtCompact(m.fdvUsd / m.word.price)} ${m.word.symbol}` : "no feed price"}</span>
              </td>
              <td>
                {m.migrated ? (
                  <Tag kind="b"><ServiceIcon name="uniswap" label={false} /> Migrated</Tag>
                ) : (
                  <span style={{ display: "inline-flex", flexDirection: "column", gap: 5 }}>
                    <span className="cap num">{Math.round(m.progress * 100)}% to migration</span>
                    <span style={{ width: 100 }}><Progress value={m.progress * 100} d={i} /></span>
                  </span>
                )}
              </td>
              {hasSparks ? (
                <td className="r">{(sparks?.[m.token]?.length ?? 0) > 1 ? <span style={{ display: "inline-block" }}><Sparkline values={sparks![m.token]} w={72} h={24} stagger={i} /></span> : <span className="cap">–</span>}</td>
              ) : null}
              <td className="r">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span>
                    <span className="p2 num">{fmtUsd(m.volume24hUsd)}</span>
                    <span className="c num">{m.feeBps / 100}% fee</span>
                  </span>
                  <Link className="btn sm reveal" href={`/token/${m.token}`}>Trade</Link>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
