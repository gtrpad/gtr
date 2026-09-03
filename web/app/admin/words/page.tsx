"use client";
import { useCallback, useEffect, useState } from "react";
import { api, EXPLORER, short } from "../_components/api";

type W = { id: string; slug: string; name: string; symbol: string; wikiTitle: string; coin: string | null; enabled: boolean; hidden: boolean; lastViews: number | null; lastPrice: number | null; lastPushedAt: string | null; markets: number };
type Sug = { title: string; views: number };

export default function WordsPage() {
  const [words, setWords] = useState<W[]>([]);
  const [sug, setSug] = useState<Sug[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", wikiTitle: "", symbol: "", views: null as number | null });

  const load = useCallback(async () => setWords(await api<W[]>("/api/admin/words")), []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, okText: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ text: typeof r === "string" ? r : okText });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(null);
    }
  };

  const resolve = async () => {
    if (!form.name.trim()) return;
    setBusy("resolve");
    try {
      const r = await api<{ title: string | null; views: number | null }>(`/api/admin/words/resolve?q=${encodeURIComponent(form.name)}`);
      setForm((f) => ({ ...f, wikiTitle: r.title ?? "", views: r.views }));
      if (!r.title) setMsg({ text: "Статья не найдена, впишите название вручную", err: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1>Каталог слов</h1>
      {msg && <div className={`adm-msg ${msg.err ? "err" : ""}`}>{msg.text}</div>}

      <section className="adm-card">
        <h2>Добавить слово</h2>
        <div className="adm-row" style={{ alignItems: "flex-end" }}>
          <label className="adm-word-field">Слово (как на сайте, латиницей)<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="recession" /></label>
          <button className="adm-btn" disabled={busy === "resolve"} onClick={resolve}>Найти статью</button>
          <label className="adm-word-field">Статья Wikipedia (точное название)<input value={form.wikiTitle} onChange={(e) => setForm({ ...form, wikiTitle: e.target.value })} placeholder="Recession" /></label>
          <label style={{ width: 140 }}>Тикер коина<input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder="RECESSION" /></label>
          <button
            className="adm-btn primary"
            disabled={busy === "add" || !form.name || !form.wikiTitle}
            onClick={() => run("add", () => api("/api/admin/words", { method: "POST", json: form }), "Слово добавлено, история за 90 дней загружена").then(() => setForm({ name: "", wikiTitle: "", symbol: "", views: null }))}
          >
            Добавить
          </button>
        </div>
        {form.views !== null && <div className="muted" style={{ marginTop: 8 }}>Вчера у статьи «{form.wikiTitle}» было {form.views.toLocaleString("ru-RU")} просмотров → цена коина ≈ ${(form.views / 1000).toFixed(3)}</div>}
        <div style={{ marginTop: 12 }}>
          <button className="adm-btn" disabled={busy === "sug"} onClick={() => run("sug", async () => setSug(await api<Sug[]>("/api/admin/words/suggest")), "Подсказки обновлены")}>
            Показать топ статей вчерашнего дня
          </button>
          {sug && (
            <div className="adm-table-wrap" style={{ marginTop: 10, maxHeight: 260 }}>
              <table>
                <thead><tr><th>Статья</th><th>Просмотры</th><th>Цена коина</th><th></th></tr></thead>
                <tbody>
                  {sug.map((s) => (
                    <tr key={s.title}>
                      <td>{s.title}</td>
                      <td>{s.views.toLocaleString("ru-RU")}</td>
                      <td>${(s.views / 1000).toFixed(2)}</td>
                      <td><button className="adm-btn" onClick={() => setForm({ name: s.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), wikiTitle: s.title, symbol: "", views: s.views })}>В форму</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="adm-card">
        <h2>Слова ({words.length})</h2>
        <div className="adm-table-wrap">
          <table>
            <thead>
              <tr><th>Слово</th><th>Тикер</th><th>Статья</th><th>Просмотры</th><th>Цена</th><th>Пуш</th><th>Коин</th><th>Маркеты</th><th>Статус</th><th>Действия</th></tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id}>
                  <td><b>{w.name}</b><br /><span className="muted mono">{w.id.slice(0, 10)}…</span></td>
                  <td className="mono">{w.symbol}</td>
                  <td><a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(w.wikiTitle.replace(/ /g, "_"))}`} target="_blank" rel="noreferrer">{w.wikiTitle}</a></td>
                  <td>{w.lastViews?.toLocaleString("ru-RU") ?? "—"}</td>
                  <td>{w.lastPrice !== null ? `$${w.lastPrice.toFixed(3)}` : "—"}</td>
                  <td className="muted">{w.lastPushedAt ? new Date(w.lastPushedAt).toLocaleString("ru-RU") : "не пушился"}</td>
                  <td>{w.coin ? <a className="mono" href={`${EXPLORER}/address/${w.coin}`} target="_blank" rel="noreferrer">{short(w.coin)}</a> : <span className="warn">не задеплоен</span>}</td>
                  <td>{w.markets}</td>
                  <td>
                    <span className={`adm-chip ${w.enabled ? "on" : "off"}`}>{w.enabled ? "торгуется" : "стоп"}</span>{" "}
                    {w.hidden && <span className="adm-chip dry">скрыто</span>}
                  </td>
                  <td>
                    <div className="adm-row">
                      {!w.coin && <button className="adm-btn primary" disabled={busy === w.id} onClick={() => { if (confirm(`Задеплоить коин «${w.name}» (${w.symbol}) в волт и пушнуть цену?`)) run(w.id, () => api(`/api/admin/words/${w.id}/deploy`, { method: "POST" }), "Коин задеплоен и цена запушена"); }}>Деплой</button>}
                      <button className="adm-btn" disabled={busy === w.id} onClick={() => run(w.id, () => api(`/api/admin/words/${w.id}/backfill`, { method: "POST" }), "История обновлена")}>История</button>
                      <button className="adm-btn" disabled={busy === w.id} onClick={() => run(w.id, () => api(`/api/admin/words/${w.id}`, { method: "PATCH", json: { enabled: !w.enabled } }), w.enabled ? "Торговля словом остановлена" : "Торговля словом включена")}>{w.enabled ? "Стоп" : "Включить"}</button>
                      <button className="adm-btn" disabled={busy === w.id} onClick={() => run(w.id, () => api(`/api/admin/words/${w.id}`, { method: "PATCH", json: { hidden: !w.hidden } }), w.hidden ? "Слово показано" : "Слово скрыто с сайта")}>{w.hidden ? "Показать" : "Скрыть"}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!words.length && <tr><td colSpan={10} className="muted">Каталог пуст. Добавьте первое слово.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
