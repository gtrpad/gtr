"use client";
import { useAccount, useSwitchChain } from "wagmi";
import type { Hex, Address } from "viem";
import { useWordCoin } from "@/lib/hooks/useWordCoin";
import { robinhood } from "@/lib/wagmi";
import { EXPLORER } from "@/components/util/chain";
import { WordDot, KV } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Odometer } from "@/components/motion/Odometer";
import { fmtPrice, fmtUsdFull } from "@/components/util/format";
import { ConnectInline } from "./ConnectInline";

type Props = { wordId: string; coin: string | null; symbol: string; price: number; reserveUsdg: number | null; title?: string; sellOnly?: boolean };

/** Buy or sell a word coin for USDG at the feed price through the PegVault. */
export function WordCoinBox({ wordId, coin, symbol, price, reserveUsdg, title, sellOnly = false }: Props) {
  const t = useWordCoin(wordId as Hex, (coin as Address) ?? null);
  const { chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const side = sellOnly ? "sell" : t.side;
  const wrongChain = t.connected && chainId !== robinhood.id;
  const busy = t.tx.status === "signing" || t.tx.status === "pending";
  const canSubmit = !!coin && !!t.amount && Number(t.amount) > 0 && !busy;

  return (
    <section className="card burst">
      <div className="card-head"><h2>
        {title ?? (sellOnly ? `Sell ${symbol} for USDG` : `Buy or sell ${symbol}`)}</h2><span className="tiny-label">PegVault</span>
      </div>
      {!sellOnly ? (
        <div className="seg fill" style={{ marginBottom: 16 }}>
          <button type="button" className={side === "buy" ? "on" : ""} onClick={() => t.setSide("buy")}>
            Buy
          </button>
          <button type="button" className={side === "sell" ? "on" : ""} onClick={() => t.setSide("sell")}>
            Sell
          </button>
        </div>
      ) : null}
      <div className="field">
        <label>You pay</label>
        <div className="input big num">
          <input inputMode="decimal" placeholder="0.00" value={t.amount} onChange={(e) => t.setAmount(e.target.value.replace(/[^0-9.]/g, ""))} disabled={!coin} />
          <span className="suffix">
            {side === "buy" ? (
              <ServiceIcon name="usdg" />
            ) : (
              <>
                <WordDot symbol={symbol} size={20} /> {symbol}
              </>
            )}
          </span>
        </div>
        {t.connected ? (
          <span className="hint num">
            Balance {side === "buy" ? `${t.balances.usdg} USDG` : `${t.balances.coin} ${symbol}`}
            {side === "sell" && Number(t.balances.coin.replace(/,/g, "")) > 0 ? (
              <>
                {" · "}
                <button type="button" style={{ background: "none", border: 0, padding: 0, color: "var(--purple-ink)", font: "inherit", cursor: "pointer" }} onClick={() => t.setAmount(t.balances.coin.replace(/,/g, ""))}>
                  Max
                </button>
              </>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>You get</label>
        <div className="input big num" style={{ color: t.quote ? "var(--ink)" : "var(--muted)" }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}><Odometer value={t.quote ?? "0.00"} /></span>
          <span className="suffix">
            {side === "buy" ? (
              <>
                <WordDot symbol={symbol} size={20} /> {symbol}
              </>
            ) : (
              <ServiceIcon name="usdg" />
            )}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <KV k="Feed price">
          <span className="num">
            ${fmtPrice(price)} per {symbol}
          </span>
        </KV>
        <KV k="Route">{side === "buy" ? `USDG → PegVault → ${symbol}` : `${symbol} → PegVault → USDG`}</KV>
        {reserveUsdg !== null ? (
          <KV k={`Reserve for ${symbol}`}>
            <span className="num">{fmtUsdFull(reserveUsdg)}</span>
          </KV>
        ) : null}
        {t.maxSellable !== null ? (
          <KV k="Max sellable now">
            <span className="num">
              {t.maxSellable} {symbol}
            </span>
          </KV>
        ) : null}
      </div>
      <div style={{ marginTop: 16 }}>
        {!coin ? (
          <button className="btn primary lg block" disabled>
            Coin not deployed yet
          </button>
        ) : !t.connected ? (
          <ConnectInline label={`Connect wallet to ${side}`} />
        ) : wrongChain ? (
          <button className="btn primary lg block" disabled={switching} onClick={() => switchChain({ chainId: robinhood.id })}>
            <ServiceIcon name="rhc" label={false} /> Switch to Robinhood Chain
          </button>
        ) : (
          <button className={`btn lg block ${side === "buy" ? "primary" : ""}`} disabled={!canSubmit} onClick={() => t.submit()}>
            {busy ? (t.tx.status === "signing" ? "Confirm in wallet…" : "Pending…") : side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
          </button>
        )}
      </div>
      {t.tx.hash ? (
        <div className="tx">
          <span>{t.tx.status === "success" ? "Done." : t.tx.status === "pending" ? "Pending on chain." : "Sent."}</span>
          <a className="svcw" href={`${EXPLORER}/tx/${t.tx.hash}`} target="_blank" rel="noopener noreferrer">
            <ServiceIcon name="blockscout" label={false} /> View transaction
          </a>
        </div>
      ) : null}
      {t.tx.error ? <p className="err" style={{ marginTop: 10 }}>{t.tx.error}</p> : null}
      <p className="hint" style={{ marginTop: 10 }}>
        Selling pays feed price from this word&apos;s reserve. If the reserve runs out, sells wait for new buys.
      </p>
    </section>
  );
}
