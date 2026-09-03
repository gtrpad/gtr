import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { journal } from "@/lib/chain";
import { setWordEnabledOnChain } from "@/lib/adminOps";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = requireAdmin(req);
  if (g) return g;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["name", "symbol", "wikiTitle", "hidden", "enabled"]) if (k in body) data[k] = body[k];
  const w = await prisma.word.update({ where: { id }, data });
  let tx: string | undefined;
  if ("enabled" in body && w.coin) {
    try {
      tx = await setWordEnabledOnChain(id, !!body.enabled);
    } catch (e) {
      return NextResponse.json({ error: `В базе сохранено, но он-чейн не применилось: ${(e as Error).message}` }, { status: 500 });
    }
  }
  await journal("admin", `Слово «${w.name}» изменено: ${JSON.stringify(data)}`, { txHash: tx });
  return NextResponse.json({ ok: true, tx });
}
