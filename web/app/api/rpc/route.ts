import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BLOCKED = new Set(["eth_accounts", "eth_sign", "personal_sign", "eth_signTransaction", "admin_", "debug_", "miner_", "txpool_"]);

/** Browser RPC proxy: the provider key stays on the server. */
export async function POST(req: NextRequest) {
  const url = process.env.RH_RPC_URL;
  if (!url) return NextResponse.json({ error: "rpc not configured" }, { status: 500 });
  const body = await req.text();
  try {
    const calls = JSON.parse(body) as { method?: string } | { method?: string }[];
    const list = Array.isArray(calls) ? calls : [calls];
    if (list.length > 50) return NextResponse.json({ error: "batch too large" }, { status: 400 });
    for (const c of list) {
      const m = c.method ?? "";
      if ([...BLOCKED].some((b) => m === b || m.startsWith(b))) return NextResponse.json({ error: "method not allowed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
