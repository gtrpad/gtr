/** Mainnet keeper E2E: lower thresholds, pay the FEAR holder pool via Disperse, convert treasury shares, restore. */
import { prisma } from "../lib/db";
import { setSetting, getSetting } from "../lib/settings";
import { previewPayout, executePayout } from "../lib/payouts";
import { convertTreasury } from "../lib/treasury";
import { collectAndSweep } from "../lib/fees";

async function main() {
  const token = "0x81fcb76bc333a47c19268e49e2169b6565ac57a2";
  const saved = { pool: await getSetting("payout_min_pool_usd"), hold: await getSetting("payout_min_holding_usd"), wallet: await getSetting("payout_min_wallet_usd"), exec: await getSetting("execute") };
  await setSetting("payout_min_pool_usd", "0.01");
  await setSetting("payout_min_holding_usd", "0.01");
  await setSetting("payout_min_wallet_usd", "0.001");
  try {
    await collectAndSweep();
    const p = await previewPayout(token);
    console.log("preview", p && { rows: p.rows.map((r) => ({ w: r.wallet, coin: Number(r.amount) / 1e18, usd: r.usd })), payable: Number(p.payable) / 1e18, skipped: p.skipped });
    if (p) console.log("round", await executePayout(p, true));
    await setSetting("execute", "true");
    await convertTreasury();
  } finally {
    await setSetting("payout_min_pool_usd", saved.pool);
    await setSetting("payout_min_holding_usd", saved.hold);
    await setSetting("payout_min_wallet_usd", saved.wallet);
    await setSetting("execute", saved.exec);
  }
  const j = await prisma.journal.findMany({ orderBy: { id: "desc" }, take: 6 });
  for (const r of j.reverse()) console.log(r.kind, r.level, r.message, r.txHash ?? "");
  const hp = await prisma.holderPool.findUnique({ where: { token } });
  const tp = await prisma.treasuryPool.findMany();
  console.log("holderPool", hp && { accrued: Number(hp.accrued) / 1e18, paid: Number(hp.paid) / 1e18 });
  console.log("treasury", tp.map((t) => ({ bb: Number(t.buybackAccrued) / 1e18, bbC: Number(t.buybackConverted) / 1e18, pr: Number(t.protocolAccrued) / 1e18, prC: Number(t.protocolConverted) / 1e18 })), "pending usdg", await getSetting("buyback_usdg_pending"));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
