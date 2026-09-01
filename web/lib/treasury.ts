import { type Address, type Hex } from "viem";
import { prisma } from "./db";
import { ADDR, abi, keeperClient, publicClient, journal } from "./chain";
import { getBool, getSetting, setSetting } from "./settings";


/** Prisma Decimal → bigint without exponent notation. */
function big(d: { toFixed: (n: number) => string } | string | number | bigint): bigint {
  if (typeof d === "bigint") return d;
  if (typeof d === "number") return BigInt(Math.round(d));
  if (typeof d === "string") return BigInt(d.includes("e") ? Number(d).toLocaleString("fullwide", { useGrouping: false }) : d);
  return BigInt(d.toFixed(0));
}
const DL = () => BigInt(Math.floor(Date.now() / 1000) + 600);

/** Buyback + protocol shares: word coin → USDG at the feed (reserve-bound), then buyback USDG → ETH → Buyback contract. */
export async function convertTreasury() {
  const execute = await getBool("execute");
  const wallet = await keeperClient();
  if (!wallet) return;
  const pools = await prisma.treasuryPool.findMany();
  for (const tp of pools) {
    const bb = big(tp.buybackAccrued) - big(tp.buybackConverted);
    const pr = big(tp.protocolAccrued) - big(tp.protocolConverted);
    const want = bb + pr;
    if (want <= 0n) continue;
    const word = tp.wordId as Hex;
    let maxSell: bigint;
    try {
      maxSell = (await publicClient.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "maxSellable", args: [word] })) as bigint;
    } catch {
      continue; // stale feed: wait for the next push
    }
    const bal = (await publicClient.readContract({ address: tp.coin as Address, abi: abi.wordCoin, functionName: "balanceOf", args: [wallet.account.address] })) as bigint;
    const amount = [want, maxSell, bal].reduce((a, b) => (a < b ? a : b));
    if (amount <= 0n) continue;
    const bbPart = (amount * bb) / want;
    const prPart = amount - bbPart;
    if (!execute) {
      await journal("treasury", `DRY: продать ${(Number(amount) / 1e18).toFixed(4)} коина ${tp.coin.slice(0, 8)} в USDG (байбек ${(Number(bbPart) / 1e18).toFixed(4)}, протокол ${(Number(prPart) / 1e18).toFixed(4)})`, { level: "dry" });
      continue;
    }
    try {
      const { result } = await publicClient.simulateContract({ address: ADDR.vault, abi: abi.vault, functionName: "sell", args: [word, amount, 0n, wallet.account.address], account: wallet.account });
      const usdgOut = result as bigint;
      const hash = await wallet.writeContract({ address: ADDR.vault, abi: abi.vault, functionName: "sell", args: [word, amount, (usdgOut * 99n) / 100n, wallet.account.address] });
      await publicClient.waitForTransactionReceipt({ hash });
      const bbUsdg = (usdgOut * bb) / want;
      await prisma.treasuryPool.update({ where: { coin: tp.coin }, data: { buybackConverted: { increment: bbPart.toString() }, protocolConverted: { increment: prPart.toString() } } });
      const pending = BigInt((await getSetting("buyback_usdg_pending")) || "0") + bbUsdg;
      await setSetting("buyback_usdg_pending", pending.toString());
      await journal("treasury", `Конверсия ${tp.coin.slice(0, 8)}: ${(Number(amount) / 1e18).toFixed(4)} коина → ${(Number(usdgOut) / 1e6).toFixed(2)} USDG (байбек ${(Number(bbUsdg) / 1e6).toFixed(2)})`, { txHash: hash });
    } catch (e) {
      await journal("treasury", `Конверсия ${tp.coin.slice(0, 8)} упала: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
    }
  }
  await runBuyback();
}

/** Pending buyback USDG → ETH into the Buyback contract; execute the burn when the exchange coin pool is set. */
export async function runBuyback() {
  const execute = await getBool("execute");
  if (!(await getBool("buyback_enabled"))) return;
  const wallet = await keeperClient();
  if (!wallet) return;
  const pending = BigInt((await getSetting("buyback_usdg_pending")) || "0");
  if (pending >= 5_000_000n) {
    if (!execute) {
      await journal("buyback", `DRY: ${(Number(pending) / 1e6).toFixed(2)} USDG → ETH в Buyback`, { level: "dry" });
    } else {
      try {
        const allowance = (await publicClient.readContract({ address: ADDR.usdg, abi: abi.wordCoin, functionName: "allowance", args: [wallet.account.address, ADDR.router] })) as bigint;
        if (allowance < pending) {
          const h = await wallet.writeContract({ address: ADDR.usdg, abi: abi.wordCoin, functionName: "approve", args: [ADDR.router, 2n ** 255n] });
          await publicClient.waitForTransactionReceipt({ hash: h });
        }
        const { result } = await publicClient.simulateContract({ address: ADDR.router, abi: abi.router, functionName: "swapUsdgForEth", args: [pending, 0n, ADDR.buyback, DL()], account: wallet.account });
        const ethOut = result as bigint;
        const hash = await wallet.writeContract({ address: ADDR.router, abi: abi.router, functionName: "swapUsdgForEth", args: [pending, (ethOut * 99n) / 100n, ADDR.buyback, DL()] });
        await publicClient.waitForTransactionReceipt({ hash });
        await setSetting("buyback_usdg_pending", "0");
        await journal("buyback", `${(Number(pending) / 1e6).toFixed(2)} USDG → ${(Number(ethOut) / 1e18).toFixed(6)} ETH в Buyback`, { txHash: hash });
      } catch (e) {
        await journal("buyback", `USDG → ETH упал: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
      }
    }
  }
  const trend = await getSetting("trend_token");
  if (!trend) return;
  const ethBal = await publicClient.getBalance({ address: ADDR.buyback });
  if (ethBal < 10n ** 14n) return; // < 0.0001 ETH
  if (!execute) {
    await journal("buyback", `DRY: байбек на ${(Number(ethBal) / 1e18).toFixed(6)} ETH`, { level: "dry" });
    return;
  }
  try {
    const { result } = await publicClient.simulateContract({ address: ADDR.buyback, abi: abi.buyback, functionName: "execute", args: [ethBal, 0n], account: wallet.account });
    const out = result as bigint;
    const hash = await wallet.writeContract({ address: ADDR.buyback, abi: abi.buyback, functionName: "execute", args: [ethBal, (out * 97n) / 100n] });
    await publicClient.waitForTransactionReceipt({ hash });
    await journal("buyback", `Байбек: ${(Number(ethBal) / 1e18).toFixed(6)} ETH → сожжено ${(Number(out) / 1e18).toFixed(2)} токенов`, { txHash: hash });
  } catch (e) {
    await journal("buyback", `Байбек упал: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
  }
}
