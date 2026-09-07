"use client";
import type { CSSProperties } from "react";

const DIGITS = Array.from({ length: 10 }, (_, d) => d);
type OdoStyle = CSSProperties & { "--fame-digit-delay": string; "--fame-digit-offset": string };

/**
 * Vertical digit reels (ported from fame). The full formatted value is part of every digit key,
 * so any recalculation remounts the digits and rolls them again.
 */
export function Odometer({ value, className = "", delay = 0 }: { value: string | number; className?: string; delay?: number }) {
  const text = String(value);
  let order = 0;
  return (
    <span className={`fame-odometer${className ? ` ${className}` : ""}`}>
      <span className="fame-sr-only">{text}</span>
      <span className="fame-odometer-visual" aria-hidden="true">
        {Array.from(text).map((ch, i) => {
          if (!/\d/.test(ch)) {
            return (
              <span className="fame-odometer-char" key={`${text}-${i}-${ch}`}>
                {ch}
              </span>
            );
          }
          const style = { "--fame-digit-delay": `${delay + order * 14}ms`, "--fame-digit-offset": `${Number(ch) * -1}em` } as OdoStyle;
          order += 1;
          return (
            <span className="fame-odometer-digit" key={`${text}-${i}-${ch}`}>
              <span className="fame-odometer-reel" style={style}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
