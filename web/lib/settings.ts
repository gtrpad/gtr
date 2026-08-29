import { prisma } from "./db";

/** Every runtime knob with its default. Admin edits rows in AppSetting. */
export const DEFAULTS = {
  execute: "false", // boolean: payouts, treasury conversions and buybacks go on chain
  site_paused: "false",
  oracle_enabled: "true",
  oracle_source: "wikipedia", // wikipedia | serpapi
  oracle_push_hour_utc: "8", // Wikimedia publishes the previous day by ~06:00 UTC
  word_views_per_usd: "1000", // price = views / 1000
  word_price_floor: "0.001",
  payout_cycle_min: "15",
  payout_min_pool_usd: "100",
  payout_min_holding_usd: "5",
  payout_min_wallet_usd: "1",
  payout_reserve_bps: "200", // kept back so the treasury never comes up short
  fees_min_sweep_usd: "1",
  buyback_enabled: "true",
  trend_token: "", // exchange coin address once launched
  trend_pool_fee: "",
  trend_pool_tick_spacing: "",
  public_base_url: "http://localhost:3500",
  keeper_pk_enc: "",
  buyback_usdg_pending: "0",
  exclude_wallets: "", // comma separated extra addresses excluded from payouts
} as const;

export type SettingKey = keyof typeof DEFAULTS;

let cache: Record<string, string> | null = null;
let cacheAt = 0;
const TTL = 5_000;

export async function allSettings(): Promise<Record<SettingKey, string>> {
  if (cache && Date.now() - cacheAt < TTL) return cache as Record<SettingKey, string>;
  const rows = await prisma.appSetting.findMany();
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  cache = out;
  cacheAt = Date.now();
  return out as Record<SettingKey, string>;
}

export async function getSetting(key: SettingKey): Promise<string> {
  return (await allSettings())[key];
}

export async function getBool(key: SettingKey): Promise<boolean> {
  return (await getSetting(key)) === "true";
}

export async function getNum(key: SettingKey): Promise<number> {
  const v = Number(await getSetting(key));
  return Number.isFinite(v) ? v : Number(DEFAULTS[key]);
}

export async function setSetting(key: SettingKey, value: string) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  cache = null;
}

export function invalidateSettings() {
  cache = null;
}

/** Public settings safe to expose to the browser. */
export async function publicSettings() {
  const s = await allSettings();
  return {
    sitePaused: s.site_paused === "true",
    execute: s.execute === "true",
    trendToken: s.trend_token || null,
    viewsPerUsd: Number(s.word_views_per_usd),
    payoutMinPoolUsd: Number(s.payout_min_pool_usd),
    payoutMinHoldingUsd: Number(s.payout_min_holding_usd),
    payoutMinWalletUsd: Number(s.payout_min_wallet_usd),
    payoutCycleMin: Number(s.payout_cycle_min),
  };
}
