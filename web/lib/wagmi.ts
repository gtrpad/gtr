"use client";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

/** Browser RPC goes through our proxy so the provider key never ships to the client. */
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [typeof window === "undefined" ? "https://rpc.mainnet.chain.robinhood.com" : `${window.location.origin}/api/rpc`] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const wagmiConfig = createConfig({
  chains: [robinhood],
  connectors: [injected()],
  transports: { [robinhood.id]: http() },
  ssr: true,
});

export const ADDR = {
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const,
  feed: (process.env.NEXT_PUBLIC_ADDR_FEED || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  vault: (process.env.NEXT_PUBLIC_ADDR_VAULT || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  launchpad: (process.env.NEXT_PUBLIC_ADDR_LAUNCHPAD || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  router: (process.env.NEXT_PUBLIC_ADDR_ROUTER || "0x0000000000000000000000000000000000000000") as `0x${string}`,
};
export const EXPLORER = "https://robinhoodchain.blockscout.com";
