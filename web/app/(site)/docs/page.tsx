import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicSettings } from "@/lib/settings";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Address } from "@/components/ui/Address";
import { FeeSplit } from "@/components/ui/Primitives";
import { DocsToc } from "@/components/docs/DocsToc";
import { fmtNum } from "@/components/util/format";

export const metadata: Metadata = { title: "Docs" };

const TOC: [string, string][] = [
  ["overview", "Overview"], ["word-coins", "Word coins"], ["attention-index", "Attention index"], ["launching", "Launching"], ["curve-and-caps", "Curve and caps"],
  ["migration", "Migration"], ["trading", "Trading and routing"], ["fees", "Fees"], ["holder-rewards", "Holder rewards"], ["exchange-coin", "The exchange coin"],
  ["keeper", "The keeper"], ["honest-limits", "Honest limits"], ["contracts", "Contracts"], ["faq", "FAQ"],
];

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const n = TOC.findIndex(([k]) => k === id) + 1;
  return (
    <section id={id} className="doc-sec">
      <h2><span className="n">{String(n).padStart(2, "0")}</span>{title}</h2>
      <div className="body">{children}</div>
    </section>
  );
}

const ZERO = "0x0000000000000000000000000000000000000000";
function Contract({ name, addr }: { name: string; addr?: string }) {
  const ok = addr && addr !== ZERO && /^0x[0-9a-fA-F]{40}$/.test(addr);
  return (
    <div className="kv">
      <span>{name}</span>
      {ok ? (
        <Address value={addr!} />
      ) : (
        <b className="muted" style={{ fontWeight: 400 }}>not deployed yet</b>
      )}
    </div>
  );
}

