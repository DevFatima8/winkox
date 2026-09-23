"use client";

import { localApi } from "@/lib/client";
import { playGameSound, speakGameVoice } from "@/lib/gameAudio";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UsersIcon, XIcon } from "@/components/Icons";

type Table = "dragon-tiger" | "andar-bahar";
type Card = { r: number; s: number };
type DTResult = { kind: "dragon-tiger"; dragon: Card; tiger: Card; winner: "dragon" | "tiger" | "tie" };
type ABResult = { kind: "andar-bahar"; joker: Card; andar: Card[]; bahar: Card[]; winner: "andar" | "bahar"; dealMs: number };
type Result = DTResult | ABResult;
type Opt = { label: string; pays: string; mult: number };
type State = {
  serverNow: number; table: Table;
  config: { name: string; betMs: number; options: Record<string, Opt>; min: number; max: number };
  round: { roundNo: number; status: "betting" | "revealing" | "settled"; bettingEndsAt: number; revealEndsAt: number; result: Result | null };
  myBets: { option: string; amount: number; status: string; payout: number }[];
  myTotal: number; myExpected: number;
  totals: Record<string, { total: number; players: number }>;
  history: { roundNo: number; winner: string }[];
  stats: Record<string, number>;
  balance: number;
};

const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
const CHIPS = [50, 100, 150, 200];
const money = (n: number) => "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 2 });

const ZONE: Record<string, { bg: string; ring: string; text: string; bead: string; short: string }> = {
  dragon: { bg: "from-red-600 to-red-800", ring: "ring-red-400", text: "text-red-300", bead: "bg-red-500", short: "D" },
  tie: { bg: "from-emerald-600 to-emerald-800", ring: "ring-emerald-400", text: "text-emerald-300", bead: "bg-emerald-500", short: "T" },
  tiger: { bg: "from-amber-500 to-orange-700", ring: "ring-amber-300", text: "text-amber-300", bead: "bg-amber-500", short: "T" },
  andar: { bg: "from-sky-600 to-blue-800", ring: "ring-sky-300", text: "text-sky-300", bead: "bg-sky-500", short: "A" },
  bahar: { bg: "from-rose-600 to-red-800", ring: "ring-rose-300", text: "text-rose-300", bead: "bg-rose-500", short: "B" },
};

