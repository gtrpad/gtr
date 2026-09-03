import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from "@/lib/auth";
import LoginForm from "./_components/LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const authed = (await cookies()).get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
  const { next } = await searchParams;
  if (authed) redirect(next || "/admin/words");
  return <LoginForm next={next} />;
}
