import type { TradeRow } from "@/lib/types";
import { EXPLORER } from "@/components/util/chain";
import { Empty, Tag } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { fmtCompact, fmtUsdFull, short, ago, units } from "@/components/util/format";

export function TradesTable({ trades, coinSymbol, burst }: { trades: TradeRow[]; coinSymbol: string; burst?: string[] }) {
  if (trades.length === 0) return <Empty>No trades yet. The first buy shows up here within a minute.</Empty>;
  return (
    <div className="scroll scroll-360">
      <table className="tbl">
        <colgroup><col style={{ width: "14%" }} /><col style={{ width: "22%" }} /><col style={{ width: "20%" }} /><col style={{ width: "26%" }} /><col style={{ width: "18%" }} /></colgroup>
        <thead><tr><th>Side</th><th className="r">{coinSymbol}</th><th className="r">USDG</th><th>Wallet</th><th className="r">Age</th></tr></thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.txHash + t.ts} className={burst?.includes(t.txHash + t.ts) ? "burst" : undefined}>
              <td><Tag kind={t.isBuy ? "up" : "down"}>{t.isBuy ? "Buy" : "Sell"}</Tag></td>
              <td className="r num">{fmtCompact(units(t.quoteAmount, 18), 2)}</td>
              <td className="r num">{fmtUsdFull(t.usdValue)}</td>
              <td>
                <a className="addr" href={`${EXPLORER}/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer" title="Open transaction in Blockscout">
                  {short(t.trader)}
                  <ServiceIcon name="blockscout" label={false} />
                </a>
              </td>
              <td className="r muted num">{ago(t.ts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
