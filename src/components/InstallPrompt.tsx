"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, AppleIcon, AndroidIcon, LaptopIcon, TabletIcon, CheckIcon, ShareIcon } from "./Icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detectDevice() {
  if (typeof navigator === "undefined") return { ios: false, android: false, ipad: false, mobile: false, safari: false, firefox: false };
  const ua = navigator.userAgent || navigator.vendor || "";
  const ipad = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ios = /iPhone|iPod/.test(ua) || ipad;
  const android = /android/i.test(ua);
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  const firefox = /firefox/i.test(ua);
  return { ios, android, ipad, mobile: ios || android, safari, firefox };
}

export type OpenInstall = () => void;
let globalOpen: OpenInstall | null = null;
export function openInstallSheet() { globalOpen?.(); }

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dev, setDev] = useState({ ios: false, android: false, ipad: false, mobile: false, safari: false, firefox: false });
  const [hasBtn, setHasBtn] = useState(false);
  useEffect(() => { globalOpen = () => setOpen(true); }, []);

  useEffect(() => {
    setDev(detectDevice());
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setHasBtn(true), 1800);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); };
  }, []);

  const native = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") { setInstalled(true); setOpen(false); }
      setDeferred(null);
    } else setOpen(true);
  };

  if (installed) return null;
  return (
    <>
      {/* floating button — LEFT side (avoid the chat bubble on the right) */}
      {hasBtn && !open && (
        <button onClick={() => setOpen(true)} className="keep-white fixed bottom-20 left-3 z-[45] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 md:bottom-6 md:left-6">
          <DownloadIcon size={16} /> Install App
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="game-surface max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#3a2470] p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] text-[#2a1500]"><DownloadIcon size={22} /></span>
                <div>
                  <div className="text-base font-black text-white">Add WinX555 to Home Screen</div>
                  <div className="text-xs text-[#b8a7e6]">Install as app — one tap, opens like a real app</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10"><XIcon size={18} /></button>
            </div>

            {/* one-tap native install whenever the browser allows (Android Chrome / Edge / desktop Chrome / Edge) */}
            {deferred && (
              <button onClick={native} className="btn-gold mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black">
                <DownloadIcon size={18} /> Install now (one tap)
              </button>
            )}

            {/* device-specific instructions */}
            <div className="space-y-3">
              {(dev.android || (!dev.ios && dev.mobile)) && (
                <div className="rounded-2xl bg-black/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><AndroidIcon size={18} className="text-emerald-400" /> Android phone / tablet
                    {dev.firefox && <span className="ml-auto rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">Chrome se kholein</span>}
                  </div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-300">
                    <li>Website <b className="text-white">Chrome</b> mein kholein (Firefox se install nahi hota)</li>
                    <li>Top-right <b className="text-white">⋮</b> (3 dots) tap karein</li>
                    <li><b className="text-white">“Add to Home screen”</b> ya <b className="text-white">“Install app”</b> choose karein</li>
                    <li><b className="text-white">Install</b> dabayein — home screen par icon aa jayega</li>
                  </ol>
                </div>
              )}
              {dev.ios && (
                <div className="rounded-2xl bg-black/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><AppleIcon size={18} className="text-slate-200" /> iPhone / iPad
                    {!dev.safari && <span className="ml-auto rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">Safari use karein</span>}
                  </div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-300">
                    <li>Website <b className="text-white">Safari</b> mein kholein (Chrome se iPhone par add nahi hota)</li>
                    <li>Neeche (ya upar) <b className="text-white">Share</b> button <ShareIcon size={13} className="inline text-[#8fd3ff]" /> tap karein</li>
                    <li><b className="text-white">“Add to Home Screen”</b> choose karein</li>
                    <li>Upar right <b className="text-white">Add</b> dabayein — icon ban jayega</li>
                  </ol>
                </div>
              )}
              {!dev.mobile && (
                <div className="rounded-2xl bg-black/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><LaptopIcon size={18} className="text-sky-300" /> Laptop / PC / Mac</div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-300">
                    <li><b className="text-white">Chrome ya Edge</b> mein website kholein</li>
                    <li>Address bar ke bilkul right mein <b className="text-white">install icon <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-current text-[9px]">⤓</span></b> par click karein</li>
                    <li><b className="text-white">Install</b> dabayein — WinX555 ab app ki tarah khulegi (Start menu / Dock / Desktop shortcut)</li>
                    <li>Mac par bhi Chrome/Edge yahi dete hain; Safari mein File → Add to Dock</li>
                  </ol>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    <div className="rounded-lg bg-white/5 p-2"><AppleIcon size={22} className="mx-auto text-slate-200" /><div className="mt-1 text-[10px]">Mac</div></div>
                    <div className="rounded-lg bg-white/5 p-2"><LaptopIcon size={22} className="mx-auto text-sky-300" /><div className="mt-1 text-[10px]">Windows</div></div>
                    <div className="rounded-lg bg-white/5 p-2"><TabletIcon size={22} className="mx-auto text-violet-300" /><div className="mt-1 text-[10px]">Tablet</div></div>
                    <div className="rounded-lg bg-white/5 p-2"><AndroidIcon size={22} className="mx-auto text-emerald-400" /><div className="mt-1 text-[10px]">Android</div></div>
                  </div>
                </div>
              )}
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300"><CheckIcon size={13} /> App Store / Play Store ki zaroorat nahi — browser se direct install hoti hai, games aur data device par save rehte hain.</p>
              <button onClick={() => setOpen(false)} className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10">Theek hai</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
