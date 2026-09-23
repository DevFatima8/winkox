"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { XIcon } from "@/components/Icons";

/*
 * Promotional popups — website khulte hi pehla popup, phir har 3 minutes baad
 * agla popup rotation mein (Maximum Bonus → Lucky Draw → First Deposit).
 * Admin panels (/admin/...) par kabhi show nahi hota.
 */

const ROTATE_MS = 3 * 60 * 1000;

/* ---------- shared ---------- */
function Overlay({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/75 p-4">{children}</div>;
}

function CloseBelow({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" aria-label="Close" onClick={onClose} className="mx-auto mt-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/80 bg-black/55 text-white">
      <XIcon size={20} />
    </button>
  );
}

/* ---------- 1) Maximum Bonus wheel ---------- */
const SEG_COLORS = ["#ff4d4d", "#ff9f2e", "#ffd12e", "#a8e63a", "#3ddc7a", "#2ad4b0", "#2eb4ff", "#3a6cff", "#7a4dff", "#c44dff", "#ff4dc4", "#ff6a3d"];
const SEG_ICONS = ["🪙", "🎁", "💰", "💵", "🪙", "👑", "💰", "🎁", "🪙", "💎", "💵", "💰"];

function MaxBonusPopup({ onClose }: { onClose: () => void }) {
  const seg = SEG_COLORS.map((c, i) => `${c} ${i * 30}deg ${(i + 1) * 30}deg`).join(", ");
  return (
    <Overlay>
      <div className="relative w-full max-w-xs text-center">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute -right-2 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 text-white"><XIcon size={18} /></button>
        <div className="text-xl font-black text-white drop-shadow">Maximum Bonus</div>
        <div className="mb-3 text-3xl font-black text-[#ffd12e] drop-shadow">₨1,500.00</div>
        <div className="relative mx-auto h-64 w-64 rounded-full border-[10px] border-[#1d4ed8] shadow-[0_0_45px_rgba(59,130,246,.65)]">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-white" style={{ transform: `translate(-50%,-50%) rotate(${i * 30}deg) translateY(-118px)` }} />
          ))}
          <div className="absolute inset-1 overflow-hidden rounded-full" style={{ background: `conic-gradient(${seg})`, animation: "wxpromo-spin 16s linear infinite" }}>
            {SEG_ICONS.map((ic, i) => (
              <span key={i} className="absolute left-1/2 top-1/2 text-lg" style={{ transform: `translate(-50%,-50%) rotate(${i * 30 + 15}deg) translateY(-86px)` }}>{ic}</span>
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#1d6ef5] text-white ring-4 ring-[#bcd9ff]">
            <span className="text-2xl font-black leading-none">GO</span>
            <span className="text-xs font-bold">64 x</span>
          </div>
        </div>
        <div className="mt-2 text-lg leading-none">🐯💰🐭💵</div>
        <div className="mt-1 text-sm font-bold text-white drop-shadow">You can draw 64 times</div>
        <button type="button" className="mt-2 rounded-full bg-gradient-to-b from-[#4aa8ff] to-[#1d6ef5] px-8 py-2 text-sm font-black text-white shadow-lg">Go to the lucky 👆</button>
      </div>
    </Overlay>
  );
}

/* ---------- 2) Lucky Draw ---------- */
const DRAW_LABELS = ["0-1,500", "8,000", "0-1,300", "800", "0-1,000", "5,000"];

function LuckyDrawPopup({ onClose }: { onClose: () => void }) {
  const [left, setLeft] = useState(7 * 3600 + 36 * 60 + 19);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hh = String(Math.floor(left / 3600)).padStart(2, "0");
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const seg = Array.from({ length: 6 }, (_, i) => `${i % 2 ? "#5aa0f7" : "#2f7ff0"} ${i * 60}deg ${(i + 1) * 60}deg`).join(", ");
  return (
    <Overlay>
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#2a7ff0] to-[#1257c4] p-3 shadow-2xl ring-1 ring-white/20">
          <div className="flex items-center gap-2 rounded-full bg-[#0e3f96]/80 px-3 py-1.5 text-[11px] font-bold text-white">
            <span>🔊</span>
            <div className="relative flex-1 overflow-hidden whitespace-nowrap" dir="ltr">
              <div className="inline-block pl-[100%]" style={{ animation: "wxpromo-marq 14s linear infinite" }}>
                <bdi>1884****3698 Lucky draw Win bonus <span className="text-[#ffd12e]">1,438.25</span></bdi>
              </div>
            </div>
            <span className="rounded-full bg-white/20 px-1.5">?</span><span>🎁</span>
          </div>
          <div className="mt-2 text-center text-3xl font-black text-[#ffd12e]">1,453.50</div>
          <div className="mx-auto mt-1 h-2 w-4/5 overflow-hidden rounded-full bg-white/25"><div className="h-full w-[58%] rounded-full bg-[#2ecc40]" /></div>
          <div className="relative mx-auto mt-3 h-60 w-60 rounded-full bg-white p-2 shadow-inner">
            {DRAW_LABELS.map((l, i) => (
              <span key={l} className="absolute left-1/2 top-1/2 text-[10px] font-black text-[#1257c4]" style={{ transform: `translate(-50%,-50%) rotate(${i * 60}deg) translateY(-106px) rotate(${-i * 60}deg)` }}>{l}</span>
            ))}
            <div className="relative h-full w-full overflow-hidden rounded-full" style={{ background: `conic-gradient(${seg})` }}>
              {["🪙", "💰", "🪙", "💰", "🪙", "💰"].map((ic, i) => (
                <span key={i} className="absolute left-1/2 top-1/2 text-lg" style={{ transform: `translate(-50%,-50%) rotate(${i * 60 + 30}deg) translateY(-64px)` }}>{ic}</span>
              ))}
            </div>
            <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white text-[#1257c4] shadow">
              <span className="text-xl font-black leading-none">x64</span>
              <span className="text-[11px] font-bold">Free draw</span>
              <span className="text-base leading-none">👆</span>
            </div>
          </div>
          <div className="relative z-10 mx-auto -mb-3 mt-2 w-max rounded-md bg-[#e02f2f] px-3 py-1 text-[11px] font-bold text-white shadow">Only 46.50 is needed to claim the bonus…</div>
          <button type="button" className="mt-3 w-full rounded-xl bg-white/90 py-3 text-sm font-black text-[#1257c4]">Invite friend, Win bonus</button>
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] font-bold text-white">
            <span className="inline-flex items-center gap-1">Invitation code <b className="text-[#ffd12e]">692377353</b> <span className="rounded bg-white/20 px-1">⧉</span></span>
            <span>My subordinates</span>
          </div>
          <div className="mt-2 rounded-lg bg-[#0e3f96]/80 py-2 text-center text-xs font-black text-white">✦ Complete tasks for free draws ✦</div>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-bold text-[#1257c4]">📅 Daily Login <span className="text-[#7aa8e8]">Free draw:{hh}:{mm}:{ss}</span></div>
        </div>
        <CloseBelow onClose={onClose} />
      </div>
    </Overlay>
  );
}

/* ---------- 3) First Deposit Extra Reward ---------- */
const TIERS: [number, number][] = [[300, 60], [500, 100], [1000, 200], [3000, 300], [10000, 500], [30000, 1500], [100000, 5000]];

function FirstDepositPopup({ onClose }: { onClose: (today: boolean, never: boolean) => void }) {
  const [today, setToday] = useState(false);
  const [never, setNever] = useState(false);
  return (
    <Overlay>
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="py-3 text-center text-lg font-black text-gray-900">First Deposit Extra Reward</div>
          <div className="mx-3 rounded-xl bg-[#e9f9ef] p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-black text-gray-900">🎁 Rewards</div>
                <div className="text-[11px] text-gray-500">First deposit reward after registration</div>
              </div>
              <span className="text-sm font-bold text-emerald-500">🔄 Refresh</span>
            </div>
            <div className="mt-2 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
              {TIERS.map(([d, b]) => (
                <div key={d} className="flex items-center justify-between rounded-lg bg-[#f2fcf6] px-3 py-2.5 ring-1 ring-emerald-100">
                  <span className="text-sm font-bold text-gray-800">First Deposit ≥ {d.toLocaleString("en-US")}</span>
                  <span className="flex flex-col items-center leading-none">
                    <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ffd12e] text-sm ring-2 ring-[#f5a623]">🪙<b className="absolute -right-2.5 -top-2 rounded-full bg-[#ff7a00] px-1 text-[9px] text-white">{b}</b></span>
                    <span className="mt-1 rounded bg-[#20c997] px-1.5 text-[9px] font-black text-white">Bonus</span>
                  </span>
                  <button type="button" className="rounded-full bg-gradient-to-b from-[#ffa02e] to-[#ff7a00] px-4 py-1.5 text-xs font-black text-white">Deposit</button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3">
            <button type="button" className="rounded-lg border border-blue-500 bg-white py-2.5 text-sm font-bold text-blue-600">History</button>
            <button type="button" className="rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white">View event</button>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-600">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={today} onChange={(e) => setToday(e.target.checked)} /> Don&apos;t show again today</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} /> Never remind</label>
          </div>
        </div>
        <CloseBelow onClose={() => onClose(today, never)} />
      </div>
    </Overlay>
  );
}

/* ---------- controller: rotation + admin exclusion ---------- */
export function PromoPopups() {
  const pathname = usePathname();
  const [idx, setIdx] = useState<number | null>(null);
  const idxRef = useRef(-1);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const fddOff = useCallback(() => {
    try {
      if (localStorage.getItem("wx_promo_fdd_never") === "1") return true;
      if (localStorage.getItem("wx_promo_fdd_day") === new Date().toDateString()) return true;
    } catch {}
    return false;
  }, []);

  const openNext = useCallback(() => {
    if (pathRef.current?.startsWith("/admin")) return;
    for (let k = 1; k <= 3; k++) {
      const i = (((idxRef.current + k) % 3) + 3) % 3;
      if (i === 2 && fddOff()) continue;
      idxRef.current = i;
      setIdx(i);
      return;
    }
    idxRef.current = -1;
    setIdx(null);
  }, [fddOff]);

  const close = useCallback((today?: boolean, never?: boolean) => {
    try {
      if (today) localStorage.setItem("wx_promo_fdd_day", new Date().toDateString());
      if (never) localStorage.setItem("wx_promo_fdd_never", "1");
    } catch {}
    setIdx(null);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(openNext, ROTATE_MS);
  }, [openNext]);

  // website khulte hi pehla show, phir sirf close hone par 3-minute timer
  useEffect(() => {
    if (pathname?.startsWith("/admin") || startedRef.current) return;
    startedRef.current = true;
    window.setTimeout(openNext, 800);
  }, [pathname, openNext]);
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  if (pathname?.startsWith("/admin") || idx === null) return null;
  return (
    <>
      <style>{`@keyframes wxpromo-spin{to{transform:rotate(360deg)}}@keyframes wxpromo-marq{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}`}</style>
      {idx === 0 ? <MaxBonusPopup onClose={() => close()} /> : idx === 1 ? <LuckyDrawPopup onClose={() => close()} /> : <FirstDepositPopup onClose={(today, never) => close(today, never)} />}
    </>
  );
}
