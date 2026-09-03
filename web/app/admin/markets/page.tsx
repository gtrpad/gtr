"use client";
import { useCallback, useEffect, useState } from "react";
import { api, EXPLORER, short } from "../_components/api";

type M = { token: string; name: string; symbol: string; word: string; coinSymbol: string; migrated: boolean; hidden: boolean; createdAt: string; creator: string; feeBps: number; trades: number; fdvUsd: number; unpaidCoin: number; paidCoin: number };

export default function MarketsPage() {
  const [rows, setRows] = useState<M[]>([]);
  const load = useCallback(async () => setRows(await api<M[]>("/api/admin/markets")), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <>
      <h1>Маркеты ({rows.length})</h1>
      <section className="adm-card">
        <div className="adm-table-wrap" style={{ maxHeight: 640 }}>
          <table>
            <thead><tr><th>Токен</th><th>Слово</th><th>Статус</th><th>FDV</th><th>Трейдов</th><th>Фи</th><th>Холдерам не выплачено</th><th>Выплачено</th><th>Создатель</th><th>Создан</th><th></th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.token}>
                  <td><a href={`/token/${m.token}`} target="_blank" rel="noreferrer"><b>${m.symbol}</b></a> <span className="muted">{m.name}</span><br /><a className="mono muted" href={`${EXPLORER}/address/${m.token}`} target="_blank" rel="noreferrer">{short(m.token)}</a></td>
                  <td>{m.word} <span className="muted mono">{m.coinSymbol}</span></td>
                  <td><span className={`adm-chip ${m.migrated ? "on" : "dry"}`}>{m.migrated ? "в пуле v4" : "на курве"}</span> {m.hidden && <span className="adm-chip off">скрыт</span>}</td>
                  <td>${m.fdvUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td>{m.trades}</td>
                  <td>{m.feeBps / 100}%</td>
                  <td>{m.unpaidCoin.toFixed(4)} {m.coinSymbol}</td>
                  <td>{m.paidCoin.toFixed(4)} {m.coinSymbol}</td>
                  <td className="mono">{short(m.creator)}</td>
                  <td className="muted">{new Date(m.createdAt).toLocaleString("ru-RU")}</td>
                  <td><button className="adm-btn" onClick={async () => { await api(`/api/admin/markets/${m.token}`, { method: "PATCH", json: { hidden: !m.hidden } }); load(); }}>{m.hidden ? "Показать" : "Скрыть"}</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={11} className="muted">Маркетов ещё нет.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
