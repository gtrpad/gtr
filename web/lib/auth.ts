import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_COOKIE_VALUE = "1";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "1111";
}

/** null when authed; otherwise a 401 JSON response to return as is. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  if (req.cookies.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }
  return null;
}
