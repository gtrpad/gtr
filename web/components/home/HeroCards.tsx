"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconLinks } from "@/components/ui/IconLinks";
import type { MarketCard, WordCard } from "@/lib/types";
import { MemeAvatar, WordDot, Change } from "@/components/ui/Primitives";
import { Sparkline } from "@/components/charts/Sparkline";
import { fmtUsd, fmtPrice } from "@/components/util/format";

/**
 * Two marquee rows drifting opposite ways (fame HeroCards recipe). Each row renders its cards
 * twice; the track translates by exactly -50%, so copy two lands where copy one started.
 * Cards: every market, then word coins to fill the rows.
 */
export type HeroItem = { kind: "market"; m: MarketCard } | { kind: "word"; w: WordCard };
const ROW_SIZE = 14;
const MIN_ROW = 8;

function key(it: HeroItem) {
  return it.kind === "market" ? `m:${it.m.token}` : `w:${it.w.id}`;
}

function Card({ it }: { it: HeroItem }) {
  if (it.kind === "market") {
    const m = it.m;
    return (
      <>
        <div className="hc-top">
          <MemeAvatar symbol={m.symbol} image={m.imageUrl} size={32} />
          <div style={{ minWidth: 0 }}>
            <div className="hc-name">{m.name}</div>
            <div className="hc-sub">${m.symbol}</div>
          </div>
        </div>
        <span className="hc-badge">{m.word.name} · {m.word.symbol}</span>
        <div className="hc-num num">
          <b>{fmtUsd(m.fdvUsd)}</b>
          <span className="cap">FDV</span>
        </div>
        <div className="hc-foot">
          <IconLinks wiki={m.word.wikiTitle} token={m.token} />
        </div>
      </>
    );
  }
  const w = it.w;
  return (
    <>
      <div className="hc-top">
        <WordDot symbol={w.symbol} size={32} />
        <div style={{ minWidth: 0 }}>
          <div className="hc-name">{w.name}</div>
          <div className="hc-sub">word coin · {w.symbol}</div>
        </div>
      </div>
      <div className="hc-num num">
        <b>{w.price > 0 ? `$${fmtPrice(w.price)}` : "–"}</b>
        <span><Change value={w.change24h} /></span>
      </div>
      <div className="hc-spark">
        <Sparkline values={w.spark} w={144} h={26} />
      </div>
      <div className="hc-foot">
        <IconLinks wiki={w.wikiTitle} coin={w.coin} />
      </div>
    </>
  );
}

function Row({ cards, direction, seed }: { cards: { it: HeroItem; flipping: boolean }[]; direction: "left" | "right"; seed: number }) {
  const router = useRouter();
  if (!cards.length) return null;
  const doubled = [...cards, ...cards];
  return (
    <div className={`hc-row hc-row-${direction}`}>
      <div className="hc-track">
        {doubled.map((c, i) => {
          const n = i % cards.length;
          const href = c.it.kind === "market" ? `/token/${c.it.m.token}` : `/words/${c.it.w.slug}`;
          return (
            <div
              key={i}
              className={`hc${c.flipping ? " flip" : ""}`}
              style={{ "--r": `${((n * 7 + seed) % 9) - 4}deg`, "--ty": `${[0, 14, 4, 18, 8][n % 5]}px`, "--depth": [1.3, 0.8, 1.5, 0.95, 1.15][n % 5], "--d": `${(n % 6) * 0.06}s` } as CSSProperties}
              aria-hidden={i >= cards.length}
            >
              <div
                className="hc-inner"
                role="link"
                tabIndex={i >= cards.length ? -1 : 0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <Card it={c.it} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HeroCards({ markets, words }: { markets: MarketCard[]; words: WordCard[] }) {
  const bandRef = useRef<HTMLDivElement>(null);
  const items: HeroItem[] = [...markets.map((m) => ({ kind: "market" as const, m })), ...words.filter((w) => w.coin).map((w) => ({ kind: "word" as const, w }))];
  const [rows, setRows] = useState<{ top: { it: HeroItem; flipping: boolean }[]; bottom: { it: HeroItem; flipping: boolean }[] }>(() => split(items));

  // mouse parallax: lerp the pointer into --mx/--my so cards drift rather than snap
  useEffect(() => {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };
    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      const el = bandRef.current;
      if (el) {
        el.style.setProperty("--mx", cx.toFixed(4));
        el.style.setProperty("--my", cy.toFixed(4));
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // periodic flip: swap a random card for one not currently shown, at the edge-on midpoint
  useEffect(() => {
    if (items.length <= MIN_ROW) return;
    let timer: ReturnType<typeof setTimeout>;
    const pending: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      const side: "top" | "bottom" = Math.random() < 0.5 ? "top" : "bottom";
      setRows((prev) => {
        const row = prev[side];
        if (!row.length) return prev;
        const slot = Math.floor(Math.random() * row.length);
        const shown = new Set([...prev.top, ...prev.bottom].map((c) => key(c.it)));
        const pool = items.filter((it) => !shown.has(key(it)));
        const next = pool.length ? pool[Math.floor(Math.random() * pool.length)] : items[Math.floor(Math.random() * items.length)];
        const copy = row.slice();
        copy[slot] = { ...copy[slot], flipping: true };
        pending.push(
          setTimeout(() => {
            setRows((cur) => {
              const r = cur[side].slice();
              if (r[slot]) r[slot] = { it: next, flipping: false };
              return { ...cur, [side]: r };
            });
          }, 360),
        );
        return { ...prev, [side]: copy };
      });
      timer = setTimeout(tick, 1600 + Math.random() * 1400);
    };
    timer = setTimeout(tick, 2500);
    return () => {
      clearTimeout(timer);
      pending.forEach(clearTimeout);
    };
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length) return null;
  return (
    <div className="hero-cards" ref={bandRef} aria-label="Markets and words">
      <Row cards={rows.top} direction="right" seed={3} />
      <Row cards={rows.bottom} direction="left" seed={9} />
    </div>
  );
}

/** Fill both rows with distinct items; repeat when there are too few so the loop still reads. */
function split(items: HeroItem[]) {
  if (!items.length) return { top: [], bottom: [] };
  const n = Math.min(ROW_SIZE, Math.max(MIN_ROW, Math.ceil(items.length / 2)));
  const pick = (offset: number) => Array.from({ length: n }, (_, i) => ({ it: items[(offset + i) % items.length], flipping: false }));
  return { top: pick(0), bottom: pick(n) };
}
