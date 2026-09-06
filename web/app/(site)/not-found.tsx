import Link from "next/link";
import { Page } from "@/components/layout/Page";

export default function NotFound() {
  return (
    <Page>
      <div className="intro fu">
        <h1>Nothing here</h1>
        <p>This page does not exist, or the market or word you are looking for has not been created yet.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Link className="btn primary" href="/">Markets</Link>
          <Link className="btn" href="/words">Words</Link>
        </div>
      </div>
    </Page>
  );
}
