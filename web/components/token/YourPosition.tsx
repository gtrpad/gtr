"use client";
import Link from "next/link";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits, type Address } from "viem";
import { useMounted } from "@/components/util/useMounted";
import { fmtCompact, fmtUsd } from "@/components/util/format";

/** Wallet balance of the market token and of its word coin. */
export function YourPosition({ token, coin, symbol, coinSymbol, priceUsd, coinPrice }: { token: string; coin: string; symbol: string; coinSymbol: string; priceUsd: number; coinPrice: number }) {
  const { address } = useAccount();
  const mounted = useMounted();
  const { data } = useReadContracts({
    contracts: [
      { address: token as Address, abi: erc20Abi, functionName: "balanceOf", args: [address as Address] },
      { address: coin as Address, abi: erc20Abi, functionName: "balanceOf", args: [address as Address] },
    ],
    query: { enabled: !!address },
  });
  const bal = (i: number) => (data?.[i]?.status === "success" ? Number(formatUnits(data[i].result as bigint, 18)) : 0);
  const t = bal(0), c = bal(1);
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <h2>Your position</h2>
        
      </div>
      {!mounted || !address ? (
        <p className="cap">Connect a wallet to see what you hold in this market.</p>
      ) : (
        <>
          <div className="kv"><span>${symbol}</span><b className="num">{fmtCompact(t, 2)} <span className="muted">· {fmtUsd(t * priceUsd)}</span></b></div>
          <div className="kv"><span>{coinSymbol}</span><b className="num">{fmtCompact(c, 2)} <span className="muted">· {fmtUsd(c * coinPrice)}</span></b></div>
          <Link className="btn wide" href="/rewards" style={{ marginTop: 12 }}>
            Your rewards ↗
          </Link>
        </>
      )}
    </section>
  );
}
