import type { HolderRow } from "@/lib/types";
import { Address } from "@/components/ui/Address";
import { Empty } from "@/components/ui/Primitives";
import { fmtCompact, units } from "@/components/util/format";

export function HoldersTable({ holders, symbol }: { holders: HolderRow[]; symbol: string }) {
  if (holders.length === 0) return <Empty>No holders indexed yet.</Empty>;
  return (
    <div className="scroll scroll-360">
      <table className="tbl">
        <colgroup><col style={{ width: "8%" }} /><col style={{ width: "40%" }} /><col style={{ width: "22%" }} /><col style={{ width: "30%" }} /></colgroup>
        <thead><tr><th>#</th><th>Wallet</th><th className="r">${symbol}</th><th className="r">Share of supply</th></tr></thead>
        <tbody>
          {holders.map((h, i) => (
            <tr key={h.wallet}>
              <td><span className={`rank r${i + 1}`}>{i + 1}</span></td>
              <td><Address value={h.wallet} /></td>
              <td className="r num">{fmtCompact(units(h.balance, 18))}</td>
              <td className="r">
                <span className="share-bar">
                  <span className="num" style={{ fontSize: 12 }}>{h.pct.toFixed(2)}%</span>
                  <span className="mt"><span className="mf" style={{ width: `${Math.max(2, Math.min(100, h.pct))}%`, ["--d" as string]: i }} /></span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
