import { NextResponse } from "next/server";
import { listWords } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listWords());
}
