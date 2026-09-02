import "server-only";
import type { Hex } from "viem";
import { prisma } from "./db";
import { ADDR, abi, publicClient, ZERO } from "./chain";
import type { Candle, HolderRow, MarketCard, MarketDetail, RewardsView, Stats, TradeRow, WordCard, WordDetail, WordRef } from "./types";
import { excludedWallets } from "./indexer";


/** Prisma Decimal → bigint without exponent notation. */
function big(d: { toFixed: (n: number) => string } | string | number | bigint): bigint {
  if (typeof d === "bigint") return d;
  if (typeof d === "number") return BigInt(Math.round(d));
  if (typeof d === "string") return BigInt(d.includes("e") ? Number(d).toLocaleString("fullwide", { useGrouping: false }) : d);
  return BigInt(d.toFixed(0));
}
const SUPPLY = 1e9;
const CURVE = 800_000_000n * 10n ** 18n;
const n18 = (s: unknown) => Number(s) / 1e18;

type MarketRow = Awaited<ReturnType<typeof prisma.market.findMany<{ include: { word: true } }>>>[number];

function wordRef(w: MarketRow["word"]): WordRef {
  return { id: w.id, slug: w.slug, name: w.name, symbol: w.symbol, coin: w.coin, price: Number(w.lastPrice ?? 0), views: w.lastViews, wikiTitle: w.wikiTitle };
}

async function volume24hByToken(tokens?: string[]): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await prisma.trade.groupBy({
    by: ["token"],
    where: { ts: { gte: since }, ...(tokens ? { token: { in: tokens } } : {}) },
    _sum: { usdValue: true },
  });
  return new Map(rows.map((r) => [r.token, Number(r._sum.usdValue ?? 0)]));
}

function card(m: MarketRow, vol: number): MarketCard {
  const priceCoin = Number(m.lastPriceCoin);
  const wp = Number(m.word.lastPrice ?? 0);
  const sold = CURVE - big(m.curveSupply);
  return {
    token: m.token,
    name: m.name,
    symbol: m.symbol,
    imageUrl: m.imageUrl,
    word: wordRef(m.word),
    priceCoin,
    priceUsd: priceCoin * wp,
    fdvUsd: priceCoin * wp * SUPPLY,
    progress: m.migrated ? 1 : Number(sold) / Number(CURVE),
    migrated: m.migrated,
    volume24hUsd: vol,
    createdAt: m.createdAt.toISOString(),
    feeBps: m.feeBps,
    creator: m.creator,
  };
}

export async function listMarkets(opts: { filter?: "all" | "new" | "migrated" | "curve"; word?: string; q?: string; sort?: "volume" | "new" | "fdv"; limit?: number } = {}): Promise<MarketCard[]> {
  const where = {
    hidden: false,
    ...(opts.filter === "migrated" ? { migrated: true } : {}),
    ...(opts.filter === "curve" ? { migrated: false } : {}),
    ...(opts.word ? { word: { slug: opts.word } } : {}),
    ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" as const } }, { symbol: { contains: opts.q, mode: "insensitive" as const } }] } : {}),
  };
  const rows = await prisma.market.findMany({ where, include: { word: true }, orderBy: { createdAt: "desc" }, take: opts.filter === "new" ? opts.limit ?? 8 : 500 });
  const vol = await volume24hByToken(rows.map((r) => r.token));
  let cards = rows.map((m) => card(m, vol.get(m.token) ?? 0));
  const sort = opts.sort ?? (opts.filter === "new" ? "new" : "volume");
  if (sort === "volume") cards.sort((a, b) => b.volume24hUsd - a.volume24hUsd || b.fdvUsd - a.fdvUsd);
  if (sort === "fdv") cards.sort((a, b) => b.fdvUsd - a.fdvUsd);
  if (opts.limit) cards = cards.slice(0, opts.limit);
  return cards;
}

export async function getMarket(token: string): Promise<MarketDetail | null> {
  const m = await prisma.market.findUnique({ where: { token: token.toLowerCase() }, include: { word: true, holderPool: true } });
  if (!m || m.hidden) return null;
  const vol = await volume24hByToken([m.token]);
  const c = card(m, vol.get(m.token) ?? 0);
  const excluded = await excludedWallets();
  const holdersRows = await prisma.holderBalance.findMany({ where: { token: m.token, balance: { gt: 0 } }, select: { wallet: true } });
  const holders = holdersRows.filter((h) => !excluded.has(h.wallet)).length;
  const trades = await prisma.trade.findMany({ where: { token: m.token }, orderBy: [{ ts: "desc" }, { logIndex: "desc" }], take: 60 });
  const lastRound = await prisma.payoutRound.findFirst({ where: { token: m.token, status: "sent" }, orderBy: { createdAt: "desc" } });
  const wp = c.word.price;
  const accrued = big(m.holderPool?.accrued ?? "0");
  const paid = big(m.holderPool?.paid ?? "0");
  const unpaid = accrued - paid;
  return {
    ...c,
    description: m.description,
    website: m.website,
    twitter: m.twitter,
    telegram: m.telegram,
    coin: m.coin,
    poolId: m.poolId,
    raised: m.raised.toFixed(0),
    curveSupply: m.curveSupply.toFixed(0),
    holders,
    feesTotalCoin: m.totalFeesCoin.toFixed(0),
    feesTotalUsd: n18(m.totalFeesCoin) * wp,
    holderPool: { accrued: accrued.toString(), paid: paid.toString(), unpaid: unpaid.toString(), unpaidUsd: n18(unpaid) * wp },
    lastPayout: lastRound
      ? { ts: lastRound.createdAt.toISOString(), totalCoin: lastRound.totalCoin.toFixed(0), totalUsd: Number(lastRound.totalUsd), wallets: lastRound.wallets, txHash: lastRound.txHash }
      : null,
    trades: trades.map(tradeRow),
    uri: m.uri,
  };
}

