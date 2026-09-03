import { decodeEventLog, type Address, type Hex } from "viem";
import { prisma } from "./db";
import { ADDR, abi, keeperAccount, keeperClient, publicClient, journal, ZERO } from "./chain";
import { backfillWord } from "./oracle";

/** The ops key doubles as contract owner and keeper. */
export async function keeperInfo() {
  const acc = await keeperAccount();
  if (!acc) return null;
  const [eth, usdg, owner] = await Promise.all([
    publicClient.getBalance({ address: acc.address }),
    publicClient.readContract({ address: ADDR.usdg, abi: abi.wordCoin, functionName: "balanceOf", args: [acc.address] }).catch(() => 0n) as Promise<bigint>,
    ADDR.vault === ZERO ? Promise.resolve(null) : (publicClient.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "owner" }).catch(() => null) as Promise<string | null>),
  ]);
  return { address: acc.address, eth: Number(eth) / 1e18, usdg: Number(usdg) / 1e6, isOwner: owner ? owner.toLowerCase() === acc.address.toLowerCase() : null };
}

/** Creates the WordCoin on chain for a catalogue row and stores its address. */
export async function deployWord(wordId: string) {
  const w = await prisma.word.findUniqueOrThrow({ where: { id: wordId } });
  if (w.coin) return w.coin;
  const wallet = await keeperClient();
  if (!wallet) throw new Error("Нет ключа оператора");
  const existing = (await publicClient.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "coinOf", args: [wordId as Hex] })) as Address;
  let coin: string;
  let tx: Hex | undefined;
  if (existing && existing !== ZERO) {
    coin = existing;
  } else {
    tx = await wallet.writeContract({ address: ADDR.vault, abi: abi.vault, functionName: "addWord", args: [wordId as Hex, w.name, w.symbol] });
    const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (rc.status !== "success") throw new Error("addWord reverted");
    coin = "";
    for (const log of rc.logs) {
      try {
        const ev = decodeEventLog({ abi: abi.vault, data: log.data, topics: log.topics });
        if (ev.eventName === "WordAdded") coin = (ev.args as unknown as { coin: string }).coin;
      } catch {
        /* other logs */
      }
    }
    if (!coin) coin = (await publicClient.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "coinOf", args: [wordId as Hex] })) as string;
  }
  await prisma.word.update({ where: { id: wordId }, data: { coin: coin.toLowerCase() } });
  await journal("admin", `Коин слова «${w.name}» задеплоен: ${coin}`, { txHash: tx });
  return coin;
}

export async function setWordEnabledOnChain(wordId: string, enabled: boolean) {
  const wallet = await keeperClient();
  if (!wallet) throw new Error("Нет ключа оператора");
  const tx = await wallet.writeContract({ address: ADDR.vault, abi: abi.vault, functionName: "setEnabled", args: [wordId as Hex, enabled] });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  await journal("admin", `Слово ${wordId.slice(0, 10)} ${enabled ? "включено" : "выключено"} в волте`, { txHash: tx });
  return tx;
}

export async function setBuybackPool(token: string, fee: number, tickSpacing: number) {
  const wallet = await keeperClient();
  if (!wallet) throw new Error("Нет ключа оператора");
  const tx = await wallet.writeContract({ address: ADDR.buyback, abi: abi.buyback, functionName: "setPool", args: [token as Address, fee, tickSpacing] });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  await journal("admin", `Пул байбека: ${token} fee ${fee} spacing ${tickSpacing}`, { txHash: tx });
  return tx;
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function symbolFor(slug: string) {
  return slug.replace(/-/g, "").toUpperCase().slice(0, 12);
}

/** Adds a catalogue row (off chain) and backfills 90 days of history. */
export async function addWordRow(input: { name: string; wikiTitle: string; symbol?: string }) {
  const { wordId } = await import("./chain");
  const slug = slugify(input.name);
  if (!slug) throw new Error("Пустое слово");
  const id = wordId(slug).toLowerCase();
  const exists = await prisma.word.findUnique({ where: { id } });
  if (exists) throw new Error("Слово уже в каталоге");
  const w = await prisma.word.create({
    data: { id, slug, name: slug.replace(/-/g, " "), symbol: (input.symbol || symbolFor(slug)).toUpperCase(), wikiTitle: input.wikiTitle.trim() },
  });
  const n = await backfillWord(id);
  await journal("admin", `Слово «${w.name}» добавлено (${w.wikiTitle}), история ${n} дней`);
  return w;
}
