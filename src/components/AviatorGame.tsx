"use client";

import { localApi } from "@/lib/client";
import { playGameSound, speakGameVoice } from "@/lib/gameAudio";

import { useCallback, useEffect, useRef, useState } from "react";

/* Spribe-style Aviator / Aviator X */
type Table = "aviator" | "aviator-x";
type Bet = { id: string; slot: number; bet: number; win: number; outcome: string; data: string | null };
type State = {
  serverNow: number; table: Table;
  config: { name: string; slots: number; minBet: number; maxBet: number; waitMs: number; growth: number; maxMult: number };
  round: { id: number; status: "waiting" | "running" | "crashed"; startsAt: number; endedAt: number | null; crashPoint: number | null };
  history: { id: number; crashPoint: number }[];
  bets: { id: string; name: string; bet: number; win: number; outcome: string; data: string | null; mult: number | null }[];
  totals: { count: number; amount: number; cashed: number };
  myBets: Bet[]; queued: { slot: number; bet: number }[];
  myHistory: { id: string; round: number; bet: number; win: number; outcome: string; at: string }[];
  top: { name: string; bet: number; win: number; mult: number; round: number }[];
  balance: number;
};
const THEME = {
  aviator: { accent: "#e50539", bg: "#0e0e0e", panel: "#1b1c1d", panel2: "#141516", line: "#2c2d30", curve: "#e50539", fill: "rgba(229,5,57,.30)", plane: "#e50539", title: "Aviator", logo: "text-[#e50539]", rays: "rgba(255,255,255,.035)" },
  "aviator-x": { accent: "#00d1ff", bg: "#050914", panel: "#0b1226", panel2: "#080d1c", line: "#1a2748", curve: "#00d1ff", fill: "rgba(0,209,255,.22)", plane: "#ff3d00", title: "Aviator X", logo: "text-[#00d1ff]", rays: "rgba(0,209,255,.06)" },
};
const AV = ["#c0392b", "#8e44ad", "#2980b9", "#16a085", "#d35400", "#27ae60", "#7f8c8d", "#f39c12"];
const cpClass = (m: number) => (m < 2 ? "bg-[#34b4ff]/20 text-[#34b4ff]" : m < 10 ? "bg-[#913ef8]/20 text-[#c274ff]" : "bg-[#c017b4]/20 text-[#ff4dd8]");
const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Panel = { tab: "bet" | "auto"; amount: string; customAmount: string; autoBet: boolean; autoCash: boolean; autoCashAt: string; busy: boolean };
const mk = (): Panel => ({ tab: "bet", amount: "100.00", customAmount: "100.00", autoBet: false, autoCash: false, autoCashAt: "2.00", busy: false });

