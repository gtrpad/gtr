import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { backfillWord } from "@/lib/oracle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = requireAdmin(req);
  if (g) return g;
  const { id } = await ctx.params;
  try {
    const n = await backfillWord(id);
    return NextResponse.json({ ok: true, days: n });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
