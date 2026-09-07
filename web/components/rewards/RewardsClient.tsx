"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits, isAddress, keccak256, toHex, type Address as Addr } from "viem";
import type { RewardsView } from "@/lib/types";
import { MemeAvatar, WordDot, Empty, Chip } from "@/components/ui/Primitives";
import { TxLink } from "@/components/ui/Address";
import { Icon } from "@/components/ui/Icons";
import { ConnectInline } from "@/components/trade/ConnectInline";
import { WordCoinBox } from "@/components/trade/WordCoinBox";
import { fmtUsd, fmtCompact, ago, short, units } from "@/components/util/format";

/** Word ids are keccak256 of the lowercase slug (see lib/chain.ts wordId). */
const wordIdOf = (slug: string) => keccak256(toHex(slug.toLowerCase().trim()));

type Loaded = { wallet: string; view: RewardsView | null; err: string | null; last24: number };

function useRewards() {
  const { address } = useAccount();
  const sp = useSearchParams();
  const qWallet = sp.get("wallet");
  const wallet = (qWallet && isAddress(qWallet) ? qWallet : address) ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    const w = wallet.toLowerCase();
    fetch(`/api/rewards?wallet=${wallet}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Rewards unavailable (${r.status})`);
        return (await r.json()) as RewardsView;
      })
      .then((v) => {
        const now = Date.now();
        const last24 = v.payouts.filter((p) => now - new Date(p.ts).getTime() < 86400_000).reduce((s, p) => s + p.usd, 0);
        if (alive) setLoaded({ wallet: w, view: v, err: null, last24 });
      })
      .catch((e) => alive && setLoaded({ wallet: w, view: null, err: e.message, last24: 0 }));
    return () => {
      alive = false;
    };
  }, [wallet]);
  const current = loaded && wallet && loaded.wallet === wallet.toLowerCase() ? loaded : null;
  const coins = useMemo(() => current?.view?.coins ?? [], [current]);
  const { data: balData } = useReadContracts({
    contracts: coins.map((c) => ({ address: c.coin as Addr, abi: erc20Abi, functionName: "balanceOf" as const, args: [wallet as Addr] })),
    query: { enabled: !!wallet && coins.length > 0 },
  });
  const balances = coins.map((c, i) => {
    const r = balData?.[i];
    const raw = r && r.status === "success" ? (r.result as bigint) : 0n;
    return { ...c, raw, amount: Number(formatUnits(raw, 18)) };
  });
  return { address, wallet, view: current?.view ?? null, err: current?.err ?? null, loading: !!wallet && !current, last24: current?.last24 ?? 0, held: balances.filter((b) => b.raw > 0n) };
}

