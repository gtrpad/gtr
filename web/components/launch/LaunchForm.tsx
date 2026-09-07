"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useSwitchChain, useBalance, useReadContract } from "wagmi";
import { erc20Abi, formatUnits, parseUnits, type Hex } from "viem";
import { useLaunch, type LaunchInput } from "@/lib/hooks/useLaunch";
import { robinhood, ADDR } from "@/lib/wagmi";
import RouterAbi from "@/lib/abi/Router.json";
import { EXPLORER } from "@/components/util/chain";
import type { WordCard } from "@/lib/types";
import { WordDot, MemeAvatar, Chip, KV, FeeSplit, Change } from "@/components/ui/Primitives";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { Sparkline } from "@/components/charts/Sparkline";
import { ConnectInline } from "@/components/trade/ConnectInline";
import { IconLinks } from "@/components/ui/IconLinks";
import { fmtNum, fmtPrice, fmtCompact, fmtUsd } from "@/components/util/format";

const MAX_IMG = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const CAP_OPEN = 5000, CAP_MIGRATE = 35000, SUPPLY = 1e9, CURVE = 8e8;
const SQ7 = Math.sqrt(7);
const VB0 = (CURVE * SQ7) / (SQ7 - 1);
const PEG_FEE = 0.995;

const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Curve math from the spec: constant product with virtual reserves, caps fixed in the word coin. */
function estimateTokens(coinIn: number, feeBps: number, price: number) {
  if (!(coinIn > 0) || !(price > 0)) return 0;
  const cap0Coin = CAP_OPEN / price;
  const vQ0 = (cap0Coin * VB0) / SUPPLY;
  const net = coinIn * (1 - feeBps / 10000);
  return VB0 - (VB0 * vQ0) / (vQ0 + net);
}

