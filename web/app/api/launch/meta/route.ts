import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
const MAX = 5 * 1024 * 1024;
const MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Stores launch metadata + image; returns the URI written on chain (served from /m/[id]). */
export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const name = String(fd.get("name") ?? "").trim();
  const symbol = String(fd.get("symbol") ?? "").trim().toUpperCase();
  if (!name || name.length > 40) return NextResponse.json({ error: "Name is required, up to 40 characters." }, { status: 400 });
  if (!/^[A-Z0-9]{1,12}$/.test(symbol)) return NextResponse.json({ error: "Ticker: 1 to 12 letters or digits." }, { status: 400 });
  const image = fd.get("image");
  if (!(image instanceof File)) return NextResponse.json({ error: "Image is required." }, { status: 400 });
  if (image.size > MAX) return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  if (!MIMES.has(image.type)) return NextResponse.json({ error: "PNG, JPEG or WebP only." }, { status: 400 });
  let buf: Buffer;
  try {
    buf = await sharp(Buffer.from(await image.arrayBuffer())).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 88 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not read the image." }, { status: 400 });
  }
  const id = randomBytes(9).toString("base64url");
  const str = (k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max) || null;
  await prisma.launchMeta.create({
    data: { id, name, symbol, description: str("description", 600), website: str("website"), twitter: str("twitter"), telegram: str("telegram"), creator: str("creator", 64), image: new Uint8Array(buf), imageMime: "image/webp" },
  });
  const base = await getSetting("public_base_url");
  return NextResponse.json({ id, uri: `${base}/m/${id}`, imageUrl: `${base}/m/${id}/image` });
}
