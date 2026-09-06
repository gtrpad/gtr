import Link from "next/link";
import { Suspense } from "react";
import { getStats, listMarkets, listWords, getCandles } from "@/lib/api";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Page } from "@/components/layout/Page";
import { LiveMarkets } from "@/components/markets/LiveMarkets";
import { HeroCards } from "@/components/home/HeroCards";
import { Odometer } from "@/components/motion/Odometer";
import { MarketFilters } from "@/components/markets/MarketFilters";
import { WordsTable } from "@/components/words/WordsTable";
import { fmtUsd, fmtNum } from "@/components/util/format";

type SP = { filter?: string; sort?: string; q?: string; word?: string };
const FILTERS = new Set(["all", "curve", "migrated"]);
const SORTS = new Set(["volume", "new", "fdv"]);

export default async function MarketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filter = (FILTERS.has(sp.filter ?? "") ? sp.filter : "all") as "all" | "curve" | "migrated";
  const sort = (SORTS.has(sp.sort ?? "") ? sp.sort : "volume") as "volume" | "new" | "fdv";
  const q = (sp.q ?? "").trim() || undefined;
  const word = (sp.word ?? "").trim() || undefined;
  const [stats, markets, words, fresh, all] = await Promise.all([getStats(), listMarkets({ filter, sort, q, word }), listWords(), listMarkets({ filter: "new", limit: 4 }), listMarkets({ sort: "new" })]);
  // 24h sparklines: hourly closes, only for the rows on screen
  const sparkTokens = Array.from(new Set([...markets.slice(0, 40), ...fresh].map((m) => m.token)));
  const sparks: Record<string, number[]> = {};
  await Promise.all(sparkTokens.map(async (t) => { try { sparks[t] = (await getCandles(t, "1h", 24)).map((c) => c.c); } catch { sparks[t] = []; } }));
  const newWords = [...words].filter((w) => w.coin).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 5);

  return (
    <Page>
      <div className="stack home-dashboard">
        <div className="hero fu" style={{ ["--d" as string]: 0 }}>
          <h1>
            Markets that move with <span className="mark">attention</span>
          </h1>
          <p>Launch a token priced in a word coin. The coin follows how many people read about the word each day, so every market paired with it moves with attention.</p>
          <div className="cta">
            <Link className="btn primary" href="/launch">Launch a market</Link>
            <Link className="btn" href="/words">Browse words</Link>
          </div>
        </div>

        <HeroCards markets={all} words={words} />

        <dl className="home-stats fu" style={{ ["--d" as string]: 1 }}>
          {[
            { label: "Markets", value: fmtNum(stats.markets), note: `${fmtNum(stats.migrated)} migrated`, color: "blue" },
            { label: "Words", value: fmtNum(stats.words), note: "Attention coins", color: "red" },
            { label: "24h volume", value: fmtUsd(stats.volume24hUsd), note: "Across all markets", color: "yellow" },
            { label: "Value locked", value: fmtUsd(stats.valueLockedUsd), note: "At current prices", color: "green" },
            { label: "Fees collected", value: fmtUsd(stats.feesUsd), note: "All time", color: "blue" },
            { label: "Paid to holders", value: fmtUsd(stats.paidUsd), note: `${fmtNum(stats.paidWallets)} wallet${stats.paidWallets === 1 ? "" : "s"}`, color: "red" },
          ].map((stat, i) => (
            <div key={stat.label} className="home-stat">
              <dt><i className={`dot-${stat.color}`} />{stat.label}</dt>
              <dd className="num"><Odometer value={stat.value} delay={i * 55} /></dd>
              <span className="cap">{stat.note}</span>
            </div>
          ))}
        </dl>

        <div className="steps home-steps fu" style={{ ["--d" as string]: 2 }}>
          <div><i className="dot-blue" /><b>Launch</b><p>Every market opens at a $5,000 cap on a virtual curve, priced in the word coin you pick. Supply 1,000,000,000, no creator share.</p></div>
          <div><i className="dot-red" /><b>Migrate</b><p>At a $35,000 cap the raised coin and the reserved 200M supply move into a <ServiceIcon name="uniswap" /> v4 pool the launchpad holds forever.</p></div>
          <div><i className="dot-green" /><b>Fees</b><p>40% of every fee goes to holders in the word coin every 15 minutes. 30% buys back and burns the exchange coin. 30% runs the exchange.</p></div>
        </div>

        {fresh.length > 0 ? (
          <section className="section home-panel fu" style={{ ["--d" as string]: 3 }}>
            <div className="section-head"><h2>New launches</h2><span className="cap">newest first · live</span></div>
            <LiveMarkets initial={fresh} query={{ filter: "new", limit: 4 }} h={240} compact sparks={sparks} />
          </section>
        ) : null}

        <section className="section home-panel fu" style={{ ["--d" as string]: 4 }}>
          <div className="section-head">
            <h2>Markets <span className="cap">{markets.length} · live</span></h2>
          </div>
          <Suspense>
            <MarketFilters words={words.map((w) => ({ slug: w.slug, name: w.name, symbol: w.symbol }))} />
          </Suspense>
          <LiveMarkets initial={markets} query={{ filter, sort, q, word }} h={520} sparks={sparks} />
        </section>

        <section className="section home-panel fu" style={{ ["--d" as string]: 5 }}>
          <div className="section-head">
            <h2>New words</h2>
            <Link href="/words" className="cap">All words</Link>
          </div>
          <WordsTable words={newWords} h={360} compact />
        </section>
      </div>
    </Page>
  );
}
