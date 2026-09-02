import { NextResponse } from "next/server";
import { getStats } from "@/lib/api";
import { publicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, settings] = await Promise.all([getStats(), publicSettings()]);
  return NextResponse.json({ ...stats, settings });
}
