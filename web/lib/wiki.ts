/** Wikimedia pageviews REST API: official, no key, daily granularity per article. */
const BASE = "https://wikimedia.org/api/rest_v1/metrics/pageviews";
const UA = "gtr/0.1 (attention oracle; https://github.com/gtrpad/gtr) node-fetch";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

/** Polite fetch: ≥ 250 ms between calls, retries 429/5xx with backoff. */
async function wikiFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + 250 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    if ((r.status === 429 || r.status >= 500) && attempt < 4) {
      await sleep([2000, 5000, 10000, 20000][attempt]);
      continue;
    }
    return r;
  }
}

export function wikiTitle(title: string) {
  return encodeURIComponent(title.trim().replace(/ /g, "_"));
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Last full UTC day (Wikimedia publishes it a few hours after midnight). */
export function yesterdayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export async function dailyViews(title: string, from: Date, to: Date): Promise<{ day: string; views: number }[]> {
  const url = `${BASE}/per-article/en.wikipedia/all-access/user/${wikiTitle(title)}/daily/${ymd(from)}/${ymd(to)}`;
  const r = await wikiFetch(url);
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`wikimedia ${r.status} for ${title}`);
  const j = (await r.json()) as { items?: { timestamp: string; views: number }[] };
  return (j.items ?? []).map((i) => ({ day: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`, views: i.views }));
}

export async function viewsForDay(title: string, day: Date): Promise<number | null> {
  const rows = await dailyViews(title, day, day);
  return rows.length ? rows[0].views : null;
}

/** Top viewed articles of a day, minus Wikipedia housekeeping pages. */
export async function topArticles(day: Date, limit = 50): Promise<{ title: string; views: number }[]> {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  const r = await wikiFetch(`${BASE}/top/en.wikipedia/all-access/${y}/${m}/${d}`);
  if (!r.ok) throw new Error(`wikimedia top ${r.status}`);
  const j = (await r.json()) as { items: { articles: { article: string; views: number }[] }[] };
  return (j.items?.[0]?.articles ?? [])
    .filter((a) => !/^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:|Category:|Template:)/.test(a.article))
    .filter((a) => !/^Deaths_in_/.test(a.article))
    .slice(0, limit)
    .map((a) => ({ title: a.article.replace(/_/g, " "), views: a.views }));
}

/** Resolve a free-text word to a Wikipedia article title (first search hit). */
export async function resolveTitle(q: string): Promise<{ title: string; description?: string } | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json&origin=*`;
  const r = await wikiFetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as { query?: { search?: { title: string; snippet?: string }[] } };
  const hit = j.query?.search?.[0];
  return hit ? { title: hit.title } : null;
}
