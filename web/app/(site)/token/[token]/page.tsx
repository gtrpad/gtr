import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { getMarket, getCandles, getHolders } from "@/lib/api";
import { publicSettings } from "@/lib/settings";
import { EXPLORER } from "@/components/util/chain";
import { Page } from "@/components/layout/Page";
import { MemeAvatar, KV, FeeSplit, Progress, Tag } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Address, TxLink } from "@/components/ui/Address";
import { IconLinks } from "@/components/ui/IconLinks";
import { PriceChart } from "@/components/charts/PriceChart";
import { TradeWidget } from "@/components/trade/TradeWidget";
import { LiveTrades } from "@/components/token/LiveTrades";
import { HoldersTable } from "@/components/token/HoldersTable";
import { TokenTabs } from "@/components/token/TokenTabs";
import { YourPosition } from "@/components/token/YourPosition";
import { fmtUsd, fmtNum, fmtCompact, ago, short, units } from "@/components/util/format";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  if (!isAddress(token)) return { title: "Market" };
  const m = await getMarket(token);
  return { title: m ? `$${m.symbol} / ${m.word.symbol}` : "Market" };
}

export default async function TokenPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  if (!isAddress(token)) notFound();
  const m = await getMarket(token);
  if (!m) notFound();
  const [candles, holders, settings] = await Promise.all([getCandles(m.token, "5m", 300), getHolders(m.token, 50), publicSettings()]);
  const w = m.word;
  const progress = Math.round(m.progress * 100);
  const paidCoin = units(m.holderPool.paid, 18);
  const feesCoin = units(m.feesTotalCoin, 18);
  const links: { name: "web" | "x" | "telegram"; label: string; href: string }[] = [];
  if (m.website) links.push({ name: "web", label: "Website", href: m.website.startsWith("http") ? m.website : `https://${m.website}` });
  if (m.twitter) links.push({ name: "x", label: "X", href: m.twitter.startsWith("http") ? m.twitter : `https://x.com/${m.twitter.replace(/^@/, "")}` });
  if (m.telegram) links.push({ name: "telegram", label: "Telegram", href: m.telegram.startsWith("http") ? m.telegram : `https://${m.telegram.replace(/^https?:\/\//, "")}` });

  const rewards = (
    <div className="grid2">
      <div>
        <h3 style={{ marginBottom: 10 }}>Fee split <span className="cap">{m.feeBps / 100}% per trade</span></h3>
        <FeeSplit />
        <div className="legend">
          <span><i style={{ background: "var(--purple)" }} />40% holders, in {w.symbol}</span>
          <span><i style={{ background: "#8ab4f8" }} />30% buyback and burn</span>
          <span><i style={{ background: "var(--tp-outline)" }} />30% exchange</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <KV k="Fees collected"><span className="num">{fmtUsd(m.feesTotalUsd)} · {fmtCompact(feesCoin, 2)} {w.symbol}</span></KV>
          <KV k="Buyback share"><span className="num">{fmtUsd(m.feesTotalUsd * 0.3)}{!settings.trendToken ? <span className="cap"> · held in ETH until the coin launches</span> : null}</span></KV>
          <KV k="Creator share">None</KV>
        </div>
      </div>
      <div>
        <h3 style={{ marginBottom: 10 }}>Holder rewards <span className="cap">every {settings.payoutCycleMin} min</span></h3>
        <KV k="Paid so far"><span className="num">{fmtCompact(paidCoin, 2)} {w.symbol} <span className="muted">· ≈ {fmtUsd(paidCoin * w.price)}</span></span></KV>
        <KV k="Unpaid pool"><span className="num">{fmtUsd(m.holderPool.unpaidUsd)} <span className="muted">· pays at ${fmtNum(settings.payoutMinPoolUsd)}</span></span></KV>
        <KV k="Last payout">
          {m.lastPayout ? (
            <span className="num">{fmtUsd(m.lastPayout.totalUsd)} to {m.lastPayout.wallets} wallet{m.lastPayout.wallets === 1 ? "" : "s"} · {ago(m.lastPayout.ts)}{m.lastPayout.txHash ? <> <TxLink hash={m.lastPayout.txHash} /></> : null}</span>
          ) : (
            <span className="muted" style={{ fontWeight: 400 }}>none yet</span>
          )}
        </KV>
        <KV k="Minimum holding"><span className="num">${fmtNum(settings.payoutMinHoldingUsd)}</span></KV>
        <KV k="Minimum payout"><span className="num">${fmtNum(settings.payoutMinWalletUsd)} per wallet per cycle</span></KV>
        <KV k="Your share"><Link href="/rewards">See rewards</Link></KV>
        <h3 style={{ margin: "16px 0 8px" }}>Last payouts</h3>
        {m.lastPayout ? (
          <div className="row-item" style={{ height: 48 }}>
            <MemeAvatar symbol={m.symbol} image={m.imageUrl} size={24} />
            <div className="name"><strong className="num">{fmtUsd(m.lastPayout.totalUsd)} · {fmtCompact(units(m.lastPayout.totalCoin, 18), 2)} {w.symbol}</strong><small>{m.lastPayout.wallets} wallet{m.lastPayout.wallets === 1 ? "" : "s"} · {ago(m.lastPayout.ts)}</small></div>
            {m.lastPayout.txHash ? <TxLink hash={m.lastPayout.txHash} /> : null}
          </div>
        ) : (
          <p className="cap">No payout rounds yet. The first one runs once the pool reaches ${fmtNum(settings.payoutMinPoolUsd)}.</p>
        )}
      </div>
    </div>
  );

  return (
    <Page
      aside={
        <div className="panel-right">
          <TradeWidget token={m.token} coin={m.coin} migrated={m.migrated} coinSymbol={w.symbol} symbol={m.symbol} feeBps={m.feeBps} />
          <YourPosition token={m.token} coin={m.coin} symbol={m.symbol} coinSymbol={w.symbol} priceUsd={m.priceUsd} coinPrice={w.price} />
        </div>
      }
    >
      <div className="stack panel-left">
        <div className="intro">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <MemeAvatar symbol={m.symbol} image={m.imageUrl} size={40} />
            <h1>{m.name} <span className="muted" style={{ fontWeight: 400 }}>${m.symbol}</span></h1>
            <Tag kind="b" href={`/words/${w.slug}`}>{w.name} · {w.symbol}</Tag>
            <IconLinks wiki={w.wikiTitle} coin={m.coin} token={m.token} gap={6} />
            <Tag kind="n">{m.migrated ? "Migrated" : `${progress}% to migration`}</Tag>
          </div>
          <div className="cap num" style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>FDV <b style={{ color: "var(--ink)" }}>{fmtUsd(m.fdvUsd)}</b></span>
            <span>24h volume <b style={{ color: "var(--ink)" }}>{fmtUsd(m.volume24hUsd)}</b></span>
            <span>Holders <b style={{ color: "var(--ink)" }}>{fmtNum(m.holders)}</b></span>
            <span>Fee <b style={{ color: "var(--ink)" }}>{m.feeBps / 100}%</b></span>
            <span>Created {ago(m.createdAt)} by <span className="mono">{short(m.creator)}</span></span>
          </div>
          {m.description ? <p style={{ marginTop: 12, maxWidth: 640 }}>{m.description}</p> : null}
          <div className="chips" style={{ marginTop: 12 }}>
            <a className="btn sm" href={`${EXPLORER}/token/${m.token}`} target="_blank" rel="noopener noreferrer"><ServiceIcon name="blockscout" /></a>
            {links.map((l) => (
              <a key={l.name} className="btn sm" href={l.href} target="_blank" rel="noopener noreferrer"><ServiceIcon name={l.name} text={l.label} /></a>
            ))}
          </div>
        </div>

        <PriceChart token={m.token} coinSymbol={w.symbol} initial={candles} initialTf="5m" priceCoin={m.priceCoin} priceUsd={m.priceUsd} trades={m.trades} />

        <div className="statline">
          <span className="stat-enter" style={{ ["--d" as string]: 0 }}><i className="dot-blue" />FDV <b className="num">{fmtUsd(m.fdvUsd)}</b>{w.price > 0 ? ` · ${fmtCompact(m.fdvUsd / w.price)} ${w.symbol}` : ""}</span>
          <span className="stat-enter" style={{ ["--d" as string]: 1 }}><i className="dot-red" />24h volume <b className="num">{fmtUsd(m.volume24hUsd)}</b></span>
          <span className="stat-enter" style={{ ["--d" as string]: 2 }}><i className="dot-yellow" />Holders <b className="num">{fmtNum(m.holders)}</b>{m.lastPayout ? ` · ${m.lastPayout.wallets} paid last cycle` : ""}</span>
          <span className="stat-enter" style={{ ["--d" as string]: 3 }}><i className="dot-green" />{m.migrated ? <>Migrated <b>pool live</b></> : <>To migration <b className="num">{progress}%</b> · {fmtCompact(units(m.raised, 18), 2)} {w.symbol} raised</>}</span>
        </div>

        <section className="section">
          <TokenTabs
            tabs={[
              { key: "trades", label: "Trades", count: m.trades.length, content: <LiveTrades token={m.token} initial={m.trades} coinSymbol={w.symbol} /> },
              { key: "holders", label: "Holders", count: m.holders, content: <HoldersTable holders={holders} symbol={m.symbol} /> },
              { key: "rewards", label: "Rewards", content: rewards },
            ]}
          />
        </section>

        <section className="section">
          <div className="section-head"><h2>Migration</h2><span className="cap">{m.migrated ? "pool live" : `${fmtCompact(units(m.curveSupply, 18))} $${m.symbol} left on the curve`}</span></div>
          <Progress value={progress} />
          <p className="hint" style={{ marginTop: 8 }}>
            {m.migrated ? <>The raised {w.symbol} and the reserved 200M tokens sit in a <ServiceIcon name="uniswap" /> v4 pool held by the launchpad forever.</> : <>Caps are fixed in {w.symbol} at creation. When the last curve token sells, the pool opens in the same transaction.</>}
          </p>
        </section>

        <section className="section">
          <div className="section-head"><h2>Contracts</h2><span className="cap"><ServiceIcon name="rhc" /></span></div>
          <KV k={`$${m.symbol}`}><Address value={m.token} kind="token" /></KV>
          <KV k={`${w.symbol} coin`}><Address value={m.coin} kind="token" /></KV>
          <KV k="Creator"><Address value={m.creator} /></KV>
          <KV k="Pool">{m.poolId ? <span className="addr"><ServiceIcon name="uniswap" label={false} /> {short(m.poolId)}</span> : <span className="muted" style={{ fontWeight: 400 }}><ServiceIcon name="uniswap" /> v4 · after migration</span>}</KV>
        </section>
      </div>
    </Page>
  );
}
