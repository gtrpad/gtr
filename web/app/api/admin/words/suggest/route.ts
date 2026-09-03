import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { topArticles, yesterdayUtc } from "@/lib/wiki";

export const dynamic = "force-dynamic";

/** Top articles of the last full day that are not in the catalogue yet. */
export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  try {
    const top = await topArticles(yesterdayUtc(), 60);
    const have = new Set((await prisma.word.findMany({ select: { wikiTitle: true } })).map((w) => w.wikiTitle.toLowerCase()));
    return NextResponse.json(top.filter((t) => !have.has(t.title.toLowerCase())));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
