import Link from "next/link";
import type { WordCard } from "@/lib/types";
import { WordDot, Change, Empty, Meter } from "@/components/ui/Primitives";
import { Sparkline } from "@/components/charts/Sparkline";
import { IconLinks } from "@/components/ui/IconLinks";
import { fmtPrice, fmtNum } from "@/components/util/format";

/** Plain rows: name, ticker, price, 24h, sparkline, Buy. */
export function WordsTable({ words, h = 520, compact = false }: { words: WordCard[]; h?: 240 | 360 | 440 | 520; compact?: boolean }) {
  if (words.length === 0) return <Empty>No words in the catalogue yet.</Empty>;
  return (
    <div className={`scroll scroll-${h}`}>
      <table className={`tbl words-table ${compact ? "compact" : ""}`}>
        <colgroup>
          <col style={{ width: compact ? "26%" : "23%" }} />
          <col style={{ width: compact ? "15%" : "14%" }} />
          <col style={{ width: compact ? "12%" : "10%" }} />
          {!compact ? <col style={{ width: "14%" }} /> : null}
          <col style={{ width: compact ? "10%" : "8%" }} />
          <col style={{ width: compact ? "37%" : "31%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Word</th>
            <th className="r">Price</th>
            <th className="r">24h</th>
            {!compact ? <th>Interest</th> : null}
            <th className="r">Markets</th>
            <th className="r">30 days</th>
          </tr>
        </thead>
        <tbody>
          {words.map((w, i) => {
            const dir = w.change24h === null ? "flat" : w.change24h > 0 ? "up" : w.change24h < 0 ? "down" : "flat";
            const peak = Math.max(...w.spark, 0);
            const interest = peak > 0 ? (w.price / peak) * 100 : 0;
            return (
              <tr key={w.id}>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, maxWidth: "100%" }}>
                  <Link className="cell plain" href={`/words/${w.slug}`} style={{ minWidth: 0 }}>
                    <WordDot symbol={w.symbol} />
                    <div style={{ minWidth: 0 }}>
                      <span className="p2">{w.name} <span className="muted" style={{ fontWeight: 400 }}>{w.symbol}</span></span>
                      <span className="c">Word coin{!w.coin ? " · not deployed" : ""}</span>
                    </div>
                  </Link>
                  <IconLinks wiki={w.wikiTitle} coin={w.coin} gap={6} />
                  </span>
                </td>
                <td className="r">
                  <span className="p2 num">{w.price > 0 ? `$${fmtPrice(w.price)}` : "–"}</span>
                  <span className="c num">{w.views !== null ? `${fmtNum(w.views)} views` : "no feed yet"}</span>
                </td>
                <td className="r num"><Change value={w.change24h} /></td>
                {!compact ? <td><Meter value={interest} d={i} /></td> : null}
                <td className="r num muted">{w.marketsCount}</td>
                <td className="r">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                    <span className="opt"><Sparkline values={w.spark} dir={dir} w={72} h={24} stagger={i} /></span>
                    {!compact && w.coin ? <Link className="btn sm reveal" href="/launch" title={`Launch with ${w.symbol}`}>Launch</Link> : null}
                    <Link className="btn sm" href={`/words/${w.slug}`}>{w.coin ? "Buy" : "View"}</Link>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
