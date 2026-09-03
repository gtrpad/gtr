import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deployWord } from "@/lib/adminOps";
import { pushPrices } from "@/lib/oracle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = requireAdmin(req);
  if (g) return g;
  const { id } = await ctx.params;
  try {
    const coin = await deployWord(id);
    const pushTx = await pushPrices([id]).catch((e) => `push failed: ${(e as Error).message}`);
    return NextResponse.json({ ok: true, coin, pushTx });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
