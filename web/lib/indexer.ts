import { parseAbiItem, type Address, type Hex } from "viem";
import { prisma } from "./db";
import { ADDR, DEPLOY_BLOCK, abi, publicClient, journal, ZERO } from "./chain";
import { getSetting } from "./settings";


/** Prisma Decimal → bigint without exponent notation. */
function big(d: { toFixed: (n: number) => string } | string | number | bigint): bigint {
  if (typeof d === "bigint") return d;
  if (typeof d === "number") return BigInt(Math.round(d));
  if (typeof d === "string") return BigInt(d.includes("e") ? Number(d).toLocaleString("fullwide", { useGrouping: false }) : d);
  return BigInt(d.toFixed(0));
}
const STEP = 4_000n;
const CURVE_SUPPLY = 800_000_000n * 10n ** 18n;

const swapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

type MarketRef = { token: string; coin: string; poolId: string | null };
type Item = { block: bigint; index: number; kind: "pad" | "swap" | "transfer"; log: unknown };

const blockTs = new Map<bigint, Date>();
async function tsOf(block: bigint): Promise<Date> {
  const hit = blockTs.get(block);
  if (hit) return hit;
  const b = await publicClient.getBlock({ blockNumber: block });
  const d = new Date(Number(b.timestamp) * 1000);
  blockTs.set(block, d);
  if (blockTs.size > 5000) blockTs.clear();
  return d;
}

async function lastBlock(): Promise<bigint> {
  const row = await prisma.indexerState.findUnique({ where: { key: "lastBlock" } });
  return row ? BigInt(row.value) : DEPLOY_BLOCK;
}

async function setLastBlock(b: bigint) {
  await prisma.indexerState.upsert({ where: { key: "lastBlock" }, create: { key: "lastBlock", value: b.toString() }, update: { value: b.toString() } });
}

const dec = (v: bigint | number | string) => (typeof v === "bigint" ? v.toString() : big(v).toString());
const lc = (s: string) => s.toLowerCase();

export async function excludedWallets(): Promise<Set<string>> {
  const extra = (await getSetting("exclude_wallets")).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return new Set<string>(
    [ADDR.launchpad, ADDR.router, ADDR.poolManager, ADDR.vault, ADDR.buyback, ADDR.disperse, ZERO, "0x000000000000000000000000000000000000dead", ...extra].map(lc),
  );
}

async function loadMarkets(): Promise<MarketRef[]> {
  return prisma.market.findMany({ select: { token: true, coin: true, poolId: true } });
}

