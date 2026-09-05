"use client";
import { EXPLORER, wikiUrl } from "@/components/util/chain";
import { ServiceIcon } from "./ServiceIcon";

/**
 * Small 16x16 external links: the Wikipedia article a word tracks, the word coin contract,
 * the market token contract. Clicks never bubble to a parent card or row.
 */
export function IconLinks({ wiki, coin, token, gap = 8 }: { wiki?: string | null; coin?: string | null; token?: string | null; gap?: number }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const items: { key: string; href: string; title: string; icon: "wiki" | "blockscout" }[] = [];
  if (wiki) items.push({ key: "wiki", href: wikiUrl(wiki), title: `${wiki} on Wikipedia`, icon: "wiki" });
  if (coin) items.push({ key: "coin", href: `${EXPLORER}/address/${coin}`, title: "Word coin contract on Blockscout", icon: "blockscout" });
  if (token) items.push({ key: "token", href: `${EXPLORER}/address/${token}`, title: "Token contract on Blockscout", icon: "blockscout" });
  if (!items.length) return null;
  return (
    <span className="icon-links" style={{ display: "inline-flex", alignItems: "center", gap }} onClick={stop}>
      {items.map((it) => (
        <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" title={it.title} aria-label={it.title} onClick={stop} style={{ display: "inline-flex", lineHeight: 0 }}>
          <ServiceIcon name={it.icon} label={false} />
        </a>
      ))}
    </span>
  );
}
