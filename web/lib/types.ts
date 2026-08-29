/** Shapes shared by server data functions (lib/api.ts), API routes and UI. All amounts that
 * are on-chain integers are decimal strings; USD and prices are plain numbers. */

export type WordRef = {
  id: string; // bytes32
  slug: string;
  name: string; // lowercase display, e.g. "recession"
  symbol: string; // coin ticker, e.g. "RECESSION"
  coin: string | null; // WordCoin address
  price: number; // USD per coin (feed)
  views: number | null; // views behind the current price
  wikiTitle: string; // article the coin tracks
};

export type MarketCard = {
  token: string;
  name: string;
  symbol: string; // without $
  imageUrl: string | null;
  word: WordRef;
  priceCoin: number; // coin per token
  priceUsd: number;
  fdvUsd: number;
  progress: number; // 0..1 of the curve sold; 1 when migrated
  migrated: boolean;
  volume24hUsd: number;
  createdAt: string; // ISO
  feeBps: number;
  creator: string;
};

export type TradeRow = {
  txHash: string;
  ts: string;
  trader: string;
  isBuy: boolean;
  venue: "curve" | "pool";
  tokenAmount: string;
  quoteAmount: string;
  usdValue: number;
  priceCoin: number;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; cUsd: number; v: number };

export type HolderRow = { wallet: string; balance: string; pct: number };

export type MarketDetail = MarketCard & {
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  coin: string;
  poolId: string | null;
  raised: string; // coin, 18 dec
  curveSupply: string;
  holders: number;
  feesTotalCoin: string;
  feesTotalUsd: number;
  holderPool: { accrued: string; paid: string; unpaid: string; unpaidUsd: number };
  lastPayout: { ts: string; totalCoin: string; totalUsd: number; wallets: number; txHash: string | null } | null;
  trades: TradeRow[];
  uri: string;
};

export type WordCard = WordRef & {
  change24h: number | null; // percent
  marketsCount: number;
  spark: number[]; // last 30 daily prices
  updatedAt: string | null;
};

export type WordDetail = WordCard & {
  history: { day: string; views: number; price: number }[]; // 90 days
  markets: MarketCard[];
  reserveUsdg: number | null; // USDG behind the coin
  maxSellable: number | null; // coins redeemable right now
  totalSupply: number | null;
};

export type Stats = {
  markets: number;
  migrated: number;
  words: number;
  volume24hUsd: number;
  valueLockedUsd: number;
  feesUsd: number;
  paidUsd: number;
  paidWallets: number;
};

export type RewardsView = {
  wallet: string;
  totalUsd: number;
  payouts: { ts: string; token: string; symbol: string; coinSymbol: string; coin: string; amount: string; usd: number; txHash: string | null }[];
  pending: { token: string; symbol: string; coinSymbol: string; coin: string; estimateCoin: string; estimateUsd: number; sharePct: number }[];
  coins: { coin: string; symbol: string; slug: string; price: number }[]; // word coins the wallet may hold
};

export type PublicSettings = {
  sitePaused: boolean;
  execute: boolean;
  trendToken: string | null;
  viewsPerUsd: number;
  payoutMinPoolUsd: number;
  payoutMinHoldingUsd: number;
  payoutMinWalletUsd: number;
  payoutCycleMin: number;
};
