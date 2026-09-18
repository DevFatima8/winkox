"use client";

import { localApi } from "@/lib/client";

import { useCallback, useEffect, useRef, useState } from "react";

type State = { balance: number; limits: { min: number; max: number; minTarget: number; maxTarget: number; rtp: number }; recent: { id: string; bet: number; win: number; outcome: string; result: number; target: number }[] };
const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LimboGame() {
  const [st, setSt] = useState<State | null>(null);
  const [amount, setAmount] = useState("100.00");
  const [target, setTarget] = useState("2.00");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [autoN, setAutoN] = useState(10);
  const [autoLeft, setAutoLeft] = useState(0);
  const [display, setDisplay] = useState(1);
  const [last, setLast] = useState<{ result: number; won: boolean; payout: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hist, setHist] = useState<{ result: number; won: boolean }[]>([]);
  const autoRef = useRef({ on: false, left: 0 });
  const rafRef = useRef(0);

  const load = useCallback(async () => { const r = await localApi("/api/limbo", { cache: "no-store" }); if (r.ok) setSt(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (st && hist.length === 0 && st.recent.length) setHist(st.recent.slice(0, 12).reverse().map((r) => ({ result: r.result, won: r.outcome === "win" }))); }, [st, hist.length]);

  const tgt = Math.max(1.01, Number(target) || 1.01);
  const chance = st ? Math.min(99, (st.limits.rtp / tgt) * 100) : 0;
  const amt = Number(amount) || 0;
  const profit = Math.floor(amt * tgt * 100) / 100 - amt;

  const animateTo = (val: number) => new Promise<void>((res) => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now(), dur = 900, from = 1;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur); const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (val - from) * e);
      if (p < 1) rafRef.current = requestAnimationFrame(tick); else res();
    };
    rafRef.current = requestAnimationFrame(tick);
  });

  const play = useCallback(async () => {
    if (busy) return;
    setBusy(true); setErr(null); setLast(null);
    const r = await localApi("/api/limbo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), target: tgt }) });
    if (r.status === 401) { window.location.href = "/login"; return; }
    const j = await r.json();
    if (j.error) { setErr(j.error); setBusy(false); autoRef.current.on = false; setAutoLeft(0); return; }
    setSt((s) => (s ? { ...s, balance: j.balance } : s));
    await animateTo(j.result);
    setLast({ result: j.result, won: j.won, payout: j.payout });
    setHist((h) => [...h.slice(-11), { result: j.result, won: j.won }]);
    setBusy(false);
  }, [busy, amount, tgt]);

  // autobet loop
  useEffect(() => {
    if (autoLeft <= 0 || !autoRef.current.on) return;
    if (busy) return;
    const id = setTimeout(async () => { await play(); autoRef.current.left--; setAutoLeft(autoRef.current.left); }, 350);
    return () => clearTimeout(id);
  }, [autoLeft, busy, play]);

  const startAuto = () => { autoRef.current = { on: true, left: autoN }; setAutoLeft(autoN); };
  const stopAuto = () => { autoRef.current.on = false; setAutoLeft(0); };

  if (!st) return <div className="flex h-[60vh] items-center justify-center rounded-2xl bg-[#0f212e] text-slate-400">Loading Limbo…</div>;
  const input = "w-full rounded-md border border-[#2f4553] bg-[#0f212e] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[#557086]";
  const resultColor = last ? (last.won ? "#00e701" : "#ff4d4d") : "#fff";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#213743] bg-[#1a2c38] text-white">
      <div className="flex items-center justify-between border-b border-[#213743] bg-[#0f212e] px-4 py-2.5"><span className="flex items-center gap-2 text-base font-black"><span className="flex h-6 w-6 items-center justify-center rounded bg-[#00e701] text-[11px] text-slate-950">↑</span>Limbo</span><span className="rounded-md bg-[#213743] px-3 py-1.5 text-sm font-black text-white">{fmt2(st.balance)} <span className="text-[10px] text-slate-400">PKR</span></span></div>
      <div className="flex flex-col-reverse lg:flex-row">
        {/* sidebar */}
        <aside className="w-full space-y-3 bg-[#213743] p-3 lg:w-[300px] lg:shrink-0 lg:p-4">
          <div className="grid grid-cols-2 rounded-full bg-[#0f212e] p-1 text-sm font-semibold">
            <button onClick={() => { setMode("manual"); stopAuto(); }} className={`rounded-full py-2 ${mode === "manual" ? "bg-[#2f4553] text-white" : "text-slate-300"}`}>Manual</button>
            <button onClick={() => setMode("auto")} className={`rounded-full py-2 ${mode === "auto" ? "bg-[#2f4553] text-white" : "text-slate-300"}`}>Auto</button>
          </div>
          <label className="block"><span className="mb-1 flex justify-between text-xs font-semibold text-slate-300"><span>Bet Amount</span><span className="text-slate-400">Rs. {fmt2(amt)}</span></span>
            <div className="flex overflow-hidden rounded-md bg-[#0f212e] ring-1 ring-[#2f4553]"><input value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => setAmount((Number(amount) || st.limits.min).toFixed(2))} className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm font-bold outline-none" /><button onClick={() => setAmount(Math.max(st.limits.min, amt / 2).toFixed(2))} className="border-l border-[#213743] bg-[#2f4553] px-3 text-xs font-bold">½</button><button onClick={() => setAmount(Math.min(st.limits.max, amt * 2).toFixed(2))} className="border-l border-[#213743] bg-[#2f4553] px-3 text-xs font-bold">2×</button></div>
          </label>
          <div className="grid grid-cols-4 gap-1">{[100,300,500,1000].map((v) => <button key={v} onClick={() => setAmount(String(v))} className={`rounded-md py-1.5 text-[11px] font-bold ${Number(amt)===v ? "bg-[#00e701] text-slate-950" : "bg-[#0f212e] text-slate-300 ring-1 ring-[#2f4553]"}`}>{v}</button>)}</div>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-300">Profit on Win</span><input readOnly value={`Rs. ${fmt2(Math.max(0, profit))}`} className={input + " text-slate-300"} /></label>
          {mode === "auto" && (
            <div><span className="mb-1 block text-xs font-semibold text-slate-300">Number of Bets</span><div className="grid grid-cols-4 gap-1">{[10, 25, 50, 100].map((n) => <button key={n} onClick={() => setAutoN(n)} className={`rounded-md py-1.5 text-xs font-bold ${autoN === n ? "bg-[#00e701] text-slate-950" : "bg-[#0f212e] text-slate-300"}`}>{n}</button>)}</div></div>
          )}
          {mode === "manual" ? (
            <button disabled={busy} onClick={play} className="w-full rounded-md bg-[#00e701] py-3.5 text-base font-black text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-[#1fff20] active:scale-[.98] disabled:opacity-60">Bet</button>
          ) : autoLeft > 0 ? (
            <button onClick={stopAuto} className="w-full rounded-md bg-red-500 py-3.5 text-base font-black text-white">Stop Autobet ({autoLeft})</button>
          ) : (
            <button onClick={startAuto} className="w-full rounded-md bg-[#00e701] py-3.5 text-base font-black text-slate-950">Start Autobet</button>
          )}
          {err && <p className="rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-300">{err}</p>}
          <div className="rounded-md bg-[#0f212e] p-3 text-xs text-slate-400"><div className="flex justify-between"><span>RTP</span><b className="text-white">{(st.limits.rtp * 100).toFixed(0)}%</b></div><div className="flex justify-between"><span>Max multiplier</span><b className="text-white">{st.limits.maxTarget.toLocaleString()}x</b></div></div>
        </aside>

        {/* stage */}
        <div className="relative flex min-h-[420px] flex-1 flex-col bg-[#0f212e]">
          <div className="flex justify-end gap-1.5 overflow-x-auto p-3">
            {hist.map((h, i) => <span key={i} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${h.won ? "bg-[#00e701] text-slate-950" : "bg-[#2f4553] text-slate-200"}`}>{fmt2(h.result)}×</span>)}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
            <div className={`text-[72px] font-black leading-none tracking-tight transition-colors sm:text-[112px] ${busy ? "opacity-90" : ""}`} style={{ color: resultColor, textShadow: last?.won ? "0 0 48px rgba(0,231,1,.4)" : "none" }}>{fmt2(display)}<span className="text-5xl sm:text-7xl">×</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-[#213743] px-4 py-3 text-xs">
            <label className="block"><span className="mb-1 block font-semibold text-slate-300">Target Multiplier</span><div className="relative"><input value={target} onChange={(e) => setTarget(e.target.value)} onBlur={() => setTarget(Math.min(st.limits.maxTarget, Math.max(st.limits.minTarget, Number(target) || 1.01)).toFixed(2))} className="w-full rounded-md border border-[#2f4553] bg-[#0f212e] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[#557086]" /><span className="absolute right-3 top-2.5 text-sm text-slate-400">×</span></div></label>
            <label className="block"><span className="mb-1 block font-semibold text-slate-300">Win Chance</span><div className="relative"><input readOnly value={chance.toFixed(4)} className="w-full rounded-md border border-[#2f4553] bg-[#0f212e] px-3 py-2.5 text-sm font-bold text-slate-200 outline-none" /><span className="absolute right-3 top-2.5 text-sm text-slate-400">%</span></div></label>
          </div>
        </div>
      </div>
    </div>
  );
}
