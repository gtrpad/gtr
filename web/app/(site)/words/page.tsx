import type { Metadata } from "next";
import Link from "next/link";
import { listWords } from "@/lib/api";
import { publicSettings } from "@/lib/settings";
import { Page } from "@/components/layout/Page";
import { WordsTable } from "@/components/words/WordsTable";
import { fmtNum } from "@/components/util/format";

export const metadata: Metadata = { title: "Words" };

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort = sp.sort === "price" ? "price" : sp.sort === "markets" ? "markets" : sp.sort === "change" ? "change" : "name";
  const [all, settings] = await Promise.all([listWords(), publicSettings()]);
  let words = q ? all.filter((w) => w.name.includes(q) || w.symbol.toLowerCase().includes(q) || w.slug.includes(q)) : all;
  words = [...words].sort((a, b) => (sort === "price" ? b.price - a.price : sort === "markets" ? b.marketsCount - a.marketsCount : sort === "change" ? (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity) : a.name.localeCompare(b.name)));
  const href = (s: string) => `/words?${new URLSearchParams({ ...(q ? { q } : {}), sort: s }).toString()}`;
  return (
    <Page>
      <div className="stack">
        <div className="intro fu" style={{ ["--d" as string]: 0 }}>
          <h1>Words</h1>
          <p>Price = daily article views ÷ {fmtNum(settings.viewsPerUsd)}, in USDG. Updated once a day. Sell back at the same price while the word&apos;s reserve lasts.</p>
        </div>
        <section className="section fu" style={{ ["--d" as string]: 1 }}>
          <div className="toolbar">
            <form className="search" action="/words" method="get">
              {sort !== "name" ? <input type="hidden" name="sort" value={sort} /> : null}
              <input name="q" defaultValue={q} placeholder="Search words" aria-label="Search words" />
            </form>
            <span className="grow" />
            {(["name", "change", "price", "markets"] as const).map((s) => (
              <Link key={s} className={`chip ${sort === s ? "on" : ""}`} href={href(s)}>
                {s === "name" ? "A to Z" : s === "change" ? "24h change" : s === "price" ? "Price" : "Markets"}
              </Link>
            ))}
          </div>
          <WordsTable words={words} h={520} />
          <div className="list-foot">
            <span>{words.length} of {all.length} words · {all.filter((w) => w.coin).length} with a coin</span>
          </div>
        </section>
      </div>
    </Page>
  );
}
