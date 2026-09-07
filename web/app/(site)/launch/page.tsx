import type { Metadata } from "next";
import { listWords } from "@/lib/api";
import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata: Metadata = { title: "Launch" };

export default async function LaunchPage() {
  const words = await listWords();
  return (
    <div className="wrap">
      <div className="stack">
        <div className="intro fu" style={{ ["--d" as string]: 0 }}>
          <h1>Launch a market</h1>
          <p>Pick a word, set a fee, buy first. The curve opens at a $5,000 cap and migrates at $35,000. No creator share, holders get paid instead.</p>
        </div>
        <LaunchForm words={words} />
      </div>
    </div>
  );
}