export function RewardsClient({ cycleMin, minHoldingUsd }: { cycleMin: number; minHoldingUsd: number }) {
  const r = useRewards();
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const selected = r.held.find((b) => b.coin === sel) ?? r.held[0] ?? null;

  if (!r.wallet) {
    const valid = isAddress(lookup.trim());
    return (
      <div className="reward-connect">
        <div className="section-head"><h2>Your rewards</h2><span className="cap">connect a wallet or look up any address</span></div>
        <div className="reward-connect-row">
          <div className="reward-connect-btn"><ConnectInline label="Connect wallet" /></div>
          <span className="muted">or</span>
        <form
          className="lookup"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) router.push(`/rewards?wallet=${lookup.trim()}`);
          }}
        >
          <div className="input"><input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x… wallet address" aria-label="Wallet address" /></div>
          <button type="submit" className="btn" disabled={!valid}>Look up</button>
        </form>
        </div>
        {lookup && !valid ? <span className="err">Not a valid address.</span> : null}
      </div>
    );
  }

  const view = r.view;
  const payingMarkets = new Set((view?.payouts ?? []).map((p) => p.token)).size;
  return (
    <div className="rewards-workspace">
      <div className="info">
        {Icon.info}
        <span>
          Showing <span className="mono">{short(r.wallet)}</span>
          {r.address && r.wallet.toLowerCase() === r.address.toLowerCase() ? " (connected)" : ""}. Payouts land here automatically.
        </span>
        <Link href={`/rewards?wallet=${r.wallet}`}>Share link</Link>
      </div>
      {r.err ? <p className="err">{r.err}</p> : null}
      <div className="reward-totals">
        <span><i className="dot-blue" />Paid, all time <b className="num">{fmtUsd(view?.totalUsd ?? 0)}</b></span>
        <span><i className="dot-red" />Last 24h <b className="num">{fmtUsd(r.last24)}</b></span>
        <span><i className="dot-yellow" />Markets that paid you <b className="num">{payingMarkets}</b></span>
        <span><i className="dot-green" />Last payout <b className="num">{view?.payouts[0] ? ago(view.payouts[0].ts) : "none"}</b></span>
        <span>Word coins held <b className="num">{r.held.length}</b></span>
      </div>

      <section className="section">
        <div className="section-head"><h2>Payouts</h2><span className="cap">checked every {cycleMin} min</span></div>
        {r.loading && !view ? (
          <div className="stack" style={{ gap: 10, padding: "8px 0" }}><div className="skeleton" style={{ width: "60%" }} /><div className="skeleton" style={{ width: "80%" }} /><div className="skeleton" style={{ width: "45%" }} /></div>
        ) : !view || view.payouts.length === 0 ? (
          <Empty>No payouts to this wallet yet. Hold a market worth at least ${minHoldingUsd} and payouts start with the next cycle that reaches the pool minimum.</Empty>
        ) : (
          <div className="scroll scroll-440">
            <table className="tbl compact rewards-table">
              <colgroup><col style={{ width: "34%" }} /><col style={{ width: "26%" }} /><col style={{ width: "20%" }} /><col style={{ width: "20%" }} /></colgroup>
              <thead><tr><th>Market</th><th className="r">Paid</th><th className="r">When</th><th className="r">Transaction</th></tr></thead>
              <tbody>
                {view.payouts.map((p, i) => (
                  <tr key={`${p.txHash ?? "x"}-${i}`}>
                    <td><Link className="cell plain" href={`/token/${p.token}`}><MemeAvatar symbol={p.symbol} /><span className="p2">${p.symbol}</span></Link></td>
                    <td className="r num"><span className="p2">{fmtCompact(units(p.amount, 18), 2)} {p.coinSymbol}</span><span className="c">≈ {fmtUsd(p.usd)}</span></td>
                    <td className="r muted num">{ago(p.ts)}</td>
                    <td className="r">{p.txHash ? <TxLink hash={p.txHash} /> : <span className="muted">pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Pending estimates</h2><span className="cap">your share of each unpaid pool</span></div>
        {!view || view.pending.length === 0 ? (
          <Empty>Nothing pending. Estimates appear while a market you hold has unpaid fees.</Empty>
        ) : (
          <div className="scroll scroll-240">
            <table className="tbl compact rewards-table">
              <colgroup><col style={{ width: "34%" }} /><col style={{ width: "22%" }} /><col style={{ width: "22%" }} /><col style={{ width: "22%" }} /></colgroup>
              <thead><tr><th>Market</th><th className="r">Your share</th><th className="r">Estimate</th><th className="r">≈ USD</th></tr></thead>
              <tbody>
                {view.pending.map((p) => (
                  <tr key={p.token}>
                    <td><Link className="cell plain" href={`/token/${p.token}`}><MemeAvatar symbol={p.symbol} /><span className="p2">${p.symbol}</span></Link></td>
                    <td className="r num">{p.sharePct.toFixed(2)}%</td>
                    <td className="r num">{fmtCompact(units(p.estimateCoin, 18), 2)} {p.coinSymbol}</td>
                    <td className="r num">{fmtUsd(p.estimateUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Sell word coins</h2><span className="cap">{r.held.length} held</span></div>
        {r.held.length === 0 ? (
          <p className="muted">This wallet holds no word coins yet. Rewards arrive as word coins and show up here.</p>
        ) : (
          <div className="two-col" style={{ gap: 24 }}>
            <span className="chips">
              {r.held.map((b) => (
                <Chip key={b.coin} on={selected?.coin === b.coin} onClick={() => setSel(b.coin)}>
                  <WordDot symbol={b.symbol} size={16} /> {b.symbol} · {fmtCompact(b.amount, 2)}
                </Chip>
              ))}
            </span>
            {selected ? <WordCoinBox key={selected.coin} wordId={wordIdOf(selected.slug)} coin={selected.coin} symbol={selected.symbol} price={selected.price} reserveUsdg={null} sellOnly /> : null}
          </div>
        )}
      </section>
    </div>
  );
}
