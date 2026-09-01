import { prisma } from "../lib/db";
import { journal } from "../lib/chain";
import { getBool, getNum } from "../lib/settings";
import { indexOnce } from "../lib/indexer";
import { observeAll, pushPrices } from "../lib/oracle";
import { collectAndSweep } from "../lib/fees";
import { runPayouts } from "../lib/payouts";
import { convertTreasury } from "../lib/treasury";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function indexerLoop() {
  for (;;) {
    try {
      let r = await indexOnce();
      while (r && r.to - r.from + 1n >= 4000n) {
        log(`indexed ${r.from}-${r.to} (${r.logs} logs)`);
        r = await indexOnce();
      }
    } catch (e) {
      log("indexer error", (e as Error).message);
      await sleep(5000);
    }
    await sleep(4000);
  }
}

/** Daily oracle: observe yesterday's views and push, once per UTC day at the configured hour. */
async function oracleLoop() {
  for (;;) {
    try {
      const hour = await getNum("oracle_push_hour_utc");
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const last = await prisma.indexerState.findUnique({ where: { key: "oracleDay" } });
      if (now.getUTCHours() >= hour && last?.value !== today && (await getBool("oracle_enabled"))) {
        const obs = await observeAll();
        if (obs.length) {
          await pushPrices();
          await prisma.indexerState.upsert({ where: { key: "oracleDay" }, create: { key: "oracleDay", value: today }, update: { value: today } });
          log(`oracle pushed ${obs.length} words`);
        } else {
          log("oracle: no observations yet, retrying later");
        }
      }
    } catch (e) {
      log("oracle error", (e as Error).message);
      await journal("oracle", `Ошибка цикла оракула: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
    }
    await sleep(60_000);
  }
}

/** Fee cycle: collect + sweep, pay holders, convert treasury shares, buyback. */
async function feeLoop() {
  for (;;) {
    const cycleMin = await getNum("payout_cycle_min");
    try {
      await collectAndSweep();
      await runPayouts();
      await convertTreasury();
    } catch (e) {
      log("fee cycle error", (e as Error).message);
      await journal("fees", `Ошибка цикла: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
    }
    await sleep(Math.max(1, cycleMin) * 60_000);
  }
}

async function main() {
  log("worker starting");
  await journal("indexer", "Воркер запущен");
  await Promise.all([indexerLoop(), oracleLoop(), feeLoop()]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
