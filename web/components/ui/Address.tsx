"use client";
import { useState } from "react";
import { EXPLORER } from "@/components/util/chain";
import { Icon } from "./Icons";
import { ServiceIcon } from "./ServiceIcon";
import { short } from "@/components/util/format";

/** Short address with copy and a Blockscout link, 16x16 icon boxes. */
export function Address({ value, kind = "address", full = false }: { value: string; kind?: "address" | "tx" | "token"; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  const href = `${EXPLORER}/${kind}/${value}`;
  return (
    <span className="addr">
      <span>{full ? value : short(value)}</span>
      <button
        type="button"
        className="ic"
        title={copied ? "Copied" : "Copy"}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        {copied ? Icon.check : Icon.copy}
      </button>
      {copied ? <span className="copied">Copied</span> : null}
      <a href={href} target="_blank" rel="noopener noreferrer" title="Open in Blockscout">
        <ServiceIcon name="blockscout" label={false} />
      </a>
    </span>
  );
}

export function TxLink({ hash, text = "tx" }: { hash: string; text?: string }) {
  return (
    <a className="svcw" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
      <ServiceIcon name="blockscout" label={false} /> {text}
    </a>
  );
}