function tradeRow(t: { txHash: string; ts: Date; trader: string; isBuy: boolean; venue: string; tokenAmount: unknown; quoteAmount: unknown; usdValue: unknown; priceCoin: unknown }): TradeRow {
  return {
    txHash: t.txHash,
    ts: t.ts.toISOString(),
    trader: t.trader,
    isBuy: t.isBuy,
    venue: t.venue as "curve" | "pool",
    tokenAmount: String(t.tokenAmount),
    quoteAmount: String(t.quoteAmount),
    usdValue: Number(t.usdValue),
    priceCoin: Number(t.priceCoin),
  };
}

export async function getCandles(token: string, tf: "1m" | "5m" | "1h" | "1d" = "5m", limit = 300): Promise<Candle[]> {
  const sec = { "1m": 60, "5m": 300, "1h": 3600, "1d": 86400 }[tf];
  const since = new Date(Date.now() - sec * limit * 1000);
  const rows = await prisma.trade.findMany({ where: { token: token.toLowerCase(), ts: { gte: since } }, orderBy: [{ ts: "asc" }, { logIndex: "asc" }] });
  const out: Candle[] = [];
  for (const r of rows) {
    const t = Math.floor(r.ts.getTime() / 1000 / sec) * sec;
    const p = Number(r.priceCoin);
    const pu = Number(r.priceUsd);
    const v = Number(r.usdValue);
    const last = out.at(-1);
    if (last && last.t === t) {
      last.h = Math.max(last.h, p);
      last.l = Math.min(last.l, p);
      last.c = p;
      last.cUsd = pu;
      last.v += v;
    } else {
      out.push({ t, o: last ? last.c : p, h: p, l: p, c: p, cUsd: pu, v });
    }
  }
  return out;
}

export async function getHolders(token: string, limit = 50): Promise<HolderRow[]> {
  const excluded = await excludedWallets();
  const rows = await prisma.holderBalance.findMany({ where: { token: token.toLowerCase(), balance: { gt: 0 } }, orderBy: { balance: "desc" }, take: limit + excluded.size });
  const total = 1e9 * 1e18;
  return rows
    .filter((r) => !excluded.has(r.wallet))
    .slice(0, limit)
    .map((r) => ({ wallet: r.wallet, balance: r.balance.toFixed(0), pct: (Number(r.balance) / total) * 100 }));
}

async function wordCards(where: object): Promise<WordCard[]> {
  const words = await prisma.word.findMany({ where: { hidden: false, ...where }, orderBy: { name: "asc" }, include: { _count: { select: { markets: { where: { hidden: false } } } } } });
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 31);
  const prices = await prisma.wordPrice.findMany({ where: { wordId: { in: words.map((w) => w.id) }, day: { gte: since } }, orderBy: { day: "asc" } });
  const byWord = new Map<string, number[]>();
  for (const p of prices) {
    const arr = byWord.get(p.wordId) ?? [];
    arr.push(Number(p.price));
    byWord.set(p.wordId, arr);
  }
  return words.map((w) => {
    const spark = (byWord.get(w.id) ?? []).slice(-30);
    const prev = spark.length >= 2 ? spark[spark.length - 2] : null;
    const cur = Number(w.lastPrice ?? 0);
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      symbol: w.symbol,
      coin: w.coin,
      price: cur,
      views: w.lastViews,
      wikiTitle: w.wikiTitle,
      change24h: prev ? ((cur - prev) / prev) * 100 : null,
      marketsCount: w._count.markets,
      spark,
      updatedAt: w.lastPushedAt?.toISOString() ?? null,
    };
  });
}

export async function listWords(): Promise<WordCard[]> {
  return wordCards({});
}