/** One indexer pass: pulls every relevant log since the last processed block. */
export async function indexOnce(): Promise<{ from: bigint; to: bigint; logs: number } | null> {
  if (ADDR.launchpad === ZERO) return null;
  const head = await publicClient.getBlockNumber();
  const from = (await lastBlock()) + 1n;
  if (from > head) return null;
  const to = from + STEP - 1n > head ? head : from + STEP - 1n;

  let markets = await loadMarkets();
  const tokens = markets.map((m) => m.token as Address);
  const poolIds = markets.filter((m) => m.poolId).map((m) => m.poolId as Hex);

  const padLogs = await publicClient.getContractEvents({ address: ADDR.launchpad, abi: abi.launchpad, fromBlock: from, toBlock: to });
  const routerLogs = await publicClient.getContractEvents({ address: ADDR.router, abi: abi.router, fromBlock: from, toBlock: to });
  const swapLogs = poolIds.length
    ? await publicClient.getLogs({ address: ADDR.poolManager, event: swapEvent, args: { id: poolIds }, fromBlock: from, toBlock: to })
    : [];
  const transferLogs = tokens.length ? await publicClient.getLogs({ address: tokens, event: transferEvent, fromBlock: from, toBlock: to }) : [];

  const traderByTx = new Map<string, string>();
  for (const l of routerLogs as unknown as PadLog[]) {
    if (l.eventName === "Buy" || l.eventName === "Sell") {
      const a = l.args as { from: Address };
      traderByTx.set(lc(l.transactionHash), lc(a.from));
    }
  }

  const items: Item[] = [
    ...padLogs.map((l) => ({ block: l.blockNumber!, index: l.logIndex!, kind: "pad" as const, log: l })),
    ...swapLogs.map((l) => ({ block: l.blockNumber!, index: l.logIndex!, kind: "swap" as const, log: l })),
    ...transferLogs.map((l) => ({ block: l.blockNumber!, index: l.logIndex!, kind: "transfer" as const, log: l })),
  ].sort((a, b) => (a.block === b.block ? a.index - b.index : a.block < b.block ? -1 : 1));

  let changedAny = false;
  for (const it of items) {
    if (it.kind === "pad") {
      const changed = await handlePadEvent(it.log as PadLog, traderByTx);
      if (changed) {
        markets = await loadMarkets();
        changedAny = true;
      }
    } else if (it.kind === "swap") {
      await handleSwap(it.log as SwapLog, markets, traderByTx);
    } else {
      await handleTransfer(it.log as TransferLog, markets);
    }
  }

  // Tokens and pools that appeared inside this range were not in the log filters
  // above: fetch their transfers and swaps for the same range now.
  let extra = 0;
  if (changedAny) {
    const newTokens = markets.map((m) => m.token as Address).filter((t) => !tokens.includes(t));
    const newPools = markets.filter((m) => m.poolId).map((m) => m.poolId as Hex).filter((p) => !poolIds.includes(p));
    const moreT = newTokens.length ? await publicClient.getLogs({ address: newTokens, event: transferEvent, fromBlock: from, toBlock: to }) : [];
    const moreS = newPools.length ? await publicClient.getLogs({ address: ADDR.poolManager, event: swapEvent, args: { id: newPools }, fromBlock: from, toBlock: to }) : [];
    const more: Item[] = [
      ...moreT.map((l) => ({ block: l.blockNumber!, index: l.logIndex!, kind: "transfer" as const, log: l })),
      ...moreS.map((l) => ({ block: l.blockNumber!, index: l.logIndex!, kind: "swap" as const, log: l })),
    ].sort((a, b) => (a.block === b.block ? a.index - b.index : a.block < b.block ? -1 : 1));
    for (const it of more) {
      if (it.kind === "swap") await handleSwap(it.log as SwapLog, markets, traderByTx);
      else await handleTransfer(it.log as TransferLog, markets);
    }
    extra = more.length;
  }

  await setLastBlock(to);
  return { from, to, logs: items.length + extra };
}

type PadLog = { eventName: string; args: Record<string, unknown>; blockNumber: bigint; logIndex: number; transactionHash: Hex };