type Field = { ok: boolean; err: string | null };
function Labeled({ label, optional, count, max, state, children, hint }: { label: ReactNode; optional?: boolean; count?: number; max?: number; state?: Field; children: ReactNode; hint?: string }) {
  const cls = state?.err ? "bad" : state?.ok ? "ok" : "";
  return (
    <div className={`field ${cls}`}>
      <label>
        {label}
        {optional ? <small>optional</small> : null}
        {state?.ok ? <span className="tick"><Tick /></span> : null}
        {max !== undefined ? <span className="counter num">{count ?? 0}/{max}</span> : null}
      </label>
      {children}
      {state?.err ? <span className="err">{state.err}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function LaunchForm({ words }: { words: WordCard[] }) {
  const { state, launch, connected } = useLaunch();
  const { address, chainId } = useAccount();
  const pc = usePublicClient();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [q, setQ] = useState("");
  const [wordId, setWordId] = useState<string | null>(null);
  const [feeBps, setFeeBps] = useState<100 | 200 | 300>(200);
  const [cur, setCur] = useState<"ETH" | "USDG">("ETH");
  const [amount, setAmount] = useState("");
  const [ethUsd, setEthUsd] = useState<number | null>(null);
  const [ethFail, setEthFail] = useState(false);
  const routerMissing = ADDR.router === "0x0000000000000000000000000000000000000000";
  const ethUsdFailed = ethFail || routerMissing;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const launchable = useMemo(() => words.filter((w) => w.coin && w.price > 0), [words]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? launchable.filter((w) => w.name.includes(s) || w.symbol.toLowerCase().includes(s)) : launchable;
  }, [q, launchable]);
  const word = launchable.find((w) => w.id === wordId) ?? null;
  const wrongChain = connected && chainId !== robinhood.id;
  const busy = ["uploading", "approving", "signing", "pending"].includes(state.status);

  // balances for the first buy
  const { data: ethBal } = useBalance({ address, query: { enabled: !!address } });
  const { data: usdgBal } = useReadContract({ address: ADDR.usdg, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`], query: { enabled: !!address } });
  const balText = cur === "ETH" ? (ethBal ? `${Number(formatUnits(ethBal.value, 18)).toFixed(4)} ETH` : null) : usdgBal !== undefined ? `${Number(formatUnits(usdgBal as bigint, 6)).toFixed(2)} USDG` : null;

  // live ETH price: eth_call of the router's ETH→USDG swap with a balance override (nothing is sent)
  useEffect(() => {
    if (!pc || routerMissing) return;
    let alive = true;
    const probe = "0x0000000000000000000000000000000000000001" as const;
    pc.simulateContract({
      address: ADDR.router,
      abi: RouterAbi,
      functionName: "swapEthForUsdg",
      args: [0n, probe, BigInt(Math.floor(Date.now() / 1000) + 600)],
      value: parseUnits("1", 18),
      account: probe,
      stateOverride: [{ address: probe, balance: parseUnits("2", 18) }],
    })
      .then(({ result }) => alive && setEthUsd(Number(formatUnits(result as bigint, 6))))
      .catch(() => alive && setEthFail(true));
    return () => {
      alive = false;
    };
  }, [pc, routerMissing]);

  // validation
  const f = (k: string, ok: boolean, err: string | null, val: string): Field => ({ ok: ok && val.length > 0, err: touched[k] && !ok ? err : null });
  const vName = f("name", name.trim().length >= 2 && name.length <= 40, name.trim().length < 2 ? "At least 2 characters." : null, name);
  const vSym = f("symbol", /^[A-Z0-9]{1,12}$/.test(symbol), symbol.length === 0 ? "1 to 12 letters or digits." : null, symbol);
  const urlOk = (v: string) => v === "" || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v);
  const vWeb = f("website", urlOk(website), urlOk(website) ? null : "Enter a link like https://example.com", website);
  const vX = f("twitter", website === "" || true, null, twitter);
  const vTg = f("telegram", telegram === "" || /^(https?:\/\/)?(t\.me\/)?[\w+]+$/i.test(telegram), "Enter t.me/name or a handle.", telegram);
  const vDesc: Field = { ok: description.trim().length > 0 && description.length <= 600, err: null };
  const step1 = vName.ok && vSym.ok && !vWeb.err && !vTg.err;
  const step2 = !!word;
  const amountNum = Number(amount) || 0;
  const step3 = amountNum >= 0 && (amount === "" || Number.isFinite(amountNum));

  // first buy estimate
  const coinIn = word ? (cur === "USDG" ? (amountNum / word.price) * PEG_FEE : ethUsd ? ((amountNum * ethUsd) / word.price) * PEG_FEE : null) : null;
  const tokensOut = coinIn !== null && word ? estimateTokens(coinIn, feeBps, word.price) : null;
  const usdIn = cur === "USDG" ? amountNum : ethUsd ? amountNum * ethUsd : null;
  const sharePct = tokensOut ? (tokensOut / SUPPLY) * 100 : 0;
  const feePct = feeBps / 100;

  const onFile = (file: File | null) => {
    setImgErr(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setImgErr("PNG, JPEG or WebP only.");
    if (file.size > MAX_IMG) return setImgErr("Up to 5 MB.");
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };
  const removeImage = () => {
    setImage(null);
    setPreview(null);
  };
  const submit = () => {
    if (!word) return;
    const input: LaunchInput = { name: name.trim(), symbol, description: description.trim(), website: website.trim(), twitter: twitter.trim(), telegram: telegram.trim(), image, wordId: word.id as Hex, feeBps, cur, amount: amount || "0" };
    launch(input);
  };
  const ready = step1 && step2 && step3 && !busy;
  const statusText: Record<string, string> = { uploading: "Uploading metadata", approving: "Approve USDG in your wallet", signing: "Confirm in your wallet", pending: "Pending on chain" };
  const ctaLabel = !connected ? "Connect wallet to launch" : wrongChain ? "Switch to Robinhood Chain" : cur === "USDG" && amountNum > 0 ? "Approve USDG and launch" : "Launch market";

  if (state.status === "success" && state.token) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/token/${state.token}`;
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(`$${symbol} is live on GTR, priced in ${word?.symbol}. ${link}`)}`;
    return (
      <div className="card success fu">
        <div className="big-tick"><Tick /></div>
        <h2 style={{ fontSize: 24 }}>${symbol} is live</h2>
        <p className="muted" style={{ marginTop: 6 }}>Your market is open on the curve, priced in {word?.symbol}. Holders get paid every 15 minutes.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
          <Link className="btn primary" href={`/token/${state.token}`}>Open market</Link>
          <a className="btn" href={intent} target="_blank" rel="noopener noreferrer"><ServiceIcon name="x" label={false} /> Share on X</a>
          {state.hash ? <a className="btn" href={`${EXPLORER}/tx/${state.hash}`} target="_blank" rel="noopener noreferrer"><ServiceIcon name="blockscout" label={false} /> Transaction</a> : null}
        </div>
        <button type="button" className="btn sm" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>Launch another</button>
      </div>
    );
  }

  const stepCls = (done: boolean, active: boolean) => `flow-step ${done ? "done" : ""} ${active ? "active" : ""}`;

  return (
    <div className="launch-grid">
      <div className="card fu" style={{ ["--d" as string]: 1, padding: 24 }}>
        <div className="flow">
          {/* 1 Identity */}
          <section className={stepCls(step1, !step1)}>
            <div className="rail"><span className="rail-dot">{step1 ? <Tick /> : "1"}</span><span className="rail-line" /></div>
            <div style={{ minWidth: 0 }}>
              <h2>Identity</h2>
              <p className="lead">Name, ticker and image. Links are optional.</p>
              <div className="identity-grid">
                <div className="field">
                  <label>Image</label>
                  <div
                    className={`dropzone ${drag ? "drag" : ""} ${preview ? "has" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0] ?? null); }}
                  >
                    {preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="" />
                        <button type="button" className="rm" aria-label="Remove image" onClick={(e) => { e.preventDefault(); removeImage(); }}>✕</button>
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span>Drop an image or click<br />PNG, JPEG, WebP · 5 MB</span>
                      </>
                    )}
                    {!preview ? <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] ?? null)} /> : null}
                  </div>
                  {imgErr ? <span className="err">{imgErr}</span> : image ? <span className="hint">{(image.size / 1024).toFixed(0)} KB</span> : null}
                </div>
                <div className="stack" style={{ gap: 14 }}>
                  <div className="grid2" style={{ gap: 14 }}>
                    <Labeled label="Name" count={name.length} max={40} state={vName}>
                      <div className="input"><input value={name} onChange={(e) => { touch("name"); setName(e.target.value.slice(0, 40)); }} placeholder="Fear Index" /></div>
                    </Labeled>
                    <Labeled label="Ticker" count={symbol.length} max={12} state={vSym}>
                      <div className="input"><span className="prefix">$</span><input value={symbol} onChange={(e) => { touch("symbol"); setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)); }} placeholder="FEAR" /></div>
                    </Labeled>
                  </div>
                  <div className="grid3" style={{ gap: 14 }}>
                    <Labeled label="Website" optional state={vWeb}>
                      <div className="input"><span className="lead-ic"><ServiceIcon name="web" label={false} /></span><input value={website} onChange={(e) => { touch("website"); setWebsite(e.target.value); }} placeholder="https://" /></div>
                    </Labeled>
                    <Labeled label="X" optional state={vX}>
                      <div className="input"><span className="lead-ic"><ServiceIcon name="x" label={false} /></span><input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" /></div>
                    </Labeled>
                    <Labeled label="Telegram" optional state={vTg}>
                      <div className="input"><span className="lead-ic"><ServiceIcon name="telegram" label={false} /></span><input value={telegram} onChange={(e) => { touch("telegram"); setTelegram(e.target.value); }} placeholder="t.me/" /></div>
                    </Labeled>
                  </div>
                  <Labeled label="Description" optional count={description.length} max={600} state={vDesc}>
                    <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 600))} placeholder="What is this market about" />
                  </Labeled>
                </div>
              </div>
            </div>
          </section>

          {/* 2 Word */}
          <section className={stepCls(step2, step1 && !step2)}>
            <div className="rail"><span className="rail-dot">{step2 ? <Tick /> : "2"}</span><span className="rail-line" /></div>
            <div style={{ minWidth: 0 }}>
              <h2>Paired word</h2>
              <p className="lead">Your market is priced in this coin. Caps get fixed in it at today&apos;s price.</p>
              <div className="input" style={{ marginBottom: 12 }}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, color: "var(--muted)", flex: "none" }}><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m15 15 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${launchable.length} word${launchable.length === 1 ? "" : "s"}`} aria-label="Search words" />
              </div>
              {launchable.length === 0 ? (
                <div className="empty">No word coins are deployed yet. <Link href="/words">See the catalogue.</Link></div>
              ) : filtered.length === 0 ? (
                <div className="empty">No word matches “{q}”. <button type="button" className="btn sm" onClick={() => setQ("")}>Clear</button></div>
              ) : (
                <div className="word-grid" role="listbox" aria-label="Words">
                  {filtered.map((w) => {
                    const on = w.id === wordId;
                    const dir = w.change24h === null ? "flat" : w.change24h > 0 ? "up" : w.change24h < 0 ? "down" : "flat";
                    return (
                      <div
                        key={w.id}
                        role="option"
                        aria-selected={on}
                        tabIndex={0}
                        className={`word-card ${on ? "on" : ""}`}
                        onClick={() => setWordId(w.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setWordId(w.id);
                          }
                        }}
                      >
                        {on ? <span className="tick"><Tick /></span> : null}
                        <div className="wc-top">
                          <WordDot symbol={w.symbol} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div className="wc-name">{w.name}</div>
                            <div className="wc-sub">{w.symbol}</div>
                          </div>
                        </div>
                        <div className="wc-num num">
                          <b>${fmtPrice(w.price)}</b>
                          <span><Change value={w.change24h} /></span>
                        </div>
                        <Sparkline values={w.spark} dir={dir} w={132} h={22} />
                        <div className="wc-foot"><span>{w.marketsCount} market{w.marketsCount === 1 ? "" : "s"}{w.views !== null ? ` · ${fmtNum(w.views)} views` : ""}</span><IconLinks wiki={w.wikiTitle} coin={w.coin} gap={6} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 3 Fee and first buy */}
          <section className={stepCls(step1 && step2 && step3 && amount !== "", step1 && step2)} style={{ paddingBottom: 0 }}>
            <div className="rail"><span className="rail-dot">{step1 && step2 && amount !== "" ? <Tick /> : "3"}</span></div>
            <div style={{ minWidth: 0 }}>
              <h2>Fee and first buy</h2>
              <p className="lead">The fee is charged on every trade. Holders get 40% of it in {word?.symbol ?? "the word coin"}.</p>
              <div className="grid2">
                <div className="field">
                  <label>Trading fee</label>
                  <div className="seg">
                    {([100, 200, 300] as const).map((fb) => (
                      <button type="button" key={fb} className={feeBps === fb ? "on" : ""} onClick={() => setFeeBps(fb)}>{fb / 100}%</button>
                    ))}
                  </div>
                  <span className="hint num">On a $1,000 trade holders get ${(10 * feePct * 0.4).toFixed(0)}, buyback ${(10 * feePct * 0.3).toFixed(0)}, exchange ${(10 * feePct * 0.3).toFixed(0)}. You get nothing as creator, on purpose.</span>
                </div>
                <div className="field">
                  <div className="field-heading">
                    <label htmlFor="first-buy">First buy<small>optional</small></label>
                    <span className="chips nowrap" role="group" aria-label="First buy currency">
                      <Chip on={cur === "ETH"} onClick={() => setCur("ETH")}><ServiceIcon name="eth" /></Chip>
                      <Chip on={cur === "USDG"} onClick={() => setCur("USDG")}><ServiceIcon name="usdg" /></Chip>
                    </span>
                  </div>
                  <div className="input big num">
                    <input id="first-buy" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className="suffix">{cur}</span>
                  </div>
                  {balText ? <span className="hint num">Balance {balText}</span> : null}
                  <div className="quick">
                    {(cur === "ETH" ? ["0.01", "0.05", "0.1"] : ["10", "50", "100"]).map((v) => (
                      <button type="button" key={v} className={`chip ${amount === v ? "on" : ""}`} onClick={() => setAmount(v)}>{v} {cur}</button>
                    ))}
                  </div>
                  <span className="hint">Swapped to {word?.symbol ?? "the word coin"} and bought into your market in the same transaction.</span>
                </div>
              </div>
              {word && amountNum > 0 ? (
                <div className="estimate">
                  <div>
                    <b className="num">{tokensOut !== null ? `${fmtCompact(tokensOut)} $${symbol || "TOKEN"}` : "estimate unavailable"}</b>
                    <small>{tokensOut !== null ? `you would get · ${sharePct.toFixed(2)}% of supply` : cur === "ETH" && ethUsdFailed ? "ETH price could not be read from the router" : "reading the ETH price…"}</small>
                  </div>
                  <div>
                    <b className="num">{usdIn !== null ? fmtUsd(usdIn) : "–"}</b>
                    <small>{coinIn !== null ? `≈ ${fmtCompact(coinIn, 2)} ${word.symbol} at $${fmtPrice(word.price)}` : "for your first buy"}</small>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <aside className="fu" style={{ ["--d" as string]: 2 }}>
        <div className="card preview">
          <div className="card-head" style={{ marginBottom: 0 }}><h2>Preview</h2><span className="cap">live</span></div>
          <div className="pv-card">
            <div className="hc-top">
              <MemeAvatar symbol={symbol || "?"} image={preview} size={36} />
              <div style={{ minWidth: 0 }}>
                <div className="hc-name">{name || "Your market"}</div>
                <div className="hc-sub">${symbol || "TICKER"}</div>
              </div>
            </div>
            <span className="hc-badge">{word ? `${word.name} · ${word.symbol}` : "pick a word"}</span>
            <div className="hc-num num">
              <b>$5,000</b>
              <span className="cap">opens at this cap</span>
            </div>
            <div className="cap num" style={{ marginTop: 6 }}>
              {tokensOut !== null && amountNum > 0 && usdIn !== null ? `You would hold ${sharePct.toFixed(2)}% of supply for ${fmtUsd(usdIn)}` : "Add a first buy to see your share"}
            </div>
          </div>
          <div>
            <div className="cap" style={{ marginBottom: 6 }}>Fee split at {feePct}%</div>
            <FeeSplit />
            <div className="legend"><span><i style={{ background: "var(--purple)" }} />40% holders</span><span><i style={{ background: "#8ab4f8" }} />30% buyback</span><span><i style={{ background: "var(--tp-outline)" }} />30% exchange</span></div>
          </div>
          <div>
            <div className="cap" style={{ marginBottom: 6 }}>What happens next</div>
            <ul className="next-list">
              <li><i className="dot-blue" />Trades on the curve from a $5,000 cap{word ? ` · ${fmtCompact(CAP_OPEN / word.price)} ${word.symbol}` : ""}</li>
              <li><i className="dot-red" />Migrates at a $35,000 cap{word ? ` · ${fmtCompact(CAP_MIGRATE / word.price)} ${word.symbol}` : ""}</li>
              <li><i className="dot-yellow" /><ServiceIcon name="uniswap" /> v4 pool, held by the launchpad forever</li>
              <li><i className="dot-green" />Holders paid every 15 minutes, nothing to claim</li>
            </ul>
          </div>
          <div>
            <KV k="Supply"><span className="num">1,000,000,000</span></KV>
            <KV k="Trading fee"><span className="num">{feePct}%</span></KV>
            <KV k="First buy"><span className="num">{amountNum > 0 ? `${amount} ${cur}` : "none"}</span></KV>
            <KV k="Cost"><span>gas only, no listing fee</span></KV>
          </div>
          {!connected ? (
            <ConnectInline label="Connect wallet to launch" />
          ) : wrongChain ? (
            <button className="btn primary lg block" disabled={switching} onClick={() => switchChain({ chainId: robinhood.id })}>Switch to Robinhood Chain</button>
          ) : (
            <button className="btn primary lg block" disabled={!ready} onClick={submit}>{busy ? statusText[state.status] : ctaLabel}</button>
          )}
          {busy ? (
            <div className="status-line">
              <span className="spinner" />
              <span>{statusText[state.status]}</span>
              {state.hash ? <a className="svcw" href={`${EXPLORER}/tx/${state.hash}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto" }}><ServiceIcon name="blockscout" label={false} /> View</a> : null}
            </div>
          ) : null}
          {!ready && !busy && connected && !wrongChain ? <span className="hint">{!step1 ? "Fill in a name and a ticker." : !step2 ? "Pick a word to pair with." : ""}</span> : null}
          {state.error ? <p className="err">{state.error}</p> : null}
          <p className="hint">Deploys on <ServiceIcon name="rhc" />. Liquidity stays with the launchpad forever, there is no withdraw function.</p>
        </div>
      </aside>
    </div>
  );
}
