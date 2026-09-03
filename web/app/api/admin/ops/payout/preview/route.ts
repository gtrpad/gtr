import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { previewPayout } from "@/lib/payouts";

export const dynamic = "force-dynamic";

/** Payout preview for every market (or one token): who gets what. */
export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const tokens: string[] = body?.token ? [String(body.token).toLowerCase()] : (await prisma.holderPool.findMany({ select: { token: true } })).map((p) => p.token);
  const out = [];
  for (const t of tokens) {
    const p = await previewPayout(t);
    if (p) out.push({ token: p.token, symbol: p.symbol, coin: p.coin, unpaid: p.unpaid.toString(), payable: p.payable.toString(), wordPrice: p.wordPrice, skipped: p.skipped, rows: p.rows.map((r) => ({ wallet: r.wallet, amount: r.amount.toString(), usd: r.usd })) });
  }
  return NextResponse.json(out);
}