/** @returns true when the market list changed */
async function handlePadEvent(l: PadLog, traderByTx: Map<string, string>): Promise<boolean> {
  const a = l.args;
  const ts = await tsOf(l.blockNumber);
  switch (l.eventName) {
    case "MarketCreated": {
      const token = lc(a.token as string);
      const word = await prisma.word.findUnique({ where: { id: lc(a.word as string) } });
      if (!word) {
        await journal("indexer", `Маркет ${token} на неизвестное слово ${a.word}`, { level: "warn" });
        return false;
      }
      const vBase = a.vBase as bigint;
      const vQuote = a.vQuote as bigint;
      const uri = a.uri as string;
      const meta = await metaFromUri(uri);
      await prisma.market.upsert({
        where: { token },
        create: {
          token,
          wordId: word.id,
          coin: lc(a.coin as string),
          name: a.name as string,
          symbol: a.symbol as string,
          uri,
          imageUrl: meta?.imageUrl,
          description: meta?.description,
          website: meta?.website,
          twitter: meta?.twitter,
          telegram: meta?.telegram,
          creator: lc(a.creator as string),
          feeBps: Number(a.feeBps),
          createdAt: ts,
          createdBlock: l.blockNumber,
          vBase: dec(vBase),
          vQuote: dec(vQuote),
          k: dec(vBase * vQuote),
          curveSupply: dec(CURVE_SUPPLY),
          lastPriceCoin: (Number(vQuote) / Number(vBase)).toFixed(18),
        },
        update: {},
      });
      if (meta?.id) await prisma.launchMeta.update({ where: { id: meta.id }, data: { token } }).catch(() => {});
      await prisma.holderPool.upsert({ where: { token }, create: { token }, update: {} });
      return true;
    }
    case "Trade": {
      const token = lc(a.token as string);
      const m = await prisma.market.findUnique({ where: { token }, include: { word: true } });
      if (!m) return false;
      const isBuy = a.isBuy as boolean;
      const quote = a.quoteAmount as bigint;
      const tokensAmt = a.tokenAmount as bigint;
      const fee = a.fee as bigint;
      const vBase = a.vBase as bigint;
      const vQuote = a.vQuote as bigint;
      const priceCoin = Number(vQuote) / Number(vBase);
      const wordPrice = Number(m.word.lastPrice ?? 0);
      const curveSupply = big(m.curveSupply) + (isBuy ? -tokensAmt : tokensAmt);
      const raised = big(m.raised) + (isBuy ? quote - fee : -(quote + fee));
      await prisma.trade.upsert({
        where: { txHash_logIndex: { txHash: l.transactionHash, logIndex: l.logIndex } },
        create: {
          token,
          txHash: l.transactionHash,
          logIndex: l.logIndex,
          block: l.blockNumber,
          ts,
          trader: traderByTx.get(lc(l.transactionHash)) ?? lc(a.trader as string),
          isBuy,
          venue: "curve",
          quoteAmount: dec(quote),
          tokenAmount: dec(tokensAmt),
          fee: dec(fee),
          priceCoin: priceCoin.toFixed(18),
          priceUsd: (priceCoin * wordPrice).toFixed(18),
          usdValue: ((Number(quote) / 1e18) * wordPrice).toFixed(6),
        },
        update: {},
      });
      await prisma.market.update({
        where: { token },
        data: {
          vBase: dec(vBase),
          vQuote: dec(vQuote),
          curveSupply: dec(curveSupply < 0n ? 0n : curveSupply),
          raised: dec(raised < 0n ? 0n : raised),
          lastPriceCoin: priceCoin.toFixed(18),
          totalFeesCoin: dec(big(m.totalFeesCoin) + fee),
        },
      });
      return false;
    }
    case "Migrated": {
      const token = lc(a.token as string);
      await prisma.market.update({
        where: { token },
        data: { migrated: true, migratedAt: ts, poolId: lc(a.poolId as string), curveSupply: "0" },
      });
      await journal("indexer", `Маркет ${token} мигрировал в Uniswap v4`, { txHash: l.transactionHash });
      return true;
    }
    case "PoolFeesCollected": {
      const token = lc(a.token as string);
      const m = await prisma.market.findUnique({ where: { token } });
      if (!m) return false;
      await prisma.market.update({ where: { token }, data: { totalFeesCoin: dec(big(m.totalFeesCoin) + (a.coinFees as bigint)) } });
      return false;
    }
    case "Swept": {
      const token = lc(a.token as string);
      const m = await prisma.market.findUnique({ where: { token } });
      if (!m) return false;
      const holders = a.holders as bigint;
      const buyback = a.buyback as bigint;
      const protocol = a.protocol as bigint;
      if (holders + buyback + protocol === 0n) return false;
      await prisma.holderPool.upsert({
        where: { token },
        create: { token, accrued: dec(holders) },
        update: { accrued: { increment: dec(holders) } },
      });
      await prisma.treasuryPool.upsert({
        where: { coin: m.coin },
        create: { coin: m.coin, wordId: m.wordId, buybackAccrued: dec(buyback), protocolAccrued: dec(protocol) },
        update: { buybackAccrued: { increment: dec(buyback) }, protocolAccrued: { increment: dec(protocol) } },
      });
      await journal("fees", `Свип фисов ${m.symbol}: холдерам ${fmt18(holders)}, байбек ${fmt18(buyback)}, протокол ${fmt18(protocol)} (в коине слова)`, { txHash: l.transactionHash });
      return false;
    }
  }
  return false;
}

