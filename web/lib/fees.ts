import type { Address } from "viem";
import { prisma } from "./db";
import { ADDR, abi, keeperClient, publicClient, journal } from "./chain";
import { getNum } from "./settings";

type MarketOnChain = { migrated: boolean; feeHolders: bigint; feeBuyback: bigint; feeProtocol: bigint };

/** Collect pool fees of migrated markets and sweep accrued shares to the treasury. */
export async function collectAndSweep() {
  const wallet = await keeperClient();
  if (!wallet) {
    await journal("fees", "Нет ключа кипера, сбор фисов пропущен", { level: "error" });
    return;
  }
  const minUsd = await getNum("fees_min_sweep_usd");
  const markets = await prisma.market.findMany({ where: { hidden: false }, include: { word: true } });
  let collected = 0;
  let swept = 0;
  for (const m of markets) {
    const token = m.token as Address;
    try {
      if (m.migrated) {
        const { result } = await publicClient.simulateContract({
          address: ADDR.launchpad,
          abi: abi.launchpad,
          functionName: "collectPoolFees",
          args: [token],
          account: wallet.account,
        });
        if ((result as bigint) > 0n) {
          const hash = await wallet.writeContract({ address: ADDR.launchpad, abi: abi.launchpad, functionName: "collectPoolFees", args: [token] });
          await publicClient.waitForTransactionReceipt({ hash });
          collected++;
        }
      }
      const oc = (await publicClient.readContract({ address: ADDR.launchpad, abi: abi.launchpad, functionName: "getMarket", args: [token] })) as MarketOnChain;
      const total = oc.feeHolders + oc.feeBuyback + oc.feeProtocol;
      const usd = (Number(total) / 1e18) * Number(m.word.lastPrice ?? 0);
      if (total > 0n && usd >= minUsd) {
        const hash = await wallet.writeContract({ address: ADDR.launchpad, abi: abi.launchpad, functionName: "sweep", args: [token] });
        await publicClient.waitForTransactionReceipt({ hash });
        swept++;
      }
    } catch (e) {
      await journal("fees", `Ошибка сбора фисов ${m.symbol}: ${(e as Error).message.slice(0, 200)}`, { level: "error" });
    }
  }
  if (collected || swept) await journal("fees", `Цикл фисов: собрано с пулов ${collected}, свипов ${swept}`);
}
