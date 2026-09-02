import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const m = await getMarket(token);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(m);
}