type SwapLog = {
  args: { id: Hex; sender: Address; amount0: bigint; amount1: bigint; sqrtPriceX96: bigint; fee: number };
  blockNumber: bigint;
  logIndex: number;
  transactionHash: Hex;
};

async function handleSwap(l: SwapLog, markets: MarketRef[], traderByTx: Map<string, string>) {
  const m = markets.find((x) => x.poolId && lc(x.poolId) === lc(l.args.id));
  if (!m) return;
  const market = await prisma.market.findUnique({ where: { token: m.token }, include: { word: true } });
  if (!market) return;
  const tokenIs0 = lc(m.token) < lc(m.coin);
  const tokenDelta = tokenIs0 ? l.args.amount0 : l.args.amount1;
  const coinDelta = tokenIs0 ? l.args.amount1 : l.args.amount0;
  const isBuy = tokenDelta > 0n; // the swapper received the token
  const tokensAmt = tokenDelta < 0n ? -tokenDelta : tokenDelta;
  const coin = coinDelta < 0n ? -coinDelta : coinDelta;
  if (tokensAmt === 0n) return;
  const priceCoin = Number(coin) / Number(tokensAmt);
  const wordPrice = Number(market.word.lastPrice ?? 0);
  const feeBps = BigInt(market.feeBps);
  const fee = isBuy ? (coin * feeBps) / 10_000n : (tokensAmt * feeBps) / 10_000n;
  const ts = await tsOf(l.blockNumber);
  await prisma.trade.upsert({
    where: { txHash_logIndex: { txHash: l.transactionHash, logIndex: l.logIndex } },
    create: {
      token: m.token,
      txHash: l.transactionHash,
      logIndex: l.logIndex,
      block: l.blockNumber,
      ts,
      trader: traderByTx.get(lc(l.transactionHash)) ?? lc(l.args.sender),
      isBuy,
      venue: "pool",
      quoteAmount: dec(coin),
      tokenAmount: dec(tokensAmt),
      fee: dec(fee),
      priceCoin: priceCoin.toFixed(18),
      priceUsd: (priceCoin * wordPrice).toFixed(18),
      usdValue: ((Number(coin) / 1e18) * wordPrice).toFixed(6),
    },
    update: {},
  });
  await prisma.market.update({ where: { token: m.token }, data: { lastPriceCoin: priceCoin.toFixed(18) } });
}

type TransferLog = { address: Address; args: { from: Address; to: Address; value: bigint }; blockNumber: bigint };

async function handleTransfer(l: TransferLog, markets: MarketRef[]) {
  const token = lc(l.address);
  if (!markets.some((m) => m.token === token)) return;
  const { from, to, value } = l.args;
  if (value === 0n) return;
  const v = dec(value);
  if (from !== ZERO) {
    await prisma.holderBalance.upsert({
      where: { token_wallet: { token, wallet: lc(from) } },
      create: { token, wallet: lc(from), balance: "0", block: l.blockNumber },
      update: { balance: { decrement: v }, block: l.blockNumber },
    });
  }
  await prisma.holderBalance.upsert({
    where: { token_wallet: { token, wallet: lc(to) } },
    create: { token, wallet: lc(to), balance: v, block: l.blockNumber },
    update: { balance: { increment: v }, block: l.blockNumber },
  });
}

async function metaFromUri(uri: string) {
  const m = uri.match(/\/m\/([A-Za-z0-9_-]+)(?:\.json)?$/);
  if (!m) return null;
  const row = await prisma.launchMeta.findUnique({ where: { id: m[1] } });
  if (!row) return null;
  const base = await getSetting("public_base_url");
  return { id: row.id, imageUrl: `${base}/m/${row.id}/image`, description: row.description, website: row.website, twitter: row.twitter, telegram: row.telegram };
}

function fmt18(v: bigint) {
  return (Number(v) / 1e18).toFixed(4);
}