export function AviatorGame({ table = "aviator" }: { table?: Table }) {
  const T = THEME[table];
  const [state, setState] = useState<State | null>(null);
  const [offset, setOffset] = useState(0);
  const [mult, setMult] = useState(1);
  const [phase, setPhase] = useState<"waiting" | "running" | "crashed">("waiting");
  const [countdown, setCountdown] = useState(0);
  const [panels, setPanels] = useState<Panel[]>([mk(), mk(), mk()]);
  const [tab, setTab] = useState<"all" | "prev" | "top">("all");
  const [toast, setToast] = useState<{ t: "ok" | "err"; m: string; sub?: string } | null>(null);
  const [showHist, setShowHist] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [sound, setSound] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stRef = useRef<State | null>(null);
  const panelsRef = useRef(panels); panelsRef.current = panels;
  const autoCashFired = useRef<Record<number, number>>({});
  const autoBetDone = useRef<Record<number, number>>({});
  const sizeRef = useRef({ w: 640, h: 380, dpr: 1 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCrashShown = useRef(0);
  const lastRoundSound = useRef(0);

  const showToast = useCallback((t: "ok" | "err", m: string, sub?: string) => { setToast({ t, m, sub }); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3000); }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await localApi(`/api/aviator/state?table=${table}`, { cache: "no-store" });
      if (!r.ok) return;
      const s: State = await r.json();
      setOffset(s.serverNow - Date.now());
      stRef.current = s; setState(s);
    } catch { }
  }, [table]);
  useEffect(() => { refresh(); const id = setInterval(refresh, 600); return () => clearInterval(id); }, [refresh]);

  const api = useCallback(async (url: string, init?: RequestInit) => {
    const r = await localApi(url, init);
    if (r.status === 401) { window.location.href = "/login"; return null; }
    return r.json();
  }, []);
  const setPanel = useCallback((i: number, patch: Partial<Panel>) => setPanels((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p))), []);

  const placeBet = useCallback(async (i: number) => {
    const p = panelsRef.current[i]; if (p.busy) return;
    const amount = Number(p.amount);
    setPanel(i, { busy: true });
    const j = await api("/api/aviator/bet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, amount, slot: i }) });
    setPanel(i, { busy: false });
    if (!j) return;
    if (j.error) showToast("err", j.error);
    await refresh();
  }, [api, table, refresh, setPanel, showToast]);

  const cancelBet = useCallback(async (i: number) => {
    setPanel(i, { busy: true });
    await api(`/api/aviator/bet?table=${table}&slot=${i}`, { method: "DELETE" });
    setPanel(i, { busy: false }); await refresh();
  }, [api, table, refresh, setPanel]);

  const cashOut = useCallback(async (i: number) => {
    const p = panelsRef.current[i]; if (p.busy) return;
    setPanel(i, { busy: true });
    const j = await api("/api/aviator/cashout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, slot: i }) });
    setPanel(i, { busy: false });
    if (!j) return;
    if (j.error) showToast("err", j.error); else { if (sound) { playGameSound("cashout"); speakGameVoice("planeWin"); } showToast("ok", `You have cashed out! ${fmt2(j.multiplier)}x`, `Win PKR ${fmt2(j.win)}`); }
    await refresh();
  }, [api, table, refresh, setPanel, showToast, sound]);

  const sizeCanvas = useCallback(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current; if (!wrap || !canvas) return;
    const w = wrap.clientWidth, h = wrap.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w < 10 || h < 10) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    sizeRef.current = { w, h, dpr };
  }, []);
  useEffect(() => {
    sizeCanvas();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sizeCanvas) : null;
    if (wrapRef.current && ro) ro.observe(wrapRef.current);
    window.addEventListener("resize", sizeCanvas);
    const id = window.setInterval(sizeCanvas, 500); // safety net for layouts that settle late
    return () => { ro?.disconnect(); window.removeEventListener("resize", sizeCanvas); window.clearInterval(id); };
  }, [sizeCanvas]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = stRef.current, canvas = canvasRef.current; if (!s || !canvas) return;
      const now = Date.now() + offset;
      let ph = s.round.status; let m = 1;
      if (ph === "waiting") { setCountdown(Math.max(0, (s.round.startsAt - now) / 1000)); if (now >= s.round.startsAt) ph = "running"; }
      if (ph === "running") m = Math.min(s.config.maxMult, Math.floor(Math.exp(s.config.growth * Math.max(0, (now - s.round.startsAt) / 1000)) * 100) / 100);
      if (ph === "crashed") m = s.round.crashPoint ?? m;
      setMult(m); setPhase(ph);
      // auto-bet: at waiting phase, place once per round if enabled and no bet yet
      if (ph === "waiting") {
        panelsRef.current.forEach((p, i) => {
          if (i >= s.config.slots || !p.autoBet) return;
          const has = s.myBets.some((b) => b.slot === i);
          if (!has && autoBetDone.current[i] !== s.round.id) { autoBetDone.current[i] = s.round.id; placeBet(i); }
        });
      }
      // auto cash out
      if (ph === "running") {
        panelsRef.current.forEach((p, i) => {
          const mine = s.myBets.find((b) => b.slot === i && b.outcome === "pending");
          const target = parseFloat(p.autoCashAt);
          if (p.autoCash && mine && target >= 1.01 && m >= target && autoCashFired.current[i] !== s.round.id) { autoCashFired.current[i] = s.round.id; cashOut(i); }
        });
      }
      // lost toast
      if (ph === "crashed" && lastCrashShown.current !== s.round.id) {
        lastCrashShown.current = s.round.id;
        if (sound) { playGameSound("crash"); speakGameVoice("planeCrash"); }
        const lost = s.myBets.filter((b) => b.outcome === "lose");
        if (lost.length) showToast("err", `Flew away at ${fmt2(s.round.crashPoint ?? m)}x`, `Lost PKR ${fmt2(lost.reduce((a, b) => a + b.bet, 0))}`);
      }
      if (ph === "running" && lastRoundSound.current !== s.round.id) {
        lastRoundSound.current = s.round.id;
        if (sound) { playGameSound("launch"); speakGameVoice("planeLaunch"); }
      }
      draw(canvas, sizeRef.current, T, ph, m, now, s);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [offset, T, placeBet, cashOut, showToast, sound]);

  if (!state) return <div className="flex h-[60vh] items-center justify-center rounded-2xl text-slate-400" style={{ background: T.bg }}>Loading {T.title}…</div>;
  const slots = state.config.slots;

  return (
    <div className="relative overflow-hidden rounded-2xl text-[12px] text-[#bbbfc5]" style={{ background: T.bg }}>
      {/* top bar */}
      <div className="flex items-center justify-between px-2 py-1" style={{ background: T.panel2, borderBottom: `1px solid ${T.line}` }}>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-black italic tracking-tight ${T.logo}`}>{T.title}</span>
          <button onClick={() => setRules(true)} className="ml-1 hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-300 sm:flex" style={{ background: T.panel }}><span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">?</span> How to play</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#28a909]">{fmt2(state.balance)} <span className="text-[10px] text-slate-400">PKR</span></span>
          <button onClick={() => setMenu((v) => !v)} className="flex h-7 w-7 flex-col items-center justify-center gap-[3px] rounded" style={{ background: T.panel }} aria-label="menu"><span className="h-[2px] w-4 bg-slate-300" /><span className="h-[2px] w-4 bg-slate-300" /><span className="h-[2px] w-4 bg-slate-300" /></button>
        </div>
      </div>
      {menu && (
        <div className="absolute right-3 top-11 z-40 w-56 rounded-lg p-2 text-xs shadow-2xl" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <button onClick={() => setSound(!sound)} className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-white/5"><span>Sound</span><span className={`h-4 w-8 rounded-full p-0.5 ${sound ? "bg-[#28a909]" : "bg-slate-600"}`}><span className={`block h-3 w-3 rounded-full bg-white transition ${sound ? "translate-x-4" : ""}`} /></span></button>
          <div className="my-1 border-t" style={{ borderColor: T.line }} />
          {[["Game rules", () => { setRules(true); setMenu(false); }], ["My bet history", () => { setTab("prev"); setMenu(false); }], ["Provably fair settings", () => setMenu(false)]].map(([l, fn]) => <button key={String(l)} onClick={fn as () => void} className="block w-full rounded px-2 py-2 text-left hover:bg-white/5">{String(l)}</button>)}
          <div className="my-1 border-t" style={{ borderColor: T.line }} /><a href="/client" className="block rounded px-2 py-2 hover:bg-white/5">Home</a>
        </div>
      )}

      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[260px_1fr] xl:grid-cols-[300px_1fr]">
        {/* LEFT: bets */}
        <aside className="order-2 w-full min-w-0 flex flex-col lg:order-1" style={{ background: T.panel2, borderRight: `1px solid ${T.line}` }}>
          <div className="flex gap-1 p-2">
            {(["all", "prev", "top"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className="flex-1 rounded-full py-1.5 text-xs font-semibold transition" style={{ background: tab === k ? T.panel : "transparent", color: tab === k ? "#fff" : "#8b8f96", border: `1px solid ${tab === k ? T.line : "transparent"}` }}>{k === "all" ? "All Bets" : k === "prev" ? "Previous" : "Top"}</button>)}
          </div>
          {tab === "all" && (
            <>
              <div className="flex items-center justify-between px-3 pb-1"><div><div className="text-[10px] uppercase text-slate-500">All bets</div><div className="text-sm font-bold text-white">{state.totals.count}</div></div><button onClick={() => setShowHist(true)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-slate-300" style={{ background: T.panel, border: `1px solid ${T.line}` }}>Previous hand</button></div>
              <div className="px-3 pb-1"><div className="h-1 overflow-hidden rounded-full" style={{ background: T.line }}><div className="h-full bg-[#28a909]" style={{ width: `${state.totals.count ? (state.totals.cashed / state.totals.count) * 100 : 0}%` }} /></div></div>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-1 text-[10px] uppercase text-slate-500"><span>User</span><span className="text-right">Bet PKR</span><span className="text-right">X</span><span className="text-right">Cash out</span></div>
              <ul className="max-h-[26vh] flex-1 space-y-[2px] overflow-y-auto px-2 pb-2 lg:max-h-[520px]">
                {state.bets.map((b) => (
                  <li key={b.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 rounded px-2 py-1 text-xs" style={{ background: b.outcome === "win" ? "rgba(18,55,23,.7)" : T.panel, border: b.outcome === "win" ? "1px solid #427f00" : "1px solid transparent" }}>
                    <span className="flex items-center gap-1.5 truncate"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: AV[(b.name.charCodeAt(0) + b.name.length) % AV.length] }}>{b.name.slice(0, 1)}</span><span className="truncate text-slate-300">{b.name}</span></span>
                    <span className="text-right text-slate-200">{fmt2(b.bet)}</span>
                    <span className="text-right">{b.mult ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cpClass(b.mult)}`}>{fmt2(b.mult)}x</span> : <span className="text-slate-600">—</span>}</span>
                    <span className="text-right text-slate-200">{b.outcome === "win" ? fmt2(b.win) : b.outcome === "lose" ? <span className="text-slate-600">—</span> : ""}</span>
                  </li>
                ))}
                {state.bets.length === 0 && <li className="py-6 text-center text-xs text-slate-600">No bets yet</li>}
              </ul>
            </>
          )}
          {tab === "prev" && (
            <ul className="max-h-[420px] space-y-[2px] overflow-y-auto px-2 pb-2">
              <li className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2 px-2 py-1 text-[10px] uppercase text-slate-500"><span>Round</span><span /><span className="text-right">Bet</span><span className="text-right">Win</span></li>
              {state.myHistory.map((h) => <li key={h.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 rounded px-2 py-1.5 text-xs" style={{ background: h.outcome === "win" ? "rgba(18,55,23,.7)" : T.panel }}><span className="text-slate-400">#{h.round}</span><span className="text-[10px] text-slate-500">{new Date(h.at).toLocaleTimeString("en-PK", { timeStyle: "short" })}</span><span className="text-right text-slate-200">{fmt2(h.bet)}</span><span className={`text-right font-bold ${h.outcome === "win" ? "text-[#28a909]" : "text-slate-600"}`}>{h.outcome === "win" ? fmt2(h.win) : "—"}</span></li>)}
              {state.myHistory.length === 0 && <li className="py-6 text-center text-xs text-slate-600">Your bets will appear here</li>}
            </ul>
          )}
          {tab === "top" && (
            <ul className="max-h-[420px] space-y-[2px] overflow-y-auto px-2 pb-2">
              {state.top.map((b, i) => <li key={i} className="rounded px-2 py-1.5 text-xs" style={{ background: T.panel }}><div className="flex items-center justify-between"><span className="font-semibold text-slate-200">{b.name}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cpClass(b.mult)}`}>{fmt2(b.mult)}x</span></div><div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500"><span>Bet {fmt2(b.bet)} · #{b.round}</span><span className="font-bold text-[#28a909]">Win {fmt2(b.win)}</span></div></li>)}
              {state.top.length === 0 && <li className="py-6 text-center text-xs text-slate-600">No wins yet</li>}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between px-3 py-2 text-[10px] text-slate-500" style={{ borderTop: `1px solid ${T.line}` }}><span>This game is <span className="text-[#28a909]">Provably Fair</span></span><span>Powered by winkox</span></div>
        </aside>

        {/* RIGHT: game */}
        <section className="order-1 w-full min-w-0 flex flex-col overflow-hidden lg:order-2">
          <div className="relative flex items-center gap-1 px-2 py-1.5" style={{ borderBottom: `1px solid ${T.line}` }}>
            <div className="flex flex-1 gap-1 overflow-hidden">{state.history.slice(0, 30).map((h) => <span key={h.id} className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cpClass(h.crashPoint)}`}>{fmt2(h.crashPoint)}x</span>)}</div>
            <button onClick={() => setShowHist((v) => !v)} className="flex h-6 w-9 shrink-0 items-center justify-center rounded-full text-[10px] text-slate-300" style={{ background: T.panel, border: `1px solid ${T.line}` }}>⏱▾</button>
            {showHist && <div className="absolute right-2 top-9 z-30 w-[min(92vw,520px)] rounded-lg p-3 shadow-2xl" style={{ background: T.panel, border: `1px solid ${T.line}` }}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white">Round History</span><button onClick={() => setShowHist(false)} className="text-slate-400">✕</button></div><div className="flex flex-wrap gap-1">{state.history.map((h) => <span key={h.id} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cpClass(h.crashPoint)}`}>{fmt2(h.crashPoint)}x</span>)}</div></div>}
          </div>

          <div ref={wrapRef} className="relative h-[30dvh] min-h-[200px] w-full sm:h-[280px] md:h-[300px] lg:h-[360px] xl:h-[390px]" style={{ background: T.bg }}>
            <canvas ref={canvasRef} className="block h-full w-full" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {phase === "waiting" ? (
                <div className="flex flex-col items-center">
                  <svg className="mb-3 h-16 w-16 animate-spin" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke={T.accent} strokeWidth="6" strokeDasharray="120 60" strokeLinecap="round" /></svg>
                  <div className="text-base font-bold uppercase tracking-widest text-white sm:text-lg">Waiting for next round</div>
                  <div className="mt-2 h-1.5 w-52 overflow-hidden rounded-full bg-white/10"><div className="h-full transition-all duration-100" style={{ width: `${Math.max(0, Math.min(100, 100 - (countdown / (state.config.waitMs / 1000)) * 100))}%`, background: T.accent }} /></div>
                </div>
              ) : phase === "crashed" ? (
                <div className="flex flex-col items-center"><div className="text-xl font-bold uppercase tracking-wider text-white/90 sm:text-2xl">Flew away!</div><div className="text-6xl font-black sm:text-7xl" style={{ color: T.accent }}>{fmt2(mult)}x</div></div>
              ) : (
                <div className="text-6xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.6)] sm:text-7xl">{fmt2(mult)}x</div>
              )}
            </div>
            {toast && <div className={`absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-center shadow-xl ${toast.t === "ok" ? "bg-[#123717] text-white ring-2 ring-[#427f00]" : "bg-[#3a0b12] text-white ring-2 ring-[#e50539]"}`}><div className="text-xs font-semibold">{toast.m}</div>{toast.sub && <div className={`text-sm font-black ${toast.t === "ok" ? "text-[#4ade80]" : "text-red-300"}`}>{toast.sub}</div>}</div>}
            <div className="absolute left-2 top-2 text-[10px] text-slate-500">Round #{state.round.id}</div>
          </div>

          {/* bet panels */}
          <div className="pb-1" style={{ background: T.panel2 }}>
            <div className={`grid min-w-0 gap-2 p-2 ${slots === 3 ? "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {Array.from({ length: slots }, (_, i) => {
                const p = panels[i];
                const mine = state.myBets.find((b) => b.slot === i) ?? null;
                const queued = state.queued.find((q) => q.slot === i) ?? null;
                const amount = Number(p.amount) || 0;
                const pending = mine?.outcome === "pending";
                const potential = Math.floor((mine?.bet ?? amount) * mult * 100) / 100;
                const setAmt = (v: number) => setPanel(i, { amount: Math.max(state.config.minBet, Math.min(state.config.maxBet, v)).toFixed(2) });
                let mode: "bet" | "cancel" | "cashout" | "queued" | "next";
                if (pending && (phase === "running")) mode = "cashout";
                else if (pending && phase === "waiting") mode = "cancel";
                else if (queued) mode = "queued";
                else if (phase === "waiting") mode = "bet";
                else mode = "next";
                const locked = pending || !!queued;
                const border = mine?.outcome === "win" ? "#427f00" : pending || queued ? T.accent : T.line;
                return (
                  <div key={i} className="min-w-0 rounded-xl p-2" style={{ background: T.panel, border: `1px solid ${border}` }}>
                    <div className="mb-1.5 flex justify-center"><div className="flex rounded-full p-0.5 text-[10px] font-semibold" style={{ background: T.panel2 }}><button onClick={() => setPanel(i, { tab: "bet" })} className={`rounded-full px-3 py-0.5 ${p.tab === "bet" ? "bg-[#2c2d30] text-white" : "text-slate-400"}`}>Bet</button><button onClick={() => setPanel(i, { tab: "auto" })} className={`rounded-full px-3 py-0.5 ${p.tab === "auto" ? "bg-[#2c2d30] text-white" : "text-slate-400"}`}>Auto</button></div></div>
                    <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-[1fr_1.05fr]">
                      <div className={locked ? "pointer-events-none opacity-60" : ""}>
                        <div className="flex items-center gap-1 rounded-full bg-black px-1 py-0.5" style={{ border: `1px solid ${T.line}` }}>
                          <button onClick={() => setAmt(amount - 10)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-base leading-none text-slate-400" style={{ border: `1px solid #3c3e44` }}>−</button>
                          <input value={p.amount} onChange={(e) => setPanel(i, { amount: e.target.value })} onBlur={() => setAmt(Number(p.amount) || state.config.minBet)} className="w-full min-w-0 bg-transparent text-center text-sm font-bold text-white outline-none" />
                          <button onClick={() => setAmt(amount + 10)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-base leading-none text-slate-400" style={{ border: `1px solid #3c3e44` }}>+</button>
                        </div>
                        <div className="mt-1 grid grid-cols-4 gap-1">{[100, 300, 500, 1000].map((v) => <button key={v} onClick={() => setAmt(v)} className={`whitespace-nowrap rounded-md py-1 text-[9px] font-bold ${amount === v ? "bg-[#28a909] text-white" : "text-slate-300 hover:text-white"}`} style={amount === v ? {} : { background: T.panel2, border: `1px solid ${T.line}` }}>{v}</button>)}</div>
                        <div className="mt-1 flex items-center gap-1 rounded-md px-1 py-1" style={{ background: T.panel2, border: `1px solid ${T.line}` }}>
                          <input type="number" min={state.config.minBet} max={state.config.maxBet} value={p.customAmount} onChange={(e) => setPanel(i, { customAmount: e.target.value })} className="w-full min-w-0 bg-transparent text-center text-[9px] font-bold text-white outline-none" />
                          <button onClick={() => setAmt(Number(p.customAmount) || state.config.minBet)} className={`shrink-0 rounded-md px-2 py-1 text-[8px] font-black ${amount === (Number(p.customAmount) || state.config.minBet) ? "bg-[#28a909] text-white" : "text-slate-300"}`} style={amount === (Number(p.customAmount) || state.config.minBet) ? {} : { background: T.panel }}>Custom</button>
                        </div>
                      </div>
                      <div className="flex min-h-[72px]">
                        {mode === "bet" && <button data-action="bet" disabled={p.busy} onClick={() => placeBet(i)} className="flex w-full flex-col items-center justify-center rounded-2xl bg-[#28a909] text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.25)] transition hover:bg-[#36cb12] disabled:opacity-60"><span className="text-base font-semibold uppercase leading-none">Bet</span><span className="mt-1 text-sm font-bold">{fmt2(amount)} <span className="text-[9px]">PKR</span></span></button>}
                        {mode === "next" && <button data-action="bet-next" disabled={p.busy} onClick={() => placeBet(i)} className="flex w-full flex-col items-center justify-center rounded-2xl bg-[#28a909] text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.25)] transition hover:bg-[#36cb12] disabled:opacity-60"><span className="text-base font-semibold uppercase leading-none">Bet</span><span className="mt-1 text-sm font-bold">{fmt2(amount)} <span className="text-[9px]">PKR</span></span></button>}
                        {mode === "queued" && <div className="flex w-full flex-col items-center justify-center gap-1"><span className="text-[9px] text-slate-400">Next round</span><button data-action="cancel" disabled={p.busy} onClick={() => cancelBet(i)} className="w-full rounded-2xl bg-[#cb011a] py-2 text-base font-semibold uppercase text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.25)]">Cancel</button></div>}
                        {mode === "cancel" && <button data-action="cancel" disabled={p.busy} onClick={() => cancelBet(i)} className="flex w-full flex-col items-center justify-center rounded-2xl bg-[#cb011a] text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.25)] transition hover:bg-[#e3061f] disabled:opacity-60"><span className="text-base font-semibold uppercase leading-none">Cancel</span></button>}
                        {mode === "cashout" && <button data-action="cashout" disabled={p.busy} onClick={() => cashOut(i)} className="flex w-full flex-col items-center justify-center rounded-2xl bg-[#d07206] text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.25)] transition hover:bg-[#f18a12] disabled:opacity-60"><span className="text-base font-semibold uppercase leading-none">Cash out</span><span className="mt-1 text-sm font-bold">{fmt2(potential)} <span className="text-[9px]">PKR</span></span></button>}
                      </div>
                    </div>
                    {mine && mine.outcome !== "pending" && <div className={`mt-2 rounded-lg px-2 py-1 text-center text-[10px] font-semibold ${mine.outcome === "win" ? "bg-[#123717] text-[#4ade80]" : "bg-[#3a0b12] text-red-300"}`}>{mine.outcome === "win" ? `Cashed out ${fmt2(mine.win)} PKR` : `Lost ${fmt2(mine.bet)} PKR`}</div>}
                    {p.tab === "auto" && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 text-[10px]" style={{ background: T.panel2, border: `1px solid ${T.line}` }}>
                        <label className="flex items-center gap-1.5"><span className="text-slate-300">Auto Bet</span><Toggle on={p.autoBet} onChange={(v) => setPanel(i, { autoBet: v })} /></label>
                        <label className="flex items-center gap-1.5"><span className="text-slate-300">Auto Cash</span><Toggle on={p.autoCash} onChange={(v) => setPanel(i, { autoCash: v })} /><span className="flex items-center rounded-full px-1.5" style={{ background: T.panel, border: `1px solid ${T.line}` }}><input value={p.autoCashAt} disabled={!p.autoCash} onChange={(e) => setPanel(i, { autoCashAt: e.target.value })} onBlur={() => setPanel(i, { autoCashAt: Math.max(1.01, Number(p.autoCashAt) || 1.01).toFixed(2) })} className="w-10 bg-transparent py-0.5 text-center font-bold text-white outline-none disabled:opacity-40" /><span className="text-slate-500">x</span></span></label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {rules && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setRules(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 text-sm text-slate-300" style={{ background: T.panel, border: `1px solid ${T.line}` }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className={`text-lg font-black italic ${T.logo}`}>{T.title} — How to play</h3><button onClick={() => setRules(false)} className="text-slate-400">✕</button></div>
            <ol className="list-decimal space-y-2 pl-5">
              <li><b className="text-white">Bet</b> — {slots} bets per round. Press BET during "Waiting for next round". If a round is running, your bet is placed for the next round automatically.</li>
              <li><b className="text-white">Watch</b> the plane take off — the multiplier grows from 1.00x.</li>
              <li><b className="text-white">Cash out</b> before the plane flies away. Win = bet × multiplier.</li>
              <li><b className="text-white">Auto</b> — Auto Bet repeats your bet every round; Auto Cash Out cashes out at your target.</li>
              <li>Min {state.config.minBet} PKR · Max {state.config.maxBet.toLocaleString()} PKR per bet · Up to 100x · RTP 97% · Provably fair.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!on)} className={`h-5 w-9 rounded-full p-0.5 transition ${on ? "bg-[#28a909]" : "bg-slate-600"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${on ? "translate-x-4" : ""}`} /></button>;
}

/* ============ canvas ============ */
function draw(canvas: HTMLCanvasElement, size: { w: number; h: number; dpr: number }, T: (typeof THEME)[Table], phase: string, m: number, now: number, s: State) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const { w: W, h: H, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const t = phase === "waiting" ? 0 : Math.max(0, (now - s.round.startsAt) / 1000);
  const pad = 34; // origin point bottom-left
  const cx = pad, cy = H - pad;
  // rays from origin
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((now / 14000) % (Math.PI * 2));
  for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); if (i % 2) { ctx.fillStyle = T.rays; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(W, H) * 2, 0, Math.PI / 12); ctx.closePath(); ctx.fill(); } }
  ctx.restore();
  if (phase === "crashed") { const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, W); g.addColorStop(0, `${T.accent}26`); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // axes dots
  const scroll = (t * 40) % 40;
  ctx.fillStyle = "rgba(255,255,255,.35)";
  for (let x = pad + 40 - scroll; x < W - 8; x += 40) { ctx.beginPath(); ctx.arc(x, H - pad + 10, 2, 0, Math.PI * 2); ctx.fill(); }
  for (let y = H - pad - 40 + (scroll % 40); y > 6; y -= 40) { ctx.beginPath(); ctx.arc(pad - 10, y, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, 4); ctx.lineTo(pad, H - pad); ctx.lineTo(W - 6, H - pad); ctx.stroke();

  // plane flies along a bezier-style parabola fully inside the box.
  const boxW = Math.max(80, W - pad * 2 - 46); // keep ~46px right margin for the plane sprite
  const boxH = Math.max(60, H - pad * 2 - 26); // top margin too
  const travel = Math.min(1, t / 11);            // horizontal travel time
  const climb = Math.min(1, 0.25 + t / 10);       // vertical height gain
  const ex = cx + boxW;                            // far right
  const ey = pad + 6;                              // top
  // quadratic bezier P0=(cx,cy) ctrl=(ex*0.55, cy) P1=(ex,ey)
  const qy = (tt: number) => { const u = 1 - tt; return u * u * cy + 2 * u * tt * cy + tt * tt * ey; };
  const qx = (tt: number) => { const u = 1 - tt; return u * u * cx + 2 * u * tt * ex * 0.55 + tt * tt * ex; };
  let px = cx, py = cy;
  if (phase !== "waiting") {
    px = qx(travel); py = qy(travel) - (1 - climb) * 0;
    // clamp to box
    px = Math.min(ex + 10, Math.max(cx, px)); py = Math.max(ey - 4, Math.min(cy, py));
    const hover = phase === "running" && t > 8.5 ? Math.sin(now / 380) * 8 : 0;
    py += hover;
    // filled curve
    const yAt = (x: number) => {
      // inverse of travel by drawing through param samples up to current travel
      const steps = 24, seg = Math.max(1, Math.floor(travel * steps));
      for (let i = seg; i > 0; i--) { const tt = i / steps, tt2 = (i - 1) / steps; const x1 = qx(tt), x0 = qx(tt2); if (x >= x0 && x <= x1) { const f = (x - x0) / Math.max(1, x1 - x0); const y1 = qy(tt) + (t > 8.5 && phase === "running" ? Math.sin(now / 380) * 8 * tt : 0), y0 = qy(tt2); return y0 + (y1 - y0) * f; } }
      return cy;
    };
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let i = 1; i <= 24; i++) { const tt = (i / 24) * travel; ctx.lineTo(qx(tt), qy(tt) + (t > 8.5 && phase === "running" ? Math.sin(now / 380) * 8 * tt : 0)); }
    ctx.lineTo(px, cy); ctx.closePath(); ctx.fillStyle = T.fill; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let i = 1; i <= 24; i++) { const tt = (i / 24) * travel; ctx.lineTo(qx(tt), qy(tt) + (t > 8.5 && phase === "running" ? Math.sin(now / 380) * 8 * tt : 0)); }
    ctx.strokeStyle = T.curve; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.stroke();
    void yAt;
  }
  if (phase === "waiting") { px = cx + 6; py = cy - 6; }
  if (phase === "crashed") { const dt = s.round.endedAt ? (now - s.round.endedAt) / 1000 : 0; px = px + dt * 460; py = py - dt * 280; }
  // keep plane visible: scale down on very short canvases
  const planeScale = Math.min(1.25, Math.max(0.62, Math.min(W / 390, H / 270)));
  ctx.save(); ctx.translate(px, py); ctx.rotate(phase === "waiting" ? 0 : -0.32); ctx.scale(planeScale, planeScale); drawPlane(ctx, now, phase === "crashed", T.plane); ctx.restore();
}
function drawPlane(ctx: CanvasRenderingContext2D, now: number, crashed: boolean, color: string) {
  const red = color, dark = "#8b0a1a";
  ctx.save(); ctx.scale(1.3, 1.3);
  ctx.shadowColor = crashed ? "rgba(0,0,0,.4)" : `${red}88`; ctx.shadowBlur = 16;
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-26, 2); ctx.lineTo(-34, -14); ctx.lineTo(-22, -12); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-24, 4); ctx.lineTo(-36, 10); ctx.lineTo(-30, 12); ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = red; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-10, -9, 18, -6); ctx.quadraticCurveTo(30, -4, 34, 0); ctx.quadraticCurveTo(30, 5, 18, 7); ctx.quadraticCurveTo(-10, 9, -30, 4); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(-14, 16); ctx.lineTo(-4, 17); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = red; ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(-8, -18); ctx.lineTo(2, -18); ctx.lineTo(14, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e0f2fe"; ctx.beginPath(); ctx.ellipse(8, -5, 7, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-24, 3); ctx.lineTo(16, 1); ctx.stroke();
  const a = (now / 18) % Math.PI; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(35, Math.sin(a) * 12); ctx.lineTo(35, -Math.sin(a) * 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(35, Math.cos(a) * 12); ctx.lineTo(35, -Math.cos(a) * 12); ctx.stroke();
  ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(35, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(-4, 12, 2.5, 0, Math.PI * 2); ctx.arc(10, 10, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
