import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { requireAdmin } from "@/lib/auth";
import { setBuybackPool } from "@/lib/adminOps";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "");
  const fee = Number(body?.fee);
  const ts = Number(body?.tickSpacing);
  if (!isAddress(token) || !fee || !ts) return NextResponse.json({ error: "Нужны адрес токена, fee и tickSpacing пула" }, { status: 400 });
  try {
    const tx = await setBuybackPool(token, fee, ts);
    await setSetting("trend_token", token);
    await setSetting("trend_pool_fee", String(fee));
    await setSetting("trend_pool_tick_spacing", String(ts));
    return NextResponse.json({ ok: true, tx });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
