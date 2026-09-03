import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { pushPrices } from "@/lib/oracle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  try {
    const tx = await pushPrices(Array.isArray(body?.ids) && body.ids.length ? body.ids : undefined);
    return NextResponse.json({ ok: true, tx });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
