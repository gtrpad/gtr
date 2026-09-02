import { NextRequest, NextResponse } from "next/server";
import { listMarkets } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const filter = (p.get("filter") ?? "all") as "all" | "new" | "migrated" | "curve";
  const sort = (p.get("sort") ?? undefined) as "volume" | "new" | "fdv" | undefined;
  const limit = p.get("limit") ? Number(p.get("limit")) : undefined;
  const rows = await listMarkets({ filter, sort, limit, q: p.get("q") ?? undefined, word: p.get("word") ?? undefined });
  return NextResponse.json(rows);
}
