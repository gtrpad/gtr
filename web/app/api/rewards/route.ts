import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getRewards } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  if (!isAddress(wallet)) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  return NextResponse.json(await getRewards(wallet));
}
