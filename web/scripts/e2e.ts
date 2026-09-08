/** Mainnet E2E from the RH test wallet through the real Router. Run: npx tsx --env-file=.env scripts/e2e.ts */
import { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseEther, decodeEventLog, erc20Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodChain, ADDR, abi, wordId } from "../lib/chain";

const PK = process.env.TEST_RH_PK as Hex;
if (!PK) throw new Error("TEST_RH_PK");
const acc = privateKeyToAccount(PK);
const pc = createPublicClient({ chain: robinhoodChain, transport: http() });
const wc = createWalletClient({ account: acc, chain: robinhoodChain, transport: http() });
const DL = () => BigInt(Math.floor(Date.now() / 1000) + 600);
const USDG = ADDR.usdg;

async function tx(label: string, p: Promise<Hex>) {
  const hash = await p;
  const rc = await pc.waitForTransactionReceipt({ hash });
  console.log(label.padEnd(28), rc.status, hash, "gas", rc.gasUsed.toString());
  if (rc.status !== "success") throw new Error(`${label} reverted`);
  return rc;
}
const bal = async () => ({
  eth: Number(formatEther(await pc.getBalance({ address: acc.address }))),
  usdg: Number(formatUnits(await pc.readContract({ address: USDG, abi: erc20Abi, functionName: "balanceOf", args: [acc.address] }), 6)),
});

async function main() {
  const start = await bal();
  console.log("test wallet", acc.address, start);
  const word = wordId("recession");
  const coin = (await pc.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "coinOf", args: [word] })) as Address;
  const price = (await pc.readContract({ address: ADDR.vault, abi: abi.vault, functionName: "price", args: [word] })) as bigint;
  console.log("RECESSION coin", coin, "feed price $", formatUnits(price, 18));

  // 1. create market with a 0.003 ETH first buy
  const rc = await tx("createWithEth", wc.writeContract({ address: ADDR.router, abi: abi.router, functionName: "createWithEth", args: ["Fear Index", "FEAR", "http://localhost:3500/m/e2e", word, 200, 0n, DL()], value: parseEther("0.003") }));
  let token: Address | null = null;
  for (const l of rc.logs) {
    try { const ev = decodeEventLog({ abi: abi.launchpad, data: l.data, topics: l.topics }); if (ev.eventName === "MarketCreated") token = (ev.args as unknown as { token: Address }).token; } catch {}
  }
  if (!token) throw new Error("no MarketCreated");
  const tb = async () => formatUnits(await pc.readContract({ address: token!, abi: erc20Abi, functionName: "balanceOf", args: [acc.address] }), 18);
  console.log("token", token, "balance", await tb());
  const m1 = (await pc.readContract({ address: ADDR.launchpad, abi: abi.launchpad, functionName: "getMarket", args: [token] })) as { vBase: bigint; vQuote: bigint; raised: bigint; totalFees: bigint };
  console.log("curve price coin/token", Number(m1.vQuote) / Number(m1.vBase), "raised coin", formatUnits(m1.raised, 18), "fees coin", formatUnits(m1.totalFees, 18));

  // 2. quote + buy with ETH
  const q = (await pc.simulateContract({ address: ADDR.router, abi: abi.router, functionName: "quoteBuy", args: [token, 0, parseEther("0.002")], account: acc })).result as bigint;
  const before = await tb();
  await tx("buyWithEth 0.002", wc.writeContract({ address: ADDR.router, abi: abi.router, functionName: "buyWithEth", args: [token, (q * 99n) / 100n, acc.address, DL()], value: parseEther("0.002") }));
  const after = await tb();
  console.log("quote", formatUnits(q, 18), "got", Number(after) - Number(before));

  // 3. sell half for USDG, rest for ETH (LaunchToken trusts the router: no approval)
  const balT = await pc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [acc.address] });
  const half = balT / 2n;
  const qs = (await pc.simulateContract({ address: ADDR.router, abi: abi.router, functionName: "quoteSell", args: [token, 1, half], account: acc })).result as bigint;
  await tx("sellForUsdg half", wc.writeContract({ address: ADDR.router, abi: abi.router, functionName: "sellForUsdg", args: [token, half, (qs * 99n) / 100n, acc.address, DL()] }));
  console.log("usdg quote", formatUnits(qs, 6), "usdg now", (await bal()).usdg);
  const rest = await pc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [acc.address] });
  const qe = (await pc.simulateContract({ address: ADDR.router, abi: abi.router, functionName: "quoteSell", args: [token, 0, rest], account: acc })).result as bigint;
  await tx("sellForEth rest", wc.writeContract({ address: ADDR.router, abi: abi.router, functionName: "sellForEth", args: [token, rest, (qe * 99n) / 100n, acc.address, DL()] }));
  console.log("eth quote", formatEther(qe));

  // 4. buy a bit back with USDG so the market keeps holders, then sweep fees to the treasury (permissionless)
  const usdgIn = 1_000_000n; // 1 USDG
  await tx("approve USDG→router", wc.writeContract({ address: USDG, abi: erc20Abi, functionName: "approve", args: [ADDR.router, usdgIn] }));
  await tx("buyWithUsdg 1", wc.writeContract({ address: ADDR.router, abi: abi.router, functionName: "buyWithUsdg", args: [token, usdgIn, 0n, acc.address, DL()] }));
  await tx("sweep", wc.writeContract({ address: ADDR.launchpad, abi: abi.launchpad, functionName: "sweep", args: [token] }));
  const m2 = (await pc.readContract({ address: ADDR.launchpad, abi: abi.launchpad, functionName: "getMarket", args: [token] })) as { totalFees: bigint; raised: bigint };
  console.log("fees total coin", formatUnits(m2.totalFees, 18), "raised", formatUnits(m2.raised, 18), "token balance", await tb());
  const end = await bal();
  console.log("END", end, "delta eth", (end.eth - start.eth).toFixed(6), "delta usdg", (end.usdg - start.usdg).toFixed(4));
  console.log("TOKEN=" + token);
}
main().catch((e) => { console.error(e); process.exit(1); });
