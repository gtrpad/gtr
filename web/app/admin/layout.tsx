import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from "@/lib/auth";
import Nav from "./_components/Nav";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "GTR · админка", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = (await cookies()).get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
  return (
    <div data-theme="admin" className="adm">
      {authed && <Nav />}
      <main className={authed ? "adm-main" : ""} style={authed ? undefined : { flex: 1 }}>{children}</main>
    </div>
  );
}
