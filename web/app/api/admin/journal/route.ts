import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const kind = req.nextUrl.searchParams.get("kind") ?? undefined;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  const rows = await prisma.journal.findMany({ where: kind ? { kind } : {}, orderBy: { id: "desc" }, take: limit });
  return NextResponse.json(rows);
}
