"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  ["/admin/words", "Слова"],
  ["/admin/oracle", "Оракул"],
  ["/admin/markets", "Маркеты"],
  ["/admin/ops", "Операции и журнал"],
  ["/admin/settings", "Настройки"],
  ["/admin/wallet", "Кошелёк и контракты"],
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="adm-side">
      <div className="adm-brand"><i /> GTR · админка</div>
      <nav className="adm-nav">
        {items.map(([href, label]) => (
          <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>{label}</Link>
        ))}
      </nav>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <Link href="/" className="muted" style={{ padding: "0 12px" }}>← На сайт</Link>
        <button className="adm-btn" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); router.push("/admin"); router.refresh(); }}>Выйти</button>
      </div>
    </aside>
  );
}
