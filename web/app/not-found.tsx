import Link from "next/link";

/** Root fallback (no site chrome). Public URLs are caught by app/(site)/[...missing]. */
export default function RootNotFound() {
  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <h1 style={{ fontSize: 24, lineHeight: "32px" }}>Nothing here</h1>
      <p style={{ marginTop: 8 }}>
        <Link href="/">Back to GTR</Link>
      </p>
    </div>
  );
}