export default async function DocsPage() {
  const s = await publicSettings();
  const env = process.env;
  return (
    <div className="wrap docs">
      <div className="docs-sidebar fu" style={{ ["--d" as string]: 0 }}>
        <DocsToc items={TOC} />
      </div>
      <div>
        <div className="intro fu" style={{ ["--d" as string]: 1 }}>
          <span className="guide-label">THE GTR GUIDE</span>
          <h1>From attention to a market.</h1>
          <p>
            A launchpad on <ServiceIcon name="rhc" /> where every token is priced in a word coin instead of a stablecoin. Markets trade on a curve, migrate into a <ServiceIcon name="uniswap" /> v4 pool, and pay holders in the word coin they are paired with. Source on{" "}
            <a href="https://github.com/gtrpad/gtr" target="_blank" rel="noopener noreferrer"><ServiceIcon name="github" /></a>.
          </p>
        </div>
        <div className="docs-path">
          <Link href="#word-coins"><span>01 · UNDERSTAND</span><b>Meet the word coin</b><p>How article views become a price.</p></Link>
          <Link href="#launching"><span>02 · CREATE</span><b>Launch your market</b><p>From the first trade to a permanent pool.</p></Link>
          <Link href="#holder-rewards"><span>03 · EARN</span><b>Follow the fees</b><p>How holders receive their share.</p></Link>
        </div>
        <div className="fu" style={{ marginTop: 28, ["--d" as string]: 2 }}>

        <Sec id="overview" title="Overview">
          <p>Pick a word from the catalogue. Launch a token priced in that word&apos;s coin. Trade it on a virtual curve until it reaches the migration cap, then in a permanent pool. Every trade pays a fee. 40% of the fee goes to holders in the word coin, 30% buys and burns the exchange coin, 30% runs the exchange.</p>
          <p>Holding a market means holding two things at once: the meme, and the attention to the word behind it.</p>
        </Sec>
        <Sec id="word-coins" title="Word coins">
          <p>Each word in the catalogue has an ERC-20 coin with 18 decimals. Its price is not set by trading. It is set by a feed: <b>price = daily article views ÷ {fmtNum(s.viewsPerUsd)}, in USDG</b>, with a floor of $0.001. The feed is updated once a day.</p>
          <p>The PegVault mints coins when you buy with USDG at the feed price. It burns coins when you sell and pays USDG at the feed price, from the reserve collected for that word. A coin is redeemable only up to what that coin has collected. The feed goes stale after 36 hours without an update, and buys and sells pause until it is pushed again.</p>
        </Sec>
        <Sec id="attention-index" title="Attention index">
          <p>The feed reads the number of views of the word&apos;s <ServiceIcon name="wiki" /> article for the last full UTC day, from the public Wikimedia REST API. The keeper pushes it on chain once a day after the previous day is published.</p>
          <p>The 0 to 100 &quot;interest&quot; shown on charts is a reading aid: views scaled so the recent peak equals 100. Prices use raw views.</p>
          <p>The catalogue is curated. Each word maps to one article title chosen by the operator. Article selection is controlled; the underlying view counts can still fluctuate or be manipulated.</p>
        </Sec>
        <Sec id="launching" title="Launching">
          <p>Anyone can launch. Pick a name, a ticker and an image, choose the word to pair with, set the trading fee at 1%, 2% or 3%, and optionally make a first buy in ETH or USDG in the same transaction. The launch itself costs gas only.</p>
          <p>Name, image and links are stored as token metadata. The creator has no special powers after launch: no fee share, no admin keys, no way to pull liquidity.</p>
        </Sec>
        <Sec id="curve-and-caps" title="Curve and caps">
          <div className="docs-milestones"><div><span>Opening cap</span><b>$5,000</b></div><span aria-hidden="true">→</span><div><span>Migration cap</span><b>$35,000</b></div><span aria-hidden="true">→</span><div><span>Destination</span><b>Uniswap v4</b></div></div>
          <p>Supply is fixed at 1,000,000,000. 800,000,000 sell on the curve, 200,000,000 are reserved for the pool at migration.</p>
          <p>Markets open at a $5,000 cap and migrate at a $35,000 cap. Both caps are converted to the word coin at the feed price when the market is created and then fixed in the coin. If the word&apos;s price doubles the next day, the market is worth twice as much in USD without a single trade.</p>
          <p>The curve is constant product with virtual reserves. Selling the whole curve raises about 2.117 times the opening cap in the word coin.</p>
        </Sec>
        <Sec id="migration" title="Migration">
          <p>When the last curve token sells, the market migrates in the same transaction. The raised word coin and the reserved 200M tokens go into a <ServiceIcon name="uniswap" /> v4 pool with no hook. The creator&apos;s fee choice becomes the pool&apos;s LP fee. The launchpad holds the position forever. There is no withdraw function.</p>
        </Sec>
        <Sec id="trading" title="Trading and routing">
          <div className="docs-route" aria-label="Trading route"><span>ETH</span><i>→</i><span>USDG</span><i>→</i><span>Word coin</span><i>→</i><span>Market</span></div>
          <p>You can pay with ETH, USDG or the word coin itself. The router does the hops in one transaction: ETH to USDG on the ETH/USDG pool, USDG to the word coin through the PegVault, then the word coin into the curve or the v4 pool. Sells run the same path in reverse. Paying with USDG skips the first hop, paying with the word coin skips the first two.</p>
          <p>Quotes show the expected output. Slippage protection defaults to 1% and can be set to 0.5% or 2%.</p>
        </Sec>
        <Sec id="fees" title="Fees">
          <p>Every trade pays the market&apos;s fee, 1% to 3%, chosen at launch. On the curve the fee is taken in the word coin. In the pool it accrues as LP fees in both tokens, and the keeper sells the meme side for the word coin when it collects.</p>
          <FeeSplit maxWidth={420} />
          <div className="legend">
            <span><i style={{ background: "var(--purple)" }} />40% holders</span>
            <span><i style={{ background: "#8ab4f8" }} />30% exchange coin buyback and burn</span>
            <span><i style={{ background: "var(--tp-outline)" }} />30% exchange</span>
          </div>
          <p>There is no creator share. Creators are paid the same way as anyone else: by holding.</p>
        </Sec>
        <Sec id="holder-rewards" title="Holder rewards">
          <p>Every {s.payoutCycleMin} minutes the keeper collects fees, reads holder balances from its own index of Transfer events, and pays each holder their share in the word coin. A market pays out once it has at least ${fmtNum(s.payoutMinPoolUsd)} unpaid. A wallet is counted if it holds at least ${fmtNum(s.payoutMinHoldingUsd)} and gets paid if its share is at least ${fmtNum(s.payoutMinWalletUsd)}. The launchpad, the pool and protocol addresses are excluded.</p>
          <p>Nothing to claim. Rewards land in your wallet as word coins, which you can hold or sell for USDG on the Rewards page.</p>
        </Sec>
        <Sec id="exchange-coin" title="The exchange coin">
          <p>30% of fees buy the exchange coin on its pool and burn it. Until the coin is launched, this share is held in ETH in the treasury.</p>
        </Sec>
        <Sec id="keeper" title="The keeper">
          <p>The keeper is a server wallet that pushes the daily feed, collects fees from the curve and the pools, and runs the payout cycle. Payouts and buybacks can be paused by the operator, and the site shows a banner when trading is paused.</p>
        </Sec>
        <Sec id="honest-limits" title="Honest limits">
          <p>Selling a word coin pays from the USDG collected for that word. If everyone sells at once after the price rises, the reserve can run out and sells wait for new buys. The feed is one source, daily, and can lag or go stale. Article views are a proxy for attention and can be gamed in the short term. Attention is not a cash flow.</p>
        </Sec>
        <Sec id="contracts" title="Contracts">
          <div>
            <Contract name="PegVault" addr={env.NEXT_PUBLIC_ADDR_VAULT} />
            <Contract name="Launchpad" addr={env.NEXT_PUBLIC_ADDR_LAUNCHPAD} />
            <Contract name="Router" addr={env.NEXT_PUBLIC_ADDR_ROUTER} />
            <Contract name="AttentionFeed" addr={env.NEXT_PUBLIC_ADDR_FEED} />
            <Contract name="Buyback" addr={env.NEXT_PUBLIC_ADDR_BUYBACK} />
            <Contract name="USDG" addr="0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" />
            <Contract name="Exchange coin" addr={s.trendToken ?? undefined} />
          </div>
        </Sec>
        <Sec id="faq" title="FAQ">
          <details className="faq"><summary>Do I need to claim rewards?</summary><p>No. The keeper sends word coins automatically when the market and wallet meet the payout thresholds. A cycle does not guarantee a payment.</p></details>
          <details className="faq"><summary>Why did my market go up in USD with no trades?</summary><p>Its word coin got more views yesterday. The curve price in the coin did not move, the coin did.</p></details>
          <details className="faq"><summary>Can I always sell a word coin back?</summary><p>At the feed price, as long as that word&apos;s reserve covers it. The reserve is shown on every word page.</p></details>
          <details className="faq"><summary>What happens if the feed is not updated?</summary><p>After 36 hours the coin is stale and the vault pauses buys and sells until the next push. Markets keep trading in the coin.</p></details>
          <details className="faq"><summary>Which chain?</summary><p><ServiceIcon name="rhc" />, chain id 4663. Transactions are visible on <ServiceIcon name="blockscout" />.</p></details>
        </Sec>
        </div>
      </div>
    </div>
  );
}
