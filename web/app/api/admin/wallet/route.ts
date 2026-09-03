import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { requireAdmin } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { setSetting } from "@/lib/settings";
import { journal } from "@/lib/chain";
import { keeperInfo } from "@/lib/adminOps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  try {
    return NextResponse.json({ keeper: await keeperInfo() });
  } catch (e) {
    return NextResponse.json({ keeper: null, error: (e as Error).message });
  }
}

/** Stores the ops private key encrypted (AES-GCM under WALLET_ENC_KEY). The key never goes back out. */
export async function POST(req: NextRequest) {
  const g = requireAdmin(req);
  if (g) return g;
  const body = await req.json().catch(() => null);
  const pk = String(body?.privateKey ?? "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return NextResponse.json({ error: "Приватник должен быть hex 0x + 64 символа" }, { status: 400 });
  let address: string;
  try {
    address = privateKeyToAccount(pk as `0x${string}`).address;
  } catch {
    return NextResponse.json({ error: "Невалидный ключ" }, { status: 400 });
  }
  try {
    await setSetting("keeper_pk_enc", encryptSecret(pk));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  await journal("admin", `Ключ оператора обновлён: ${address}`);
  return NextResponse.json({ ok: true, address });
}
