/** Server and client safe constants. lib/wagmi is a "use client" module, so server components import from here. */
export const EXPLORER = "https://robinhoodchain.blockscout.com";
export const ZERO = "0x0000000000000000000000000000000000000000";
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const ADDR = {
  vault: process.env.NEXT_PUBLIC_ADDR_VAULT || ZERO,
  launchpad: process.env.NEXT_PUBLIC_ADDR_LAUNCHPAD || ZERO,
  router: process.env.NEXT_PUBLIC_ADDR_ROUTER || ZERO,
  feed: process.env.NEXT_PUBLIC_ADDR_FEED || ZERO,
  buyback: process.env.NEXT_PUBLIC_ADDR_BUYBACK || ZERO,
};

/** Wikipedia article URL for the title a word tracks (spaces become underscores). */
export const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`;
