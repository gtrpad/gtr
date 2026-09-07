"use client";
import { useMounted } from "@/components/util/useMounted";
import { useConnect } from "wagmi";
import { robinhood } from "@/lib/wagmi";

/** Full width connect CTA for trade boxes; the header pill stays the primary entry point. */
export function ConnectInline({ label }: { label: string }) {
  const { connect, connectors, isPending } = useConnect();
  const mounted = useMounted();
  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
  return (
    <button type="button" className="btn primary lg block" disabled={!mounted || isPending} onClick={() => injected && connect({ connector: injected, chainId: robinhood.id })}>
      {isPending ? "Connecting…" : label}
    </button>
  );
}
