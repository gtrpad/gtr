import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const rows = await prisma.market.findMany({ orderBy: { createdAt: "desc" }, include: { word: { select: { slug: true, symbol: true, lastPrice: true } }, holderPool: true, _count: { select: { trades: true } } } });
  return NextResponse.json(
    rows.map((m) => ({
      token: m.token, name: m.name, symbol: m.symbol, word: m.word.slug, coinSymbol: m.word.symbol, migrated: m.migrated, hidden: m.hidden, createdAt: m.createdAt, creator: m.creator, feeBps: m.feeBps,
      trades: m._count.trades, fdvUsd: Number(m.lastPriceCoin) * Number(m.word.lastPrice ?? 0) * 1e9,
      unpaidCoin: m.holderPool ? (Number(m.holderPool.accrued) - Number(m.holderPool.paid)) / 1e18 : 0,
      paidCoin: m.holderPool ? Number(m.holderPool.paid) / 1e18 : 0,
    })),
  );
}
