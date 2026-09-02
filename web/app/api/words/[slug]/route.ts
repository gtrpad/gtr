import { NextRequest, NextResponse } from "next/server";
import { getWord } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const w = await getWord(slug);
  if (!w) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(w);
}
