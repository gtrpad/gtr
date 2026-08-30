import { parseUnits, type Hex } from "viem";
import { prisma } from "./db";
import { getBool, getNum, getSetting } from "./settings";
import { ADDR, abi, keeperClient, publicClient, journal } from "./chain";
import { viewsForDay, yesterdayUtc, dailyViews } from "./wiki";

/** views → USD per coin, as a decimal string */
export async function priceFromViews(views: number): Promise<string> {
  const per = await getNum("word_views_per_usd");
  const floor = await getNum("word_price_floor");
  const p = Math.max(views / per, floor);
  return p.toFixed(6);
}

/** Fetch yesterday's views for every enabled word and store the observation. */
export async function observeAll(day = yesterdayUtc()) {
  const source = await getSetting("oracle_source");
  if (source !== "wikipedia") throw new Error(`oracle source ${source} is not implemented`);
  const words = await prisma.word.findMany({ where: { enabled: true } });
  const out: { wordId: string; views: number; price: string }[] = [];
  for (const w of words) {
    try {
      const views = await viewsForDay(w.wikiTitle, day);
      if (views === null) {
        await journal("oracle", `Нет данных Wikimedia за ${day.toISOString().slice(0, 10)} для «${w.name}» (${w.wikiTitle})`, { level: "warn" });
        continue;
      }
      const price = await priceFromViews(views);
      await prisma.wordPrice.upsert({
        where: { wordId_day: { wordId: w.id, day } },
        create: { wordId: w.id, day, views, price },
        update: { views, price },
      });
      await prisma.word.update({ where: { id: w.id }, data: { lastViews: views, lastPrice: price } });
      out.push({ wordId: w.id, views, price });
    } catch (e) {
      await journal("oracle", `Ошибка Wikimedia для «${w.name}»: ${(e as Error).message}`, { level: "error" });
    }
  }
  return out;
}

/** Push the latest stored price of the given words (default: all deployed) to the feed. */
export async function pushPrices(wordIds?: string[]) {
  if (!(await getBool("oracle_enabled"))) {
    await journal("oracle", "Пуш оракула выключен (oracle_enabled=false)", { level: "warn" });
    return null;
  }
  const wallet = await keeperClient();
  if (!wallet) {
    await journal("oracle", "Нет ключа кипера, пуш пропущен", { level: "error" });
    return null;
  }
  const words = await prisma.word.findMany({
    where: { enabled: true, coin: { not: null }, lastPrice: { not: null }, ...(wordIds ? { id: { in: wordIds } } : {}) },
  });
  if (!words.length) return null;
  const ids = words.map((w) => w.id as Hex);
  const prices = words.map((w) => parseUnits(String(w.lastPrice), 18));
  const hash = await wallet.writeContract({
    address: ADDR.feed,
    abi: abi.feed,
    functionName: "push",
    args: [ids, prices],
  });
  const rc = await publicClient.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") {
    await journal("oracle", `Пуш фида упал: ${hash}`, { level: "error", txHash: hash });
    throw new Error("feed push reverted");
  }
  const now = new Date();
  await prisma.word.updateMany({ where: { id: { in: ids } }, data: { lastPushedAt: now } });
  await prisma.wordPrice.updateMany({
    where: { wordId: { in: ids }, day: yesterdayUtc() },
    data: { pushedTx: hash, pushedAt: now },
  });
  await journal("oracle", `Пуш фида: ${words.length} слов`, {
    txHash: hash,
    meta: words.map((w) => ({ slug: w.slug, views: w.lastViews, price: String(w.lastPrice) })),
  });
  return hash;
}

/** Backfill 90 days of history for a freshly added word (chart + first price). */
export async function backfillWord(wordId: string, days = 90) {
  const w = await prisma.word.findUniqueOrThrow({ where: { id: wordId } });
  const to = yesterdayUtc();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  const rows = await dailyViews(w.wikiTitle, from, to);
  for (const r of rows) {
    const day = new Date(`${r.day}T00:00:00Z`);
    const price = await priceFromViews(r.views);
    await prisma.wordPrice.upsert({
      where: { wordId_day: { wordId, day } },
      create: { wordId, day, views: r.views, price },
      update: { views: r.views, price },
    });
  }
  const last = rows.at(-1);
  if (last) {
    await prisma.word.update({ where: { id: wordId }, data: { lastViews: last.views, lastPrice: await priceFromViews(last.views) } });
  }
  return rows.length;
}
