import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Token metadata JSON, referenced by the on-chain URI. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await prisma.launchMeta.findUnique({ where: { id: id.replace(/\.json$/, "") } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const base = await getSetting("public_base_url");
  return NextResponse.json(
    { name: row.name, symbol: row.symbol, description: row.description ?? "", image: `${base}/m/${row.id}/image`, website: row.website, twitter: row.twitter, telegram: row.telegram, createdAt: row.createdAt },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