/* ---------------- playing card ---------------- */
function PlayingCard({ card, faceUp, size = "md", glow, dim }: { card?: Card | null; faceUp: boolean; size?: "sm" | "md" | "lg"; glow?: boolean; dim?: boolean }) {
  const dims = size === "lg" ? "h-36 w-[6.5rem]" : size === "md" ? "h-28 w-20" : "h-[4.6rem] w-[3.3rem]";
  const red = card ? card.s === 1 || card.s === 2 : false;
  const fs = size === "lg" ? { corner: "text-lg", big: "text-5xl" } : size === "md" ? { corner: "text-sm", big: "text-4xl" } : { corner: "text-[10px]", big: "text-xl" };
  return (
    <div className={`relative shrink-0 ${dims} ${dim ? "opacity-60" : ""}`} style={{ perspective: 800 }}>
      <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transformStyle: "preserve-3d", transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        {/* back */}
        <div className="absolute inset-0 overflow-hidden rounded-lg border-2 border-white bg-[#1d4ed8] shadow-lg" style={{ backfaceVisibility: "hidden" }}>
          <div className="absolute inset-1 rounded-md border border-white/60 bg-[repeating-linear-gradient(45deg,#1e40af_0_6px,#2563eb_6px_12px)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-black tracking-tight text-blue-800">WG</span>
          </div>
        </div>
        {/* face */}
        <div className={`absolute inset-0 flex flex-col justify-between rounded-lg border bg-white p-1 shadow-xl ${red ? "text-red-600" : "text-slate-900"} ${glow ? "ring-4 ring-yellow-300 shadow-[0_0_28px_rgba(253,224,71,.8)]" : "border-slate-300"}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          {card && (
            <>
              <div className={`${fs.corner} font-black leading-none`}>{RANKS[card.r]}<div className="-mt-0.5">{SUITS[card.s]}</div></div>
              <div className={`${fs.big} text-center leading-none`}>{SUITS[card.s]}</div>
              <div className={`${fs.corner} rotate-180 font-black leading-none`}>{RANKS[card.r]}<div className="-mt-0.5">{SUITS[card.s]}</div></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- component ---------------- */
export function CardTable({ table }: { table: Table }) {
  const [st, setSt] = useState<State | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [chip, setChip] = useState(100);
  const [customAmount, setCustomAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err" | "info"; m: string } | null>(null);
  const [toast, setToast] = useState<{ roundNo: number; text: string; win: boolean } | null>(null);
  const lastBetsRef = useRef<{ option: string; amount: number }[]>([]);
  const shownRef = useRef<number>(0);
  const stRef = useRef<State | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await localApi(`/api/cards/state?table=${table}`, { cache: "no-store" });
      if (!r.ok) return;
      const s: State = await r.json();
      setOffset(s.serverNow - Date.now());
      stRef.current = s;
      setSt(s);
      if (s.myBets.length && s.round.status === "betting") lastBetsRef.current = s.myBets.map((b) => ({ option: b.option, amount: b.amount }));
    } catch { }
  }, [table]);

  useEffect(() => {
    setSt(null); stRef.current = null; shownRef.current = 0; setToast(null); setMsg(null);
    refresh();
    const id = setInterval(refresh, 800);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const post = async (method: "POST" | "DELETE", body?: unknown) => {
    setBusy(true);
    const r = await localApi(`/api/cards/bet${method === "DELETE" ? `?table=${table}` : ""}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    setBusy(false);
    return j;
  };

  const bet = async (option: string, amount = chip) => {
    if (busy) return;
    const j = await post("POST", { table, option, amount });
    if (j.error) setMsg({ t: "err", m: j.error });
    else setMsg(null);
    refresh();
  };
  const cancel = async () => {
    const j = await post("DELETE");
    if (j.error) setMsg({ t: "err", m: j.error });
    else setMsg({ t: "info", m: `Bets cancel — ${money(j.refunded)} wapas.` });
    refresh();
  };
  const rebet = async () => {
    if (!lastBetsRef.current.length || busy) return;
    for (const b of lastBetsRef.current) await post("POST", { table, option: b.option, amount: b.amount });
    refresh();
  };

  const sNow = now + offset;
  const round = st?.round;
  const inBetting = !!round && round.status === "betting" && sNow < round.bettingEndsAt;
  const remaining = round ? Math.max(0, (round.bettingEndsAt - sNow) / 1000) : 0;
  const revealT = round ? sNow - round.bettingEndsAt : -1; // ms since reveal started
  const result = round?.result ?? null;
  const revealDone = (() => {
    if (!result) return false;
    if (result.kind === "dragon-tiger") return revealT >= 2700;
    return revealT >= 1400 + (result.andar.length + result.bahar.length) * result.dealMs + 300;
  })();

  // result toast after animation completes
  useEffect(() => {
    if (!st || !round || !result || !revealDone || shownRef.current === round.roundNo) return;
    shownRef.current = round.roundNo;
    if (st.myTotal > 0) {
      const win = st.myExpected > 0;
      if (win) { playGameSound("coin"); speakGameVoice("cardWin"); } else { playGameSound("crash"); }
      window.dispatchEvent(new CustomEvent("wx:game-result", { detail: { game: table === "dragon-tiger" ? "Dragon Tiger" : "Andar Bahar", bet: st.myTotal, win: st.myExpected, won: win } }));
      setToast({ roundNo: round.roundNo, text: win ? `Aap jeete ${money(st.myExpected)}` : `${money(st.myTotal)} haar gaye`, win });
    }
    const id = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(id);
  }, [st, round, result, revealDone]);

  if (!st || !round) return <div className="py-24 text-center text-slate-400">Loading table…</div>;

  const opts = Object.keys(st.config.options);
  const winner = result && revealDone ? result.winner : null;
  const hasRoundBet = st.myTotal > 0;
  const myBy = (o: string) => st.myBets.filter((b) => b.option === o).reduce((s, b) => s + b.amount, 0);
  const histTotal = st.history.length || 1;

  return (
    <div className="mx-auto max-w-4xl space-y-3 lg:max-w-6xl">
      {/* header */}
      <div className="flex items-center justify-between rounded-2xl border border-[#3a2470] bg-[#1b1038] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] px-2 py-1 text-xs font-black text-slate-950">WG CARDS</div>
          <div>
            <div className="text-sm font-bold text-white">{st.config.name}</div>
            <div className="text-[11px] text-[#b8a7e6]">Round #{round.roundNo}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#0b0716] px-3 py-1.5 text-sm font-black text-[#ffb800]">{money(st.balance)}</div>
          <Link href="/client" className="rounded-lg bg-[#0b0716] px-3 py-1.5 text-xs text-[#b8a7e6] hover:text-white"></Link>
        </div>
      </div>

      {/* table tabs */}
      <div className="grid grid-cols-2 gap-2">
        {(["dragon-tiger", "andar-bahar"] as Table[]).map((t) => (
          <Link key={t} href={`/client/games/${t}`} className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${t === table ? "btn-violet" : "bg-[#1b1038] text-[#b8a7e6] hover:text-white"}`}>
            {t === "dragon-tiger" ? "Dragon Tiger" : "🃏 Andar Bahar"}
          </Link>
        ))}
      </div>

      <div className="space-y-3 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="lg:col-span-8">
          {/* felt */}
          <div className={`relative overflow-hidden rounded-[28px] border-[6px] shadow-2xl ${table === "dragon-tiger" ? "border-[#7a5a1e] bg-[#120809]" : "border-[#5b3a1a] bg-[radial-gradient(ellipse_at_center,#1e4fa3_0%,#12336f_60%,#0b2350_100%)]"}`}>
            {table === "dragon-tiger" && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[url('/games/dragon-tiger.jpg')] bg-cover bg-[center_30%] opacity-90" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[url('/games/tiger.jpg')] bg-cover bg-[center_30%] opacity-90" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(60,8,12,.55)_0%,rgba(20,6,8,.85)_50%,rgba(60,30,5,.55)_100%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.55)_0%,rgba(0,0,0,0)_35%,rgba(0,0,0,0)_60%,rgba(0,0,0,.6)_100%)]" />
              </>
            )}
            <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-yellow-200/20" />

            {/* history road */}
            <div className="flex items-center gap-1 overflow-x-auto px-4 pt-3">
              <span className="mr-1 shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/60">Last {st.history.length}</span>
              {st.history.map((h) => (
                <span key={h.roundNo} title={`#${h.roundNo}`} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${ZONE[h.winner]?.bead ?? "bg-slate-500"}`}>
                  {h.winner === "tie" ? "=" : ZONE[h.winner]?.short}
                </span>
              ))}
              {st.history.length === 0 && <span className="text-[10px] text-white/50">Pehla round…</span>}
            </div>

            {/* timer / status */}
            <div className="flex justify-center pt-3">
              {inBetting ? (
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.15)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke={remaining < 5 ? "#ef4444" : "#ffb800"} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28}`} strokeDashoffset={`${2 * Math.PI * 28 * (1 - remaining / (st.config.betMs / 1000))}`} />
                  </svg>
                  <div className="text-center"><div className="text-xl font-black leading-none text-white">{Math.ceil(remaining)}</div><div className="text-[9px] uppercase text-white/70">bet now</div></div>
                </div>
              ) : (
                <div className="rounded-full bg-black/40 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white">
                  {winner && hasRoundBet ? "Result" : winner ? "Round complete" : "No more bets — dealing…"}
                </div>
              )}
            </div>

            {/* cards area */}
            <div className="px-4 pb-5 pt-3 lg:px-8 lg:pb-8 lg:pt-5">
              {table === "dragon-tiger" ? (
                <DragonTigerStage result={result as DTResult | null} revealT={revealT} winner={winner} />
              ) : (
                <AndarBaharStage result={result as ABResult | null} revealT={revealT} winner={winner} />
              )}
            </div>

            {/* winner banner */}
            {winner && hasRoundBet && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div className={`animate-[pop_.4s_ease-out] rounded-2xl bg-gradient-to-r px-8 py-3 text-2xl font-black uppercase tracking-wider text-white shadow-2xl ${ZONE[winner].bg}`}>
                  {winner === "tie" ? "TIE!" : `${st.config.options[winner].label} wins!`}
                </div>
              </div>
            )}
            {toast && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
                <div className={`rounded-xl px-4 py-2 text-sm font-black shadow-xl ${toast.win ? "bg-yellow-400 text-slate-950" : "bg-slate-900/90 text-white"}`}>{toast.text}</div>
              </div>
            )}
            <style>{`@keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-4">
          {/* bet zones */}
          <div className={`grid gap-2 ${opts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {opts.map((o) => {
              const z = ZONE[o]; const cfg = st.config.options[o]; const tot = st.totals[o]; const mine = myBy(o);
              const isWin = hasRoundBet && winner === o;
              return (
                <button
                  key={o}
                  disabled={!inBetting || busy}
                  onClick={() => bet(o)}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-b p-3 text-left text-white shadow-lg transition ${z.bg} ${inBetting ? "hover:brightness-110 active:scale-[.98]" : "opacity-90"} ${isWin ? `ring-4 ${z.ring}` : ""} ${hasRoundBet && winner && !isWin ? "opacity-50" : ""} disabled:cursor-not-allowed`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black uppercase">{cfg.label}</span>
                    <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-bold">{cfg.pays}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-white/80">Pool {money(tot?.total ?? 0)} · {tot?.players ?? 0} </div>
                  <div className="mt-1 flex h-7 items-center gap-1">
                    {mine > 0 ? (
                      <>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-dashed border-white bg-yellow-400 text-[9px] font-black text-slate-950">{mine >= 1000 ? `${Math.floor(mine / 1000)}K` : mine}</span>
                        <span className="text-xs font-bold">{money(mine)}</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-white/60">{inBetting ? `Tap: +${money(chip)}` : "—"}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* chips + actions */}
          <div className="rounded-2xl border border-[#3a2470] bg-[#1b1038] p-3">
            <div className="flex flex-wrap items-center gap-2">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => setChip(c)} className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-dashed text-xs font-black transition ${chip === c ? "scale-110 border-white bg-[#ffb800] text-slate-950 shadow-lg shadow-yellow-500/40" : "border-white/40 bg-[#0b0716] text-white hover:border-white"}`}>
                  {c >= 1000 ? `${c / 1000}K` : c}
                </button>
              ))}
              <div className="flex items-center gap-2 rounded-full border border-white/30 bg-[#0b0716] px-2 py-1.5">
                <input type="number" min={st.config.min} max={st.config.max} value={customAmount} onChange={(e) => setCustomAmount(Math.max(st.config.min, Math.min(st.config.max, Number(e.target.value) || st.config.min)))} className="w-16 bg-transparent text-center text-xs font-black text-white outline-none" />
                <button onClick={() => setChip(customAmount)} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${chip === customAmount ? "bg-[#ffb800] text-slate-950" : "bg-[#2a1d4d] text-white"}`}>
                  Custom
                </button>
              </div>
              <div className="ml-auto flex gap-2">
                <button disabled={!inBetting || busy || !lastBetsRef.current.length || st.myTotal > 0} onClick={rebet} className="rounded-xl bg-[#8b5cf6] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Rebet</button>
                <button disabled={!inBetting || busy || st.myTotal === 0} onClick={cancel} className="rounded-xl bg-red-500/20 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Cancel</button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#b8a7e6]">
              <span>Is round: <b className="text-white">{money(st.myTotal)}</b>{result && st.myTotal > 0 && revealDone ? <> → <b className={st.myExpected > 0 ? "text-emerald-400" : "text-red-400"}>{money(st.myExpected)}</b></> : null}</span>
              <span>Min {st.config.min} · Max {st.config.max.toLocaleString()}</span>
            </div>
            {msg && <p className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${msg.t === "err" ? "bg-red-500/15 text-red-300" : "bg-sky-500/15 text-sky-300"}`}>{msg.m}</p>}
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {opts.map((o) => (
              <div key={o} className="rounded-xl bg-[#1b1038] px-2 py-2">
                <div className={`font-black uppercase ${ZONE[o].text}`}>{st.config.options[o].label}</div>
                <div className="text-white">{Math.round(((st.stats[o] ?? 0) / histTotal) * 100)}% <span className="text-[#6f5fa3]">({st.stats[o] ?? 0})</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- stages ---------------- */
function DragonTigerStage({ result, revealT, winner }: { result: DTResult | null; revealT: number; winner: string | null }) {
  const dealing = !!result && revealT >= 0;
  const dIn = dealing && revealT >= 100, tIn = dealing && revealT >= 600;
  const dUp = dealing && revealT >= 1300, tUp = dealing && revealT >= 2200;
  const slot = (inn: boolean) => `transition-all duration-500 ${inn ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0"}`;
  return (
    <div className="relative">
      {/* shoe */}
      <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1 items-center gap-1 rounded-b-xl bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-200">
        <span className="inline-block h-3 w-2 rounded-sm bg-blue-600 ring-1 ring-white" />8-deck shoe
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-6 sm:gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-red-600/80 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white shadow">Dragon</span>
          <div className={`relative h-36 w-[6.5rem] ${slot(dIn)}`}>
            {!dealing && <div className="absolute inset-0 rounded-lg border-2 border-dashed border-white/30" />}
            {dealing && <PlayingCard card={result?.dragon} faceUp={dUp} size="lg" glow={winner === "dragon" || winner === "tie"} dim={winner === "tiger"} />}
          </div>
          {dUp && result && <span className="text-[11px] font-bold text-red-200">Value {result.dragon.r}</span>}
        </div>
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-300 bg-gradient-to-b from-yellow-400 to-amber-600 text-lg font-black text-slate-950 shadow-[0_0_24px_rgba(251,191,36,.6)]">VS</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-amber-500/90 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-slate-950 shadow">Tiger </span>
          <div className={`relative h-36 w-[6.5rem] ${slot(tIn)}`}>
            {!dealing && <div className="absolute inset-0 rounded-lg border-2 border-dashed border-white/30" />}
            {dealing && <PlayingCard card={result?.tiger} faceUp={tUp} size="lg" glow={winner === "tiger" || winner === "tie"} dim={winner === "dragon"} />}
          </div>
          {tUp && result && <span className="text-[11px] font-bold text-amber-200">Value {result.tiger.r}</span>}
        </div>
      </div>
    </div>
  );
}

function AndarBaharStage({ result, revealT, winner }: { result: ABResult | null; revealT: number; winner: string | null }) {
  const jokerUp = !!result && revealT >= 300;
  const dealt = result ? Math.max(0, Math.min(result.andar.length + result.bahar.length, Math.floor((revealT - 1400) / result.dealMs) + 1)) : 0;
  const andarN = Math.ceil(dealt / 2), baharN = Math.floor(dealt / 2);
  const total = result ? result.andar.length + result.bahar.length : 0;
  const Row = ({ side, cards, n }: { side: "andar" | "bahar"; cards: Card[]; n: number }) => (
    <div className={`rounded-xl border px-2 py-1.5 ${winner === side ? `${ZONE[side].ring} ring-2 border-transparent bg-white/10` : "border-white/15 bg-black/20"}`}>
      <div className={`mb-1 text-[10px] font-black uppercase tracking-widest ${ZONE[side].text}`}>{side} <span className="text-white/50">({n})</span></div>
      <div className="flex h-[4.8rem] items-center overflow-x-auto">
        {cards.slice(0, n).map((c, i) => {
          const isLast = i === n - 1 && total === dealt && winner === side;
          return <div key={i} className={i === 0 ? "" : "-ml-8"}><PlayingCard card={c} faceUp size="sm" glow={isLast} /></div>;
        })}
        {n === 0 && <span className="text-[11px] text-white/40">—</span>}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-200">Joker</span>
        <PlayingCard card={result?.joker} faceUp={jokerUp} size="md" glow={!!winner} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Row side="andar" cards={result?.andar ?? []} n={result ? andarN : 0} />
        <Row side="bahar" cards={result?.bahar ?? []} n={result ? baharN : 0} />
      </div>
    </div>
  );
}
