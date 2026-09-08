/** Initial catalogue: word → Wikipedia article. Run: npx tsx --env-file=.env scripts/seed-words.ts */
import { prisma } from "../lib/db";
import { wordId } from "../lib/chain";
import { backfillWord } from "../lib/oracle";

const WORDS: [string, string, string?][] = [
  ["recession", "Recession"],
  ["agi", "Artificial general intelligence", "AGI"],
  ["bitcoin", "Bitcoin"],
  ["ethereum", "Ethereum"],
  ["trump", "Donald Trump"],
  ["robinhood", "Robinhood Markets"],
  ["inflation", "Inflation"],
  ["tariffs", "Tariff"],
  ["nvidia", "Nvidia"],
  ["tesla", "Tesla, Inc."],
  ["openai", "OpenAI"],
  ["elon musk", "Elon Musk", "ELON"],
  ["taylor swift", "Taylor Swift", "SWIFT"],
  ["aliens", "Unidentified flying object", "ALIENS"],
  ["world war 3", "World War III", "WW3"],
  ["super bowl", "Super Bowl", "SBOWL"],
  ["iphone", "IPhone"],
  ["gold", "Gold"],
  ["oil", "Petroleum", "OIL"],
  ["fed", "Federal Reserve", "FED"],
  ["layoffs", "Layoff", "LAYOFFS"],
  ["stock market crash", "Stock market crash", "CRASH"],
  ["meme", "Internet meme", "MEME"],
  ["dogecoin", "Dogecoin"],
  ["solana", "Solana (blockchain platform)", "SOLANA"],
  ["china", "China"],
  ["mars", "Mars"],
  ["pandemic", "Pandemic"],
  ["nuclear", "Nuclear weapon", "NUCLEAR"],
  ["gta 6", "Grand Theft Auto VI", "GTA6"],
];

async function main() {
  for (const [name, title, sym] of WORDS) {
    const slug = name.replace(/[^a-z0-9]+/g, "-");
    const id = wordId(slug).toLowerCase();
    const symbol = (sym ?? slug.replace(/-/g, "")).toUpperCase().slice(0, 12);
    const exists = await prisma.word.findUnique({ where: { id } });
    if (!exists) await prisma.word.create({ data: { id, slug, name, symbol, wikiTitle: title } });
    const n = await backfillWord(id).catch((e) => `ERR ${(e as Error).message}`);
    const w = await prisma.word.findUnique({ where: { id } });
    console.log(name.padEnd(20), symbol.padEnd(10), `${n} days`, w?.lastViews, `$${w?.lastPrice}`);
  }
  await prisma.$disconnect();
}
main();
