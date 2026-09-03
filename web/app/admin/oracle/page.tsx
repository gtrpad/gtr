"use client";
import { useCallback, useEffect, useState } from "react";
import { api, EXPLORER } from "../_components/api";

type W = { id: string; name: string; symbol: string; wikiTitle: string; coin: string | null; enabled: boolean; lastViews: number | null; lastPrice: number | null; lastPushedAt: string | null };
type S = Record<string, string>;

export default function OraclePage() {
  const [words, setWords] = useState<W[]>([]);
  const [s, setS] = useState<S>({});
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [w, st] = await Promise.all([api<W[]>("/api/admin/words"), api<S>("/api/admin/settings")]);
    setWords(w);
    setS(st);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = (await fn()) as { tx?: string | null; observed?: number };
      setMsg({ text: r?.tx ? `${ok}: ${r.tx}` : r?.observed !== undefined ? `${ok}: ${r.observed} слов` : ok });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(null);
    }
  };
  const save = (patch: S) => run("save", () => api("/api/admin/settings", { method: "POST", json: patch }), "Сохранено");
  const staleH = 36;
  const fresh = (d: string | null) => d && Date.now() - new Date(d).getTime() < staleH * 3600e3;

  return (
    <>
      <h1>Оракул внимания</h1>
      {msg && <div className={`adm-msg ${msg.err ? "err" : ""}`}>{msg.text}</div>}
      <section className="adm-card">
        <h2>Параметры</h2>
        <div className="adm-grid">
          <label>Источник
            <select value={s.oracle_source ?? "wikipedia"} onChange={(e) => save({ oracle_source: e.target.value })}>
              <option value="wikipedia">Wikipedia pageviews (бесплатно, раз в сутки)</option>
              <option value="serpapi">Google Trends через SerpApi (адаптер не написан)</option>
            </select>
          </label>
          <label>Час пуша (UTC)<input type="number" min={0} max={23} defaultValue={s.oracle_push_hour_utc} onBlur={(e) => save({ oracle_push_hour_utc: e.target.value })} /></label>
          <label>Просмотров на 1 доллар<input type="number" defaultValue={s.word_views_per_usd} onBlur={(e) => save({ word_views_per_usd: e.target.value })} /></label>
          <label>Пол цены, USD<input type="number" step="0.0001" defaultValue={s.word_price_floor} onBlur={(e) => save({ word_price_floor: e.target.value })} /></label>
          <label>Пуш оракула
            <select value={s.oracle_enabled ?? "true"} onChange={(e) => save({ oracle_enabled: e.target.value })}><option value="true">включён</option><option value="false">выключен</option></select>
          </label>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Цена коина = просмотры статьи за последний полный UTC-день / «просмотров на доллар», не ниже пола. Фид протухает через 36 часов без пуша, торговля словом останавливается.</div>
      </section>
      <section className="adm-card">
        <div className="adm-row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Состояние по словам</h2>
          <div className="adm-row">
            <button className="adm-btn" disabled={!!busy} onClick={() => run("obs", () => api("/api/admin/oracle/observe", { method: "POST" }), "Данные сняты")}>Снять просмотры за вчера</button>
            <button className="adm-btn primary" disabled={!!busy} onClick={() => { if (confirm("Запушить текущие цены всех задеплоенных слов в фид?")) run("push", () => api("/api/admin/oracle/push", { method: "POST", json: {} }), "Пуш отправлен"); }}>Пушнуть все цены</button>
          </div>
        </div>
        <div className="adm-table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Слово</th><th>Статья</th><th>Просмотры</th><th>Цена</th><th>Последний пуш</th><th>Фид</th><th></th></tr></thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id}>
                  <td><b>{w.name}</b> <span className="muted mono">{w.symbol}</span></td>
                  <td className="muted">{w.wikiTitle}</td>
                  <td>{w.lastViews?.toLocaleString("ru-RU") ?? "—"}</td>
                  <td>{w.lastPrice !== null ? `$${w.lastPrice.toFixed(3)}` : "—"}</td>
                  <td className="muted">{w.lastPushedAt ? new Date(w.lastPushedAt).toLocaleString("ru-RU") : "—"}</td>
                  <td>{!w.coin ? <span className="muted">нет коина</span> : fresh(w.lastPushedAt) ? <span className="adm-chip on">свежий</span> : <span className="adm-chip off">протух</span>}</td>
                  <td>{w.coin && <button className="adm-btn" disabled={!!busy} onClick={() => run(w.id, () => api("/api/admin/oracle/push", { method: "POST", json: { ids: [w.id] } }), "Пуш отправлен")}>Пушнуть</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Фид: <a href={`${EXPLORER}/address/${process.env.NEXT_PUBLIC_ADDR_FEED ?? ""}`} target="_blank" rel="noreferrer">{process.env.NEXT_PUBLIC_ADDR_FEED || "не задеплоен"}</a></div>
      </section>
    </>
  );
}
