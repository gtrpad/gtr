import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { allSettings, setSetting, DEFAULTS, type SettingKey } from "@/lib/settings";
import { journal } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const s = await allSettings();
  const { keeper_pk_enc, ...rest } = s;
  return NextResponse.json({ ...rest, keeper_set: !!keeper_pk_enc || !!process.env.KEEPER_PK });
}

export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: "Плохой JSON" }, { status: 400 });
  const changed: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (!(k in DEFAULTS) || k === "keeper_pk_enc") continue;
    await setSetting(k as SettingKey, String(v));
    changed.push(`${k}=${v}`);
  }
  if (changed.length) await journal("admin", `Настройки: ${changed.join(", ")}`);
  return NextResponse.json({ ok: true, changed });
}
