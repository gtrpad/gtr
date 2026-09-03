import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { observeAll } from "@/lib/oracle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const out = await observeAll();
  return NextResponse.json({ ok: true, observed: out.length, rows: out });
}
