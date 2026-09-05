"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: [string, string][] = [["Markets", "/"], ["Words", "/words"], ["Launch", "/launch"], ["Rewards", "/rewards"], ["Docs", "/docs"]];

export function NavLinks() {
  const p = usePathname() ?? "/";
  const active = (href: string) => (href === "/" ? p === "/" || p.startsWith("/token") : p === href || p.startsWith(href + "/"));
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map(([t, h]) => (
        <Link key={h} href={h} className={active(h) ? "on" : ""}>
          {t}
        </Link>
      ))}
    </nav>
  );
}
