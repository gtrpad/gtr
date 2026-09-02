import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const tf = (req.nextUrl.searchParams.get("tf") ?? "5m") as "1m" | "5m" | "1h" | "1d";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 300), 1000);
  return NextResponse.json(await getCandles(token, ["1m", "5m", "1h", "1d"].includes(tf) ? tf : "5m", limit));
}
