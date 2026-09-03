"use client";
import { useCallback, useEffect, useState } from "react";
import { api, EXPLORER, short } from "../_components/api";

type J = { id: number; ts: string; kind: string; level: string; message: string; txHash: string | null };
type Preview = { token: string; symbol: string; coin: string; unpaid: string; payable: string; wordPrice: number; skipped: number; rows: { wallet: string; amount: string; usd: number }[] };

const OPS: [string, string, string][] = [
  ["index", "Шаг индексера", "Прочитать следующий блок-диапазон логов."],
  ["fees", "Собрать фисы и свипнуть", "collectPoolFees по мигрировавшим и sweep по всем маркетам выше порога."],
  ["treasury", "Конверсия трежери", "Доли байбека и протокола: коин → USDG по фиду (в пределах резерва), USDG байбека → ETH."],
  ["buyback", "Байбек", "Выкуп и бёрн биржевого токена на ETH с контракта Buyback."],
];

export default function OpsPage() {
  const [rows, setRows] = useState<J[]>([]);
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [execute, setExecute] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const [j, s] = await Promise.all([api<J[]>(`/api/admin/journal?limit=200${kind ? `&kind=${kind}` : ""}`), api<Record<string, string>>("/api/admin/settings")]);
    setRows(j);
    setExecute(s.execute === "true");
  }, [kind]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = (await fn()) as Record<string, unknown>;
      setMsg({ text: r?.logs !== undefined ? `${ok}: блоки ${r.from}–${r.to}, логов ${r.logs}` : ok });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1>Ручные операции и журнал</h1>
      {execute !== null && <div className={`adm-msg ${execute ? "" : "err"}`}>{execute ? "EXECUTE включён: кипер шлёт боевые транзакции." : "EXECUTE выключен: автоматические выплаты, конверсии и байбек только в DRY. Ручная выплата ниже идёт боем после подтверждения."}</div>}
      {msg && <div className={`adm-msg ${msg.err ? "err" : ""}`}>{msg.text}</div>}
      <section className="adm-card">
        <h2>Операции кипера</h2>
        <div className="adm-grid">
          {OPS.map(([k, t, hint]) => (
            <div key={k} className="adm-toggle" style={{ borderBottom: 0 }}>
              <div><b>{t}</b><small>{hint}</small></div>
              <button className="adm-btn" disabled={!!busy} onClick={() => run(k, () => api(`/api/admin/ops/${k}`, { method: "POST" }), "Готово")}>Запустить</button>
            </div>
          ))}
        </div>
      </section>
      <section className="adm-card">
        <div className="adm-row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Выплаты холдерам</h2>
          <button className="adm-btn" disabled={!!busy} onClick={() => run("prev", async () => setPreview(await api<Preview[]>("/api/admin/ops/payout/preview", { method: "POST", json: {} })), "Превью построено")}>Построить превью</button>
        </div>
        {preview && !preview.length && <div className="muted" style={{ marginTop: 8 }}>Ни один маркет не прошёл пороги (пул ≥ мин. USD, есть холдеры ≥ мин. холдинга).</div>}
        {preview?.map((p) => (
          <div key={p.token} style={{ marginTop: 14 }}>
            <div className="adm-row" style={{ justifyContent: "space-between" }}>
              <div><b>{p.symbol}</b> · к выплате {(Number(p.payable) / 1e18).toFixed(4)} коина (≈ ${((Number(p.payable) / 1e18) * p.wordPrice).toFixed(2)}) · {p.rows.length} кошельков, пропущено по пылинке {p.skipped}</div>
              <button className="adm-btn primary" disabled={!!busy} onClick={() => { if (confirm(`Выплатить ${p.symbol}: ${p.rows.length} кошельков боем?`)) run(p.token, () => api("/api/admin/ops/payout/run", { method: "POST", json: { token: p.token } }), "Выплата отправлена"); }}>Выплатить</button>
            </div>
            <div className="adm-table-wrap" style={{ maxHeight: 220, marginTop: 8 }}>
              <table>
                <thead><tr><th>Кошелёк</th><th>Коин</th><th>USD</th></tr></thead>
                <tbody>{p.rows.map((r) => <tr key={r.wallet}><td className="mono">{r.wallet}</td><td>{(Number(r.amount) / 1e18).toFixed(6)}</td><td>${r.usd.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
      <section className="adm-card">
        <div className="adm-row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Журнал</h2>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">все</option>
            {["oracle", "fees", "payout", "treasury", "buyback", "admin", "indexer"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="adm-journal" style={{ marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.id}>
              <time>{new Date(r.ts).toLocaleString("ru-RU")}</time>
              <span className="k">{r.kind}</span>
              <span className={r.level === "error" ? "bad" : r.level === "warn" ? "warn" : r.level === "dry" ? "muted" : ""}>{r.message}</span>
              {r.txHash && <a href={`${EXPLORER}/tx/${r.txHash}`} target="_blank" rel="noreferrer">{short(r.txHash)}</a>}
            </div>
          ))}
          {!rows.length && <div className="muted">Пусто</div>}
        </div>
      </section>
    </>
  );
}
