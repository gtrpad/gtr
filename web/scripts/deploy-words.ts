/** Deploys a WordCoin for every catalogue word without one, then pushes all prices. */
import { prisma } from "../lib/db";
import { deployWord } from "../lib/adminOps";
import { pushPrices } from "../lib/oracle";

async function main() {
  const words = await prisma.word.findMany({ where: { coin: null }, orderBy: { createdAt: "asc" } });
  for (const w of words) {
    const coin = await deployWord(w.id);
    console.log(w.slug.padEnd(20), coin);
  }
  const tx = await pushPrices();
  console.log("push", tx);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
