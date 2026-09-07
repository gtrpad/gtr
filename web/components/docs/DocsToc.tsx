"use client";
import { useEffect, useState } from "react";

export function DocsToc({ items }: { items: [string, string][] }) {
  const [on, setOn] = useState(items[0]?.[0] ?? "");
  useEffect(() => {
    const els = items.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setOn(vis[0].target.id);
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="toc" aria-label="Contents">
      <span className="cap" style={{ marginBottom: 6 }}>Contents</span>
      {items.map(([id, t], index) => (
        <a key={id} href={`#${id}`} className={on === id ? "on" : ""} aria-current={on === id ? "location" : undefined} onClick={() => setOn(id)}>
          <span className="toc-number">{String(index + 1).padStart(2, "0")}</span>{t}
        </a>
      ))}
    </nav>
  );
}
