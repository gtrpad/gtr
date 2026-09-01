import { type Address, maxUint256 } from "viem";
import { prisma } from "./db";
import { ADDR, abi, keeperClient, publicClient, journal } from "./chain";
import { getBool, getNum } from "./settings";
import { excludedWallets } from "./indexer";


/** Prisma Decimal → bigint without exponent notation. */
function big(d: { toFixed: (n: number) => string } | string | number | bigint): bigint {
  if (typeof d === "bigint") return d;
  if (typeof d === "number") return BigInt(Math.round(d));
  if (typeof d === "string") return BigInt(d.includes("e") ? Number(d).toLocaleString("fullwide", { useGrouping: false }) : d);
  return BigInt(d.toFixed(0));
}
export type PayoutPreview = {
  token: string;
  symbol: string;
  coin: string;
  unpaid: bigint;
  payable: bigint;
  wordPrice: number;
  rows: { wallet: string; amount: bigint; usd: number }[];
  skipped: number;
};

/** Build the payout of one market from indexed balances; null when below thresholds. */
export async function previewPayout(token: string): Promise<PayoutPreview | null> {
  const m = await prisma.market.findUnique({ where: { token }, include: { word: true, holderPool: true } });
  if (!m || !m.holderPool) return null;
  const wordPrice = Number(m.word.lastPrice ?? 0);
  if (!wordPrice) return null;
  const unpaid = big(m.holderPool.accrued) - big(m.holderPool.paid);
  if (unpaid <= 0n) return null;
  const unpaidUsd = (Number(unpaid) / 1e18) * wordPrice;
  if (unpaidUsd < (await getNum("payout_min_pool_usd"))) return null;

  const reserveBps = BigInt(Math.round(await getNum("payout_reserve_bps")));
  const payable = (unpaid * (10_000n - reserveBps)) / 10_000n;
  const minHoldingUsd = await getNum("payout_min_holding_usd");
  const minWalletUsd = await getNum("payout_min_wallet_usd");
  const priceUsd = Number(m.lastPriceCoin) * wordPrice; // USD per token (18 dec both)
  const excluded = await excludedWallets();

  const balances = await prisma.holderBalance.findMany({ where: { token, balance: { gt: 0 } } });
  const eligible = balances
    .map((b) => ({ wallet: b.wallet, bal: big(b.balance) }))
    .filter((b) => !excluded.has(b.wallet))
    .filter((b) => (Number(b.bal) / 1e18) * priceUsd >= minHoldingUsd);
  const sum = eligible.reduce((s, b) => s + b.bal, 0n);
  if (sum === 0n) return null;

  const rows: PayoutPreview["rows"] = [];
  let skipped = 0;
  for (const b of eligible) {
    const amount = (payable * b.bal) / sum;
    const usd = (Number(amount) / 1e18) * wordPrice;
    if (usd < minWalletUsd) {
      skipped++;
      continue;
    }
    rows.push({ wallet: b.wallet, amount, usd });
  }
  if (!rows.length) return null;
  return { token, symbol: m.symbol, coin: m.coin, unpaid, payable, wordPrice, rows, skipped };
}

/** Pay one market's holders (or dry-run). Returns the round id. */
export async function executePayout(p: PayoutPreview, force = false): Promise<number | null> {
  const execute = force || (await getBool("execute"));
  const total = p.rows.reduce((s, r) => s + r.amount, 0n);
  const totalUsd = p.rows.reduce((s, r) => s + r.usd, 0);
  if (!execute) {
    await journal("payout", `DRY: ${p.symbol}: ${p.rows.length} кошельков, ${(Number(total) / 1e18).toFixed(4)} коина (~$${totalUsd.toFixed(2)}), пропущено ${p.skipped}`, { level: "dry" });
    return null;
  }
  const wallet = await keeperClient();
  if (!wallet) {
    await journal("payout", "Нет ключа кипера, выплата пропущена", { level: "error" });
    return null;
  }
  const coin = p.coin as Address;
  const bal = (await publicClient.readContract({ address: coin, abi: abi.wordCoin, functionName: "balanceOf", args: [wallet.account.address] })) as bigint;
  if (bal < total) {
    await journal("payout", `Трежери не хватает коина ${p.symbol}: есть ${(Number(bal) / 1e18).toFixed(4)}, нужно ${(Number(total) / 1e18).toFixed(4)}`, { level: "error" });
    return null;
  }
  const allowance = (await publicClient.readContract({ address: coin, abi: abi.wordCoin, functionName: "allowance", args: [wallet.account.address, ADDR.disperse] })) as bigint;
  if (allowance < total) {
    const h = await wallet.writeContract({ address: coin, abi: abi.wordCoin, functionName: "approve", args: [ADDR.disperse, maxUint256] });
    await publicClient.waitForTransactionReceipt({ hash: h });
  }
  const round = await prisma.payoutRound.create({
    data: { token: p.token, coin: p.coin, totalCoin: total.toString(), totalUsd: totalUsd.toFixed(6), wallets: p.rows.length, status: "pending" },
  });
  try {
    const hash = await wallet.writeContract({
      address: ADDR.disperse,
      abi: abi.disperse,
      functionName: "disperse",
      args: [coin, p.token as Address, p.rows.map((r) => r.wallet as Address), p.rows.map((r) => r.amount)],
    });
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error("disperse reverted");
    await prisma.$transaction([
      prisma.payoutRound.update({ where: { id: round.id }, data: { status: "sent", txHash: hash } }),
      prisma.payout.createMany({ data: p.rows.map((r) => ({ roundId: round.id, wallet: r.wallet, coin: p.coin, amount: r.amount.toString(), usd: r.usd.toFixed(6), txHash: hash })) }),
      prisma.holderPool.update({ where: { token: p.token }, data: { paid: { increment: total.toString() } } }),
    ]);
    await journal("payout", `Выплата ${p.symbol}: ${p.rows.length} кошельков, ${(Number(total) / 1e18).toFixed(4)} коина (~$${totalUsd.toFixed(2)})`, { txHash: hash });
    return round.id;
  } catch (e) {
    await prisma.payoutRound.update({ where: { id: round.id }, data: { status: "failed", error: (e as Error).message.slice(0, 500) } });
    await journal("payout", `Выплата ${p.symbol} упала: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
    return null;
  }
}

export async function runPayouts() {
  const pools = await prisma.holderPool.findMany({ include: { market: { select: { hidden: true } } } });
  for (const hp of pools) {
    if (hp.market.hidden) continue;
    const p = await previewPayout(hp.token);
    if (p) await executePayout(p);
  }
}
