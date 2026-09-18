"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, AppleIcon, AndroidIcon, LaptopIcon, TabletIcon, CheckIcon } from "./Icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detectDevice() {
  if (typeof navigator === "undefined") return { ios: false, android: false, ipad: false, mobile: false };
  const ua = navigator.userAgent || navigator.vendor || "";
  const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const android = /android/i.test(ua);
  return { ios: ios || ipad, android, ipad, mobile: ios || ipad || android };
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dev, setDev] = useState({ ios: false, android: false, ipad: false, mobile: false });

  useEffect(() => {
    setDev(detectDevice());
    if (window.matchMedia?.("(display-mode: standalone)").matches) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // show floating install button after a moment on every device
    const t = setTimeout(() => { if (!window.matchMedia?.("(display-mode: standalone)").matches) setHasBtn(true); }, 2200);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); };
  }, []);
  const [hasBtn, setHasBtn] = useState(false);

  const native = async () => { if (deferred) { await deferred.prompt(); const { outcome } = await deferred.userChoice; if (outcome === "accepted") { setInstalled(true); setOpen(false); } setDeferred(null); } else setOpen(true); };

  if (installed) return null;
  return (
    <>
      {/* floating install button */}
      {hasBtn && !open && (
        <button onClick={() => setOpen(true)} className="keep-white fixed bottom-20 right-3 z-[45] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 md:bottom-6 md:right-6">
          <DownloadIcon size={16} /> Install App
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="game-surface w-full max-w-md rounded-t-3xl border border-[#3a2470] p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] text-[#2a1500]"><DownloadIcon size={22} /></span>
                <div>
                  <div className="text-base font-black text-white">Add WinX555 to Home Screen</div>
                  <div className="text-xs text-[#b8a7e6]">One-tap access — works like an app</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10"><XIcon size={18} /></button>
            </div>

            {deferred ? (
              <button onClick={native} className="btn-gold flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black">
                <DownloadIcon size={18} /> Install now
              </button>
            ) : dev.android || dev.mobile ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-black/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><AndroidIcon size={18} className="text-emerald-400" /> Android (Chrome / Edge)</div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-300">
                    <li>Tap the <b className="text-white">⋮</b> menu (three dots, top-right)</li>
                    <li>Tap <b className="text-white">“Add to Home screen”</b> / “Install app”</li>
                    <li>Confirm — the WinX555 icon appears on your home screen</li>
                  </ol>
                </div>
                {dev.ios && (
                  <div className="rounded-2xl bg-black/30 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><AppleIcon size={18} className="text-slate-200" /> iPhone / iPad (Safari)</div>
                    <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-300">
                      <li>Tap the <b className="text-white">Share</b> icon <span className="inline-block rounded bg-slate-600 px-1.5 text-[10px]">􀈂</span> (bottom bar)</li>
                      <li>Scroll and tap <b className="text-white">“Add to Home Screen”</b></li>
                      <li>Tap <b className="text-white">Add</b> — done</li>
                    </ol>
                  </div>
                )}
                <p className="flex items-center gap-1.5 text-center text-[11px] text-emerald-300"><CheckIcon size={13} /> Works offline with all games saved on your device</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-black/30 p-3 text-center"><AppleIcon size={26} className="mx-auto text-slate-200" /><div className="mt-1 text-[11px] font-bold text-white">iPhone / iPad</div><div className="text-[10px] text-slate-400">Safari → Share → Add to Home Screen</div></div>
                  <div className="rounded-2xl bg-black/30 p-3 text-center"><AndroidIcon size={26} className="mx-auto text-emerald-400" /><div className="mt-1 text-[11px] font-bold text-white">Android</div><div className="text-[10px] text-slate-400">Chrome → ⋮ → Install app</div></div>
                  <div className="rounded-2xl bg-black/30 p-3 text-center"><TabletIcon size={26} className="mx-auto text-violet-300" /><div className="mt-1 text-[11px] font-bold text-white">Tablet</div><div className="text-[10px] text-slate-400">Same as phone browser</div></div>
                  <div className="rounded-2xl bg-black/30 p-3 text-center"><LaptopIcon size={26} className="mx-auto text-sky-300" /><div className="mt-1 text-[11px] font-bold text-white">Laptop / PC</div><div className="text-[10px] text-slate-400">Chrome/Edge → install icon ⤓ in address bar</div></div>
                </div>
                <button onClick={native} className="btn-gold flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black"><DownloadIcon size={16} /> Install / Add to home screen</button>
              </div>
            )}
            <p className="mt-3 text-center text-[10px] text-slate-500">No download from app store needed — it installs directly from your browser</p>
          </div>
        </div>
      )}
    </>
  );
}
