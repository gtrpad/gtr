import { createPublicClient, createWalletClient, http, defineChain, type Address, type Hex, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "./db";
import { decryptSecret } from "./crypto";
import { getSetting } from "./settings";
import FeedAbi from "./abi/AttentionFeed.json";
import VaultAbi from "./abi/PegVault.json";
import LaunchpadAbi from "./abi/Launchpad.json";
import RouterAbi from "./abi/Router.json";
import BuybackAbi from "./abi/Buyback.json";
import DisperseAbi from "./abi/Disperse.json";
import WordCoinAbi from "./abi/WordCoin.json";
import LaunchTokenAbi from "./abi/LaunchToken.json";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RH_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const EXPLORER = "https://robinhoodchain.blockscout.com";

export const ADDR = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address,
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,
  feed: (process.env.NEXT_PUBLIC_ADDR_FEED ?? "0x0000000000000000000000000000000000000000") as Address,
  vault: (process.env.NEXT_PUBLIC_ADDR_VAULT ?? "0x0000000000000000000000000000000000000000") as Address,
  launchpad: (process.env.NEXT_PUBLIC_ADDR_LAUNCHPAD ?? "0x0000000000000000000000000000000000000000") as Address,
  router: (process.env.NEXT_PUBLIC_ADDR_ROUTER ?? "0x0000000000000000000000000000000000000000") as Address,
  buyback: (process.env.NEXT_PUBLIC_ADDR_BUYBACK ?? "0x0000000000000000000000000000000000000000") as Address,
  disperse: (process.env.NEXT_PUBLIC_ADDR_DISPERSE ?? "0x0000000000000000000000000000000000000000") as Address,
};
export const DEPLOY_BLOCK = BigInt(process.env.DEPLOY_BLOCK ?? "0");

export const abi = {
  feed: FeedAbi,
  vault: VaultAbi,
  launchpad: LaunchpadAbi,
  router: RouterAbi,
  buyback: BuybackAbi,
  disperse: DisperseAbi,
  wordCoin: WordCoinAbi,
  launchToken: LaunchTokenAbi,
} as const;

export const publicClient = createPublicClient({ chain: robinhoodChain, transport: http(undefined, { batch: true }) });

export function wordId(slug: string): Hex {
  return keccak256(toHex(slug.toLowerCase().trim()));
}

/** Keeper wallet: encrypted key from the admin panel, env fallback for local dev. */
export async function keeperAccount() {
  let pk = process.env.KEEPER_PK as Hex | undefined;
  const enc = await getSetting("keeper_pk_enc");
  if (enc) pk = decryptSecret(enc) as Hex;
  if (!pk) return null;
  return privateKeyToAccount(pk);
}

export async function keeperClient() {
  const account = await keeperAccount();
  if (!account) return null;
  return createWalletClient({ account, chain: robinhoodChain, transport: http() });
}

export async function journal(kind: string, message: string, opts: { level?: string; txHash?: string; meta?: unknown } = {}) {
  await prisma.journal.create({
    data: { kind, message, level: opts.level ?? "info", txHash: opts.txHash, meta: opts.meta as never },
  });
}

export const ZERO = "0x0000000000000000000000000000000000000000" as Address;
export const DEAD = "0x000000000000000000000000000000000000dEaD" as Address;
