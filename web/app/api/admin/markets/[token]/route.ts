import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { journal } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const g = requireAdmin(req);
  if (g) return g;
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const m = await prisma.market.update({ where: { token: token.toLowerCase() }, data: { hidden: !!body.hidden } });
  await journal("admin", `Маркет ${m.symbol} ${m.hidden ? "скрыт" : "показан"}`);
  return NextResponse.json({ ok: true });
}
