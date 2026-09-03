import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addWordRow } from "@/lib/adminOps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const words = await prisma.word.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { markets: true } } } });
  return NextResponse.json(words.map((w) => ({ ...w, lastPrice: w.lastPrice ? Number(w.lastPrice) : null, markets: w._count.markets })));
}

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.wikiTitle) return NextResponse.json({ error: "Нужны слово и статья Wikipedia" }, { status: 400 });
  try {
    const w = await addWordRow({ name: body.name, wikiTitle: body.wikiTitle, symbol: body.symbol });
    return NextResponse.json(w);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
