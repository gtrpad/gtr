import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";
const ADMIN_COOKIE_VALUE = "1";

/** Guards /admin/<section> pages. Bare /admin is the login form. API routes guard themselves. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin/")) return NextResponse.next();
  if (req.cookies.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/admin";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };
