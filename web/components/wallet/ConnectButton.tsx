"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMounted } from "@/components/util/useMounted";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { EXPLORER, robinhood } from "@/lib/wagmi";
import { short } from "@/components/util/format";
import { Icon } from "@/components/ui/Icons";
import { ServiceIcon } from "@/components/ui/ServiceIcon";

/** Injected wallet only. Shows a short address pill when connected, with copy and disconnect. */
export function ConnectButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

  if (!mounted || !isConnected || !address) {
    return (
      <button
        type="button"
        className="btn"
        disabled={!mounted || isPending}
        onClick={() => {
          if (!injected) return;
          connect({ connector: injected, chainId: robinhood.id });
        }}
        title={error ? error.message : undefined}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const wrongChain = chainId !== robinhood.id;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {wrongChain ? (
        <button type="button" className="btn" style={{ borderColor: "var(--purple)", color: "var(--purple-ink)" }} disabled={switching} onClick={() => switchChain({ chainId: robinhood.id })}>
          {switching ? "Switching…" : "Switch to Robinhood Chain"}
        </button>
      ) : (
        <button type="button" className="btn num" onClick={() => setOpen((o) => !o)}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#229780" }} />
          {short(address)}
          {Icon.caret}
        </button>
      )}
      {open ? (
        <div className="wallet-menu">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(address).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? Icon.check : Icon.copy} {copied ? "Copied" : "Copy address"}
          </button>
          <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noopener noreferrer">
            <ServiceIcon name="blockscout" label={false} /> View on Blockscout
          </a>
          <Link href="/rewards" onClick={() => setOpen(false)}>Your rewards</Link>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
