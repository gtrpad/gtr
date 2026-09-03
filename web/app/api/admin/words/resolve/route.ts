import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveTitle, viewsForDay, yesterdayUtc } from "@/lib/wiki";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ error: "q" }, { status: 400 });
  const hit = await resolveTitle(q);
  if (!hit) return NextResponse.json({ title: null });
  const views = await viewsForDay(hit.title, yesterdayUtc()).catch(() => null);
  return NextResponse.json({ title: hit.title, views });
}
