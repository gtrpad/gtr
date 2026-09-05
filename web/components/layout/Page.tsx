import type { ReactNode } from "react";

/** Centered column. With `aside`, a two-column grid (content + 320px) above 1100px. */
export function Page({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  if (!aside) return <div className="wrap">{children}</div>;
  return (
    <div className="wrap two-col">
      <div style={{ minWidth: 0 }}>{children}</div>
      <aside>{aside}</aside>
    </div>
  );
}
