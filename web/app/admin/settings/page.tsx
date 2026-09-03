"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../_components/api";

type S = Record<string, string>;

const TOGGLES: [string, string, string][] = [
  ["execute", "EXECUTE: боевые выплаты, конверсии и байбек", "Выключено = кипер только пишет DRY-строки в журнал. Сбор фисов и свипы в трежери работают всегда."],
  ["site_paused", "Пауза сайта", "Публичный сайт показывает плашку и прячет кнопки трейда."],
  ["oracle_enabled", "Пуш оракула", "Ежедневный пуш цен слов в фид."],
  ["buyback_enabled", "Байбек", "Конверсия доли байбека в ETH и выкуп биржевого токена."],
];

const NUMS: [string, string][] = [
  ["payout_cycle_min", "Цикл кипера, минут"],
  ["payout_min_pool_usd", "Минимальный пул выплаты, USD"],
  ["payout_min_holding_usd", "Минимальный холдинг для выплаты, USD"],
  ["payout_min_wallet_usd", "Минимальная выплата на кошелёк, USD"],
  ["payout_reserve_bps", "Резерв на выплатах, bps"],
  ["fees_min_sweep_usd", "Минимальная сумма свипа, USD"],
];

export default function SettingsPage() {
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [pool, setPool] = useState({ token: "", fee: "10000", tickSpacing: "200" });

  const load = useCallback(async () => setS(await api<S>("/api/admin/settings")), []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: S) => {
    setMsg(null);
    try {
      await api("/api/admin/settings", { method: "POST", json: patch });
      setMsg({ text: "Сохранено" });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    }
  };

  if (!s) return <h1>Настройки</h1>;
  return (
    <>
      <h1>Настройки</h1>
      {msg && <div className={`adm-msg ${msg.err ? "err" : ""}`}>{msg.text}</div>}
      <section className="adm-card">
        <h2>Kill-switch</h2>
        {TOGGLES.map(([k, title, hint]) => (
          <div className="adm-toggle" key={k}>
            <div><b>{title}</b><small>{hint}</small></div>
            <div className="adm-row">
              <span className={`adm-chip ${s[k] === "true" ? "on" : "off"}`}>{s[k] === "true" ? "вкл" : "выкл"}</span>
              <button className={`adm-btn ${s[k] === "true" ? "danger" : "primary"}`} onClick={() => { if (k === "execute" && s[k] !== "true" && !confirm("Включить боевые выплаты? Кипер начнёт слать транзакции с кошелька оператора.")) return; save({ [k]: s[k] === "true" ? "false" : "true" }); }}>
                {s[k] === "true" ? "Выключить" : "Включить"}
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className="adm-card">
        <h2>Параметры выплат</h2>
        <div className="adm-grid">
          {NUMS.map(([k, label]) => (
            <label key={k}>{label}<input type="number" step="any" defaultValue={s[k]} onBlur={(e) => e.target.value !== s[k] && save({ [k]: e.target.value })} /></label>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Сплит фисов 40 / 30 / 30 и кэпы курвы ($5 000 / $35 000) живут в контракте Launchpad (setConfig владельцем), здесь не правятся.</div>
      </section>
      <section className="adm-card">
        <h2>Сайт</h2>
        <div className="adm-grid">
          <label>Публичный URL (для метадаты токенов)<input defaultValue={s.public_base_url} onBlur={(e) => e.target.value !== s.public_base_url && save({ public_base_url: e.target.value.replace(/\/$/, "") })} /></label>
          <label>Исключить из выплат (адреса через запятую)<input defaultValue={s.exclude_wallets} onBlur={(e) => e.target.value !== s.exclude_wallets && save({ exclude_wallets: e.target.value })} /></label>
        </div>
      </section>
      <section className="adm-card">
        <h2>Биржевой токен</h2>
        {s.trend_token ? (
          <div className="adm-msg">Токен: <span className="mono">{s.trend_token}</span> · пул fee {s.trend_pool_fee}, spacing {s.trend_pool_tick_spacing}</div>
        ) : (
          <div className="adm-msg">Токен не запущен. Байбек-доля копится в ETH на контракте Buyback до ввода адреса.</div>
        )}
        <div className="adm-row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <label style={{ flex: 2 }}>Адрес токена<input value={pool.token} onChange={(e) => setPool({ ...pool, token: e.target.value })} placeholder="0x…" /></label>
          <label>Fee пула ETH/токен (1e-6)<input value={pool.fee} onChange={(e) => setPool({ ...pool, fee: e.target.value })} /></label>
          <label>tickSpacing<input value={pool.tickSpacing} onChange={(e) => setPool({ ...pool, tickSpacing: e.target.value })} /></label>
          <button
            className="adm-btn primary"
            onClick={async () => {
              if (!confirm("Записать пул байбека в контракт Buyback (транзакция владельца)?")) return;
              try {
                const r = await api<{ tx: string }>("/api/admin/buyback/pool", { method: "POST", json: { token: pool.token, fee: Number(pool.fee), tickSpacing: Number(pool.tickSpacing) } });
                setMsg({ text: `Пул записан: ${r.tx}` });
                await load();
              } catch (e) {
                setMsg({ text: (e as Error).message, err: true });
              }
            }}
          >
            Записать пул
          </button>
        </div>
      </section>
    </>
  );
}
