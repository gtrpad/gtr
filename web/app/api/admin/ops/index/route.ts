import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { indexOnce } from "@/lib/indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  try {
    const r = await indexOnce(); return NextResponse.json({ ok: true, from: r?.from.toString(), to: r?.to.toString(), logs: r?.logs ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
