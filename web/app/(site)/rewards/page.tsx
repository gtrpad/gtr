import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { publicSettings } from "@/lib/settings";
import { Page } from "@/components/layout/Page";
import { RewardsClient } from "@/components/rewards/RewardsClient";
import { fmtNum } from "@/components/util/format";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const s = await publicSettings();
  return (
    <Page>
      <div className="stack rewards-page">
        <div className="intro fu" style={{ ["--d" as string]: 0 }}>
          <h1>Rewards</h1>
          <p>Hold a market and 40% of its trading fees come to you in the word coin it is paired with, every {s.payoutCycleMin} minutes. Nothing to claim. <Link href="/docs#holder-rewards">How it works</Link></p>
        </div>
        <dl className="home-stats fu" style={{ ["--d" as string]: 1 }}>
          {[
            { label: "Share of fees", value: "40%", note: "paid in the word coin", color: "blue" },
            { label: "Pool pays at", value: `$${fmtNum(s.payoutMinPoolUsd)}`, note: "unpaid per market", color: "red" },
            { label: "Counted from", value: `$${fmtNum(s.payoutMinHoldingUsd)}`, note: "held in a market", color: "yellow" },
            { label: "Minimum payout", value: `$${fmtNum(s.payoutMinWalletUsd)}`, note: "per wallet per cycle", color: "green" },
            { label: "Cycle", value: `${s.payoutCycleMin} min`, note: "every market checked", color: "blue" },
          ].map((stat) => (
            <div key={stat.label} className="home-stat">
              <dt><i className={`dot-${stat.color}`} />{stat.label}</dt>
              <dd className="num">{stat.value}</dd>
              <span className="cap">{stat.note}</span>
            </div>
          ))}
        </dl>
        <div className="fu" style={{ ["--d" as string]: 2 }}>
          <Suspense>
            <RewardsClient cycleMin={s.payoutCycleMin} minHoldingUsd={s.payoutMinHoldingUsd} />
          </Suspense>
        </div>
      </div>
    </Page>
  );
}
