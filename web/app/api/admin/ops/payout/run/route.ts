import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { previewPayout, executePayout } from "@/lib/payouts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Executes one market's payout on chain regardless of the EXECUTE flag (operator confirmed it). */
export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body?.token) return NextResponse.json({ error: "token" }, { status: 400 });
  const p = await previewPayout(String(body.token).toLowerCase());
  if (!p) return NextResponse.json({ error: "Нечего платить: ниже порогов или нет холдеров" }, { status: 400 });
  const roundId = await executePayout(p, true);
  return NextResponse.json({ ok: roundId !== null, roundId });
}
