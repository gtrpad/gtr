"use client";
import { useState, type ReactNode } from "react";

/** Discussion style tabs switching the lower lists. */
export function TokenTabs({ tabs }: { tabs: { key: string; label: string; count?: number; content: ReactNode }[] }) {
  const [on, setOn] = useState(tabs[0]?.key ?? "");
  const cur = tabs.find((t) => t.key === on) ?? tabs[0];
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === on} className={t.key === on ? "selected" : ""} onClick={() => setOn(t.key)}>
            {t.label}
            {t.count !== undefined ? <span className="cnt">{t.count}</span> : null}
          </button>
        ))}
      </div>
      <div>{cur?.content}</div>
    </>
  );
}
