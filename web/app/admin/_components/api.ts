"use client";
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  return data as T;
}
export const EXPLORER = "https://robinhoodchain.blockscout.com";
export const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const fmtDate = (s: string | Date) => new Date(s).toLocaleString("ru-RU", { timeZone: "UTC", hour12: false }) + " UTC";
