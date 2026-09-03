import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { collectAndSweep } from "@/lib/fees";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  try {
    await collectAndSweep(); return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
