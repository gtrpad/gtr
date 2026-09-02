import { NextRequest, NextResponse } from "next/server";
import { getHolders } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  return NextResponse.json(await getHolders(token, limit));
}
