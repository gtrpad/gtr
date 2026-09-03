"use client";
import { useCallback, useEffect, useState } from "react";
import { api, EXPLORER } from "../_components/api";

type Info = { address: string; eth: number; usdg: number; isOwner: boolean | null } | null;

const CONTRACTS: [string, string | undefined][] = [
  ["AttentionFeed (оракул)", process.env.NEXT_PUBLIC_ADDR_FEED],
  ["PegVault (коины слов)", process.env.NEXT_PUBLIC_ADDR_VAULT],
  ["Launchpad (курва, миграция, фисы)", process.env.NEXT_PUBLIC_ADDR_LAUNCHPAD],
  ["Router (ETH / USDG / коин в одну транзу)", process.env.NEXT_PUBLIC_ADDR_ROUTER],
  ["Buyback (выкуп и бёрн)", process.env.NEXT_PUBLIC_ADDR_BUYBACK],
  ["Disperse (пакетные выплаты)", process.env.NEXT_PUBLIC_ADDR_DISPERSE],
  ["Uniswap v4 PoolManager", "0x8366a39CC670B4001A1121B8F6A443A643e40951"],
  ["USDG", "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"],
];

export default function WalletPage() {
  const [info, setInfo] = useState<Info>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pk, setPk] = useState("");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ keeper: Info; error?: string }>("/api/admin/wallet");
    setInfo(r.keeper);
    setErr(r.error ?? null);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <h1>Кошелёк оператора и контракты</h1>
      {msg && <div className={`adm-msg ${msg.err ? "err" : ""}`}>{msg.text}</div>}
      <section className="adm-card">
        <h2>Кошелёк оператора (владелец контрактов и кипер)</h2>
        {info ? (
          <div className="adm-grid">
            <div><div className="muted">Адрес</div><a className="mono" href={`${EXPLORER}/address/${info.address}`} target="_blank" rel="noreferrer">{info.address}</a></div>
            <div><div className="muted">ETH (газ)</div><b>{info.eth.toFixed(5)}</b></div>
            <div><div className="muted">USDG</div><b>{info.usdg.toFixed(2)}</b></div>
            <div><div className="muted">Владелец контрактов</div>{info.isOwner === null ? <span className="muted">контракты не задеплоены</span> : info.isOwner ? <span className="ok">да</span> : <span className="bad">нет, деплой слов и настройки не пройдут</span>}</div>
          </div>
        ) : (
          <div className="adm-msg">{err ?? "Ключ не задан. Кипер и оператор не смогут слать транзакции."}</div>
        )}
        <div className="adm-row" style={{ marginTop: 16, alignItems: "flex-end" }}>
          <label style={{ flex: 1 }}>Приватный ключ (hex 0x…, хранится AES-GCM под WALLET_ENC_KEY, назад не отдаётся)<input type="password" value={pk} onChange={(e) => setPk(e.target.value)} autoComplete="off" /></label>
          <button
            className="adm-btn primary"
            disabled={!pk}
            onClick={async () => {
              if (!confirm("Заменить ключ оператора?")) return;
              try {
                const r = await api<{ address: string }>("/api/admin/wallet", { method: "POST", json: { privateKey: pk } });
                setPk("");
                setMsg({ text: `Ключ сохранён, адрес ${r.address}` });
                await load();
              } catch (e) {
                setMsg({ text: (e as Error).message, err: true });
              }
            }}
          >
            Сохранить ключ
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Этот же адрес должен быть владельцем контрактов (деплой-скрипт ставит OWNER = KEEPER) и держать ETH на газ. Сюда прилетают свипы фисов в коинах слов, отсюда идут выплаты холдерам.</div>
      </section>
      <section className="adm-card">
        <h2>Контракты (Robinhood Chain 4663)</h2>
        <div className="adm-table-wrap" style={{ maxHeight: 400 }}>
          <table>
            <thead><tr><th>Контракт</th><th>Адрес</th></tr></thead>
            <tbody>
              {CONTRACTS.map(([n, a]) => (
                <tr key={n}><td>{n}</td><td>{a ? <a className="mono" href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer">{a}</a> : <span className="warn">не задеплоен (NEXT_PUBLIC_ADDR_*)</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