export async function getWord(slug: string): Promise<WordDetail | null> {
  const w = await prisma.word.findUnique({ where: { slug } });
  if (!w || w.hidden) return null;
  const [cardRow] = await wordCards({ slug });
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  const history = await prisma.wordPrice.findMany({ where: { wordId: w.id, day: { gte: since } }, orderBy: { day: "asc" } });
  const markets = await listMarkets({ word: slug, sort: "volume" });
  let reserveUsdg: number | null = null;
  let maxSellable: number | null = null;
  let totalSupply: number | null = null;
  if (w.coin && ADDR.vault !== ZERO) {
    try {
      const [wordOnChain, ms, ts] = await Promise.all([
        publicClient.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "words", args: [w.id as Hex] }) as Promise<[string, bigint, boolean]>,
        publicClient.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "maxSellable", args: [w.id as Hex] }).catch(() => null) as Promise<bigint | null>,
        publicClient.readContract({ address: w.coin as Hex, abi: abi.wordCoin, functionName: "totalSupply" }) as Promise<bigint>,
      ]);
      reserveUsdg = Number(wordOnChain[1]) / 1e6;
      maxSellable = ms === null ? null : Number(ms) / 1e18;
      totalSupply = Number(ts) / 1e18;
    } catch {
      /* chain read failed: leave nulls */
    }
  }
  return {
    ...cardRow,
    history: history.map((h) => ({ day: h.day.toISOString().slice(0, 10), views: h.views, price: Number(h.price) })),
    markets,
    reserveUsdg,
    maxSellable,
    totalSupply,
  };
}

export async function getStats(): Promise<Stats> {
  const [markets, migrated, words, vol, tvlRows, feeRows, paid] = await Promise.all([
    prisma.market.count({ where: { hidden: false } }),
    prisma.market.count({ where: { hidden: false, migrated: true } }),
    prisma.word.count({ where: { hidden: false, coin: { not: null } } }),
    prisma.trade.aggregate({ where: { ts: { gte: new Date(Date.now() - 86400_000) } }, _sum: { usdValue: true } }),
    prisma.market.findMany({ where: { hidden: false }, select: { raised: true, word: { select: { lastPrice: true } } } }),
    prisma.market.findMany({ where: { hidden: false }, select: { totalFeesCoin: true, word: { select: { lastPrice: true } } } }),
    prisma.payout.aggregate({ _sum: { usd: true }, _count: { wallet: true } }),
  ]);
  const distinctWallets = await prisma.payout.findMany({ distinct: ["wallet"], select: { wallet: true } });
  return {
    markets,
    migrated,
    words,
    volume24hUsd: Number(vol._sum.usdValue ?? 0),
    valueLockedUsd: tvlRows.reduce((s, r) => s + n18(r.raised) * Number(r.word.lastPrice ?? 0), 0),
    feesUsd: feeRows.reduce((s, r) => s + n18(r.totalFeesCoin) * Number(r.word.lastPrice ?? 0), 0),
    paidUsd: Number(paid._sum.usd ?? 0),
    paidWallets: distinctWallets.length,
  };
}

export async function getRewards(wallet: string): Promise<RewardsView> {
  const w = wallet.toLowerCase();
  const payouts = await prisma.payout.findMany({ where: { wallet: w }, orderBy: { createdAt: "desc" }, take: 100, include: { round: { include: { market: { include: { word: true } } } } } });
  const balances = await prisma.holderBalance.findMany({ where: { wallet: w, balance: { gt: 0 } }, include: { market: { include: { word: true, holderPool: true } } } });
  const pending: RewardsView["pending"] = [];
  for (const b of balances) {
    const m = b.market;
    if (m.hidden || !m.holderPool) continue;
    const unpaid = big(m.holderPool.accrued) - big(m.holderPool.paid);
    if (unpaid <= 0n) continue;
    const total = await prisma.holderBalance.aggregate({ where: { token: m.token, balance: { gt: 0 } }, _sum: { balance: true } });
    const sum = Number(total._sum.balance ?? 0);
    if (!sum) continue;
    const share = Number(b.balance) / sum;
    const est = Number(unpaid) * share;
    pending.push({ token: m.token, symbol: m.symbol, coinSymbol: m.word.symbol, coin: m.coin, estimateCoin: BigInt(Math.floor(est)).toString(), estimateUsd: (est / 1e18) * Number(m.word.lastPrice ?? 0), sharePct: share * 100 });
  }
  const coins = await prisma.word.findMany({ where: { hidden: false, coin: { not: null } }, select: { coin: true, symbol: true, slug: true, lastPrice: true } });
  return {
    wallet: w,
    totalUsd: payouts.reduce((s, p) => s + Number(p.usd), 0),
    payouts: payouts.map((p) => ({ ts: p.createdAt.toISOString(), token: p.round.token, symbol: p.round.market.symbol, coinSymbol: p.round.market.word.symbol, coin: p.coin, amount: p.amount.toFixed(0), usd: Number(p.usd), txHash: p.txHash })),
    pending,
    coins: coins.map((c) => ({ coin: c.coin!, symbol: c.symbol, slug: c.slug, price: Number(c.lastPrice ?? 0) })),
  };
}
