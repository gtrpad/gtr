"use client";
import { useAccount, useSwitchChain } from "wagmi";
import type { Address } from "viem";
import { useTrade, type PayCur } from "@/lib/hooks/useTrade";
import { robinhood } from "@/lib/wagmi";
import { EXPLORER } from "@/components/util/chain";
import { WordDot, Chip, KV, Tag } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Odometer } from "@/components/motion/Odometer";
import { ConnectInline } from "./ConnectInline";

type Props = { token: string; coin: string; migrated: boolean; coinSymbol: string; symbol: string; feeBps: number };

const SLIPPAGE = [50, 100, 200];

/** Buy/Sell segmented, pay-with chips, amount with balance, quote, route, slippage, CTA, tx status. */
export function TradeWidget({ token, coin, migrated, coinSymbol, symbol, feeBps }: Props) {
  const t = useTrade(token as Address, coin as Address, migrated, coinSymbol);
  const { chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongChain = t.connected && chainId !== robinhood.id;
  const busy = t.tx.status === "signing" || t.tx.status === "pending";
  const amountOk = !!t.amount && Number(t.amount) > 0;

  const curLabel = (c: PayCur) => (c === "ETH" ? <ServiceIcon name="eth" /> : c === "USDG" ? <ServiceIcon name="usdg" /> : <><WordDot symbol={coinSymbol} size={16} /> {coinSymbol}</>);
  const bal = t.side === "buy" ? (t.cur === "ETH" ? `${t.balances.eth} ETH` : t.cur === "USDG" ? `${t.balances.usdg} USDG` : `${t.balances.coin} ${coinSymbol}`) : `${t.balances.token} $${symbol}`;
  const balRaw = t.side === "buy" ? (t.cur === "ETH" ? t.balances.eth : t.cur === "USDG" ? t.balances.usdg : t.balances.coin) : t.balances.token;

  let cta: React.ReactNode;
  if (!t.connected) cta = <ConnectInline label={`Connect wallet to ${t.side}`} />;
  else if (wrongChain)
    cta = (
      <button className="btn primary lg block" disabled={switching} onClick={() => switchChain({ chainId: robinhood.id })}>
        Switch to Robinhood Chain
      </button>
    );
  else if (t.needsApproval)
    cta = (
      <button className="btn primary lg block" disabled={busy} onClick={() => t.approve()}>
        {busy ? "Approving…" : `Approve ${t.cur === "USDG" ? "USDG" : coinSymbol}`}
      </button>
    );
  else
    cta = (
      <button className={`btn lg block ${t.side === "buy" ? "primary" : ""}`} disabled={!amountOk || busy || t.quote.raw === null} onClick={() => t.submit()}>
        {busy ? (t.tx.status === "signing" ? "Confirm in wallet…" : "Pending…") : t.side === "buy" ? `Buy $${symbol}` : `Sell $${symbol}`}
      </button>
    );

  return (
    <section className="card burst">
      <div className="card-head"><h2>Trade ${symbol}</h2><span className="tiny-label">{migrated ? "Uniswap v4" : "Curve"}</span></div>
      <div className="seg fill" style={{ marginBottom: 16 }}>
        <button type="button" className={t.side === "buy" ? "on" : ""} onClick={() => t.setSide("buy")}>
          Buy
        </button>
        <button type="button" className={t.side === "sell" ? "on" : ""} onClick={() => t.setSide("sell")}>
          Sell
        </button>
      </div>
      <div className="field">
        <label>{t.side === "buy" ? "Pay with" : "Receive"}</label>
        <span className="chips">
          {(["ETH", "USDG", "COIN"] as PayCur[]).map((c) => (
            <Chip key={c} on={t.cur === c} onClick={() => t.setCur(c)}>
              {curLabel(c)}
            </Chip>
          ))}
        </span>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Amount</label>
        <div className="input big num">
          <input inputMode="decimal" placeholder="0.00" value={t.amount} onChange={(e) => t.setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          <span className="suffix">{t.side === "buy" ? (t.cur === "COIN" ? coinSymbol : t.cur) : `$${symbol}`}</span>
        </div>
        {t.connected ? (
          <span className="hint num">
            Balance {bal}
            {Number(balRaw.replace(/,/g, "")) > 0 ? (
              <>
                {" · "}
                <button type="button" style={{ background: "none", border: 0, padding: 0, color: "var(--purple-ink)", font: "inherit", cursor: "pointer" }} onClick={() => t.setAmount(balRaw.replace(/,/g, ""))}>
                  Max
                </button>
              </>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>You get</label>
        <div className="input big num" style={{ color: t.quote.out ? "var(--ink)" : "var(--muted)" }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{t.quote.loading ? "…" : <Odometer value={t.quote.out ?? "0"} />}</span>
          <span className="suffix">{t.side === "buy" ? `$${symbol}` : t.cur === "COIN" ? coinSymbol : t.cur}</span>
        </div>
        {t.quote.error && amountOk ? <span className="err">{t.quote.error}</span> : null}
      </div>
      <div style={{ marginTop: 12 }}>
        <KV k="Route">
          <span style={{ fontWeight: 400, fontSize: 13 }}>{t.route}</span>
        </KV>
        <KV k="Trading fee">
          <span className="num">{feeBps / 100}%</span>
        </KV>
        <KV k="Slippage">
          <span className="chips nowrap" style={{ justifyContent: "flex-end", gap: 4 }}>
            {SLIPPAGE.map((s) => (
              <button key={s} type="button" onClick={() => t.setSlippageBps(s)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
                <Tag kind={t.slippageBps === s ? "b" : "n"}>{s / 100}%</Tag>
              </button>
            ))}
          </span>
        </KV>
      </div>
      <div style={{ marginTop: 16 }}>{cta}</div>
      {t.tx.hash ? (
        <div className="tx">
          <span>{t.tx.status === "success" ? "Done." : t.tx.status === "pending" ? "Pending on chain." : t.tx.status === "error" ? "Failed." : "Sent."}</span>
          <a className="svcw" href={`${EXPLORER}/tx/${t.tx.hash}`} target="_blank" rel="noopener noreferrer">
            <ServiceIcon name="blockscout" label={false} /> View transaction
          </a>
        </div>
      ) : null}
      {t.tx.error ? <p className="err" style={{ marginTop: 10 }}>{t.tx.error}</p> : null}
      <p className="hint" style={{ marginTop: 10 }}>
        One transaction on <ServiceIcon name="rhc" />. Your 40% of fees arrives in {coinSymbol} automatically, nothing to claim.
      </p>
    </section>
  );
}
