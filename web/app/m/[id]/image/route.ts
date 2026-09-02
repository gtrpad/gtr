import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await prisma.launchMeta.findUnique({ where: { id }, select: { image: true, imageMime: true } });
  if (!row) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(row.image), { headers: { "content-type": row.imageMime, "cache-control": "public, max-age=31536000, immutable" } });
}
