import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWord } from "@/lib/api";
import { publicSettings, getSetting } from "@/lib/settings";
import { ADDR, ZERO, EXPLORER, wikiUrl } from "@/components/util/chain";
import { Page } from "@/components/layout/Page";
import { Change, Meter, KV, Empty, WordDot } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Icon } from "@/components/ui/Icons";
import { Address } from "@/components/ui/Address";
import { InterestChart, type ChartPoint } from "@/components/charts/InterestChart";
import { WordCoinBox } from "@/components/trade/WordCoinBox";
import { Odometer } from "@/components/motion/Odometer";
import { MarketsTable } from "@/components/markets/MarketsTable";
import { fmtNum, fmtPrice, fmtUsd, fmtCompact, agoLong, dateShort } from "@/components/util/format";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const w = await getWord(slug);
  return { title: w ? `${w.name} · ${w.symbol}` : "Word" };
}

export default async function WordPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const w = await getWord(slug);
  if (!w) notFound();
  const [settings, floor] = await Promise.all([publicSettings(), getSetting("word_price_floor")]);
  const hist = w.history;
  const peakViews = Math.max(...hist.map((h) => h.views), 0);
    const last30 = hist.slice(-30);
  const peak30 = Math.max(...last30.map((h) => h.views), 0);
  const peak30Day = last30.find((h) => h.views === peak30);
  const interestToday = peak30 > 0 && w.views !== null ? (w.views / peak30) * 100 : 0;
  const points: ChartPoint[] = hist.map((h) => ({
    x: dateShort(h.day),
    y: peakViews > 0 ? (h.views / peakViews) * 100 : 0,
    tip: { title: dateShort(h.day, true), rows: [["Views", fmtNum(h.views)], ["Price", `$${fmtPrice(h.price)}`], ["Interest", String(Math.round(peakViews > 0 ? (h.views / peakViews) * 100 : 0))]] },
  }));
  const xl = hist.length > 1 ? [dateShort(hist[0].day, true), dateShort(hist[Math.floor((hist.length - 1) / 3)].day), dateShort(hist[Math.floor(((hist.length - 1) * 2) / 3)].day), dateShort(hist[hist.length - 1].day)] : hist.map((h) => dateShort(h.day));
  const avg30 = hist.slice(-30).reduce((s, h) => s + h.price, 0) / Math.max(1, Math.min(30, hist.length));
  const high90 = Math.max(...hist.map((h) => h.price), 0);
  const last14 = hist.slice(-14).reverse();

  return (
    <Page
      aside={
        <div className="panel-right">
          <WordCoinBox wordId={w.id} coin={w.coin} symbol={w.symbol} price={w.price} reserveUsdg={w.reserveUsdg} />
          <div style={{ marginTop: 16 }}>
            <KV k="Contract">{w.coin ? <Address value={w.coin} kind="token" /> : <span className="muted" style={{ fontWeight: 400 }}>not deployed</span>}</KV>
            <KV k="Vault">{ADDR.vault !== ZERO ? <Address value={ADDR.vault} /> : <span className="muted" style={{ fontWeight: 400 }}>not deployed</span>}</KV>
            <KV k="Chain"><ServiceIcon name="rhc" /></KV>
            <KV k="Decimals">18</KV>
            <KV k="Price rule"><span className="num">views ÷ {fmtNum(settings.viewsPerUsd)}</span></KV>
            <KV k="Price floor"><span className="num">${floor}</span></KV>
            <KV k="Feed stale after">36 h</KV>
            <KV k="Supply"><span className="num">{w.totalSupply !== null ? `${fmtCompact(w.totalSupply, 2)} ${w.symbol}` : "–"}</span></KV>
            <KV k="Max sellable"><span className="num">{w.maxSellable !== null ? `${fmtCompact(w.maxSellable, 2)} ${w.symbol}` : "–"}</span></KV>
            <KV k="Reserve"><span className="num">{w.reserveUsdg !== null ? fmtUsd(w.reserveUsdg) : "–"}</span></KV>
          </div>
        </div>
      }
    >
      <div className="stack panel-left">
        <div className="intro">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <WordDot symbol={w.symbol} size={40} />
            <h1>{w.name} <span className="muted" style={{ fontWeight: 400 }}>{w.symbol}</span></h1>
          </div>
          <p>
            Word coin · tracks{" "}
            <a href={wikiUrl(w.wikiTitle)} target="_blank" rel="noopener noreferrer" title={`${w.wikiTitle} on Wikipedia`}><ServiceIcon name="wiki" /> {w.wikiTitle}</a>
            {w.coin ? <> · <a href={`${EXPLORER}/address/${w.coin}`} target="_blank" rel="noopener noreferrer" title="Word coin contract on Blockscout"><ServiceIcon name="blockscout" text="contract" /></a></> : null}
            {" "}· {w.marketsCount} market{w.marketsCount === 1 ? "" : "s"}
          </p>
          <div className="price-line" style={{ marginTop: 14 }}>
            <span className="big num"><Odometer value={w.price > 0 ? `$${fmtPrice(w.price)}` : "–"} delay={200} /></span>
            <span className="num" style={{ fontWeight: 500 }}><Change value={w.change24h} /></span>
            <span className="cap">vs yesterday</span>
            <span className="cap" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Interest today <Meter value={interestToday} /></span>
          </div>
          <div className="cap num" style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>Reserve <b style={{ color: "var(--ink)" }}>{w.reserveUsdg !== null ? fmtUsd(w.reserveUsdg) : "–"}</b>{w.maxSellable !== null ? ` backs ${fmtCompact(w.maxSellable, 2)} ${w.symbol} at feed` : ""}</span>
            {hist.length > 0 ? <span>30 day avg <b style={{ color: "var(--ink)" }}>${fmtPrice(avg30)}</b></span> : null}
            {hist.length > 0 ? <span>90 day high <b style={{ color: "var(--ink)" }}>${fmtPrice(high90)}</b></span> : null}
            {peak30Day ? <span>30 day peak <b style={{ color: "var(--ink)" }}>{fmtNum(peak30)}</b> views on {dateShort(peak30Day.day)}</span> : null}
          </div>
        </div>

        <div className="info">
          {Icon.info}
          <span>
            {w.updatedAt && w.views !== null
              ? <>Feed pushed {agoLong(w.updatedAt)}. Yesterday the article had {fmtNum(w.views)} views, so {w.symbol} is priced at ${fmtPrice(w.price)} until the next daily update.</>
              : <>No feed pushed for this word yet. Buys and sells open after the first daily update.</>}
          </span>
          <Link href="/docs#word-coins">How pricing works</Link>
        </div>

        <section className="section">
          <div className="section-head"><h2>Interest over time</h2><span className="cap">past 90 days · daily</span></div>
          <div className="chart-stage">
            {hist.length > 1 ? <InterestChart points={points} w={640} xLabels={xl} /> : <div className="empty" style={{ minHeight: 220 }}>Not enough daily readings yet. The chart fills in one point per day.</div>}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Daily views scaled so the 90 day peak equals 100. The price uses raw views.</p>
        </section>

        <section className="section">
          <div className="section-head"><h2>Daily views</h2><span className="cap">past 14 days · <ServiceIcon name="wiki" /></span></div>
          {last14.length === 0 ? (
            <Empty>No daily readings yet.</Empty>
          ) : (
            <div className="scroll scroll-360">
              <table className="tbl compact daily-table">
                <thead><tr><th>Day</th><th className="r">Views</th><th className="r">Price</th><th className="r">Change</th><th className="r">Interest</th></tr></thead>
                <tbody>
                  {last14.map((h, i) => {
                    const prev = last14[i + 1];
                    const c = prev && prev.views > 0 ? ((h.views - prev.views) / prev.views) * 100 : null;
                    return (
                      <tr key={h.day}>
                        <td>{dateShort(h.day)}</td>
                        <td className="r num">{fmtNum(h.views)}</td>
                        <td className="r"><span className="p2 num">${fmtPrice(h.price)}</span></td>
                        <td className="r num"><Change value={c} /></td>
                        <td className="r"><Meter value={peakViews > 0 ? (h.views / peakViews) * 100 : 0} d={i} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-head"><h2>Markets priced in {w.symbol} <span className="cap">{w.markets.length}</span></h2><Link className="cap" href="/launch">Launch with {w.symbol}</Link></div>
          <MarketsTable markets={w.markets} h={360} compact />
        </section>
      </div>
    </Page>
  );
}
