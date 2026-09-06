import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { publicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function paused(): Promise<boolean> {
  try {
    return (await publicSettings()).sitePaused;
  } catch {
    return false;
  }
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const isPaused = await paused();
  return (
    <>
      {isPaused ? <div className="paused">Trading is paused</div> : null}
      <Header />
      <main className="page">{children}</main>
      <Footer />
    </>
  );
}
