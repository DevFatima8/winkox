"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, AppleIcon, AndroidIcon, LaptopIcon, ShareIcon, CheckIcon } from "./Icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function detect() {
  if (typeof navigator === "undefined") return { ios: false, android: false, ipad: false, mobile: false, safari: false, chrome: false };
  const ua = navigator.userAgent || "";
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ios = /iPhone|iPod/.test(ua) || ipad;
  const android = /android/i.test(ua);
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  const chrome = /chrome|crios/i.test(ua) && !/edg/i.test(ua);
  return { ios, android, ipad, mobile: ios || android, safari, chrome };
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [popup, setPopup] = useState(false);
  const [showBtn, setShowBtn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState(detect());
  const [iosHint, setIosHint] = useState(false);
  const [warnChrome, setWarnChrome] = useState(false);

  useEffect(() => {
    setD(detect());
    const sd = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (sd) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShowBtn(true); };
    const onOpen = () => { setShowBtn(true); setPopup(true); };
    const onInstalled = () => { setInstalled(true); setShowBtn(false); setPopup(false); setBusy(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("wx:open-install", onOpen);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setShowBtn(true), 900);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("wx:open-install", onOpen); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); };
  }, []);

  const close = () => { setPopup(false); setBusy(false); setWarnChrome(false); };

  const create = async () => {
    setBusy(true);
    const dev = detect();
    // 1) NATIVE install — Android Chrome/Edge, desktop Chrome/Edge/Opera/Samsung: creates the home screen icon
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === "accepted") { setInstalled(true); setPopup(false); }
        setBusy(false); return;
      } catch { /* fall through */ }
    }
    // 2) iPhone / iPad — open the Share sheet (only way on iOS)
    if (dev.ios) {
      if (navigator.share) {
        try { await navigator.share({ title: "winkox", text: "winkox — Khelo aur Kamao", url: location.href }); setPopup(false); } catch { }
        setIosHint(true); setBusy(false); return;
      }
      setPopup(false); setIosHint(true); setBusy(false); return;
    }
    // Without a native prompt, the browser must create the shortcut from its own menu.
    setWarnChrome(true);
    setBusy(false);
  };

  if (installed) return null;
  const host = typeof location !== "undefined" ? location.host : "winkox.shop";

  return (
    <>
      {showBtn && (
        <button onClick={() => setPopup(true)} className="keep-white fixed bottom-[10.5rem] left-3 z-[39] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 active:scale-95 md:bottom-20 md:left-auto md:right-6 md:z-[45]">
          <DownloadIcon size={16} /> Install as App
        </button>
      )}

      {popup && (
        <div className="fixed inset-0 z-[95]" onClick={close}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute left-1/2 top-1/2 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between">
              <h2 className="text-lg font-bold sm:text-xl">Create a shortcut to this page</h2>
              <button onClick={close} aria-label="Cancel" className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><XIcon size={18} /></button>
            </div>
            <p className="text-sm text-slate-500">Shortcuts open in {d.ios ? "Safari" : "Chrome"}</p>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] shadow"><img src="/brand/logo-mark.png" alt="winkox" className="h-7 w-7 rounded-lg object-cover" /></span>
              <div className="min-w-0">
                <div className="truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">winkox — Khelo aur Kamao</div>
                <div className="mt-1 text-xs text-slate-500">{host}</div>
              </div>
            </div>

            {warnChrome ? (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                {d.mobile ? <><b>Add to Home Screen:</b> is page ko browser ke menu se <b>Add to Home Screen</b> select karein, phir <b>Add</b> press karein.</> : d.safari ? <><b>Add to Dock:</b> Safari ke <b>File</b> menu se <b>Add to Dock</b> select karein, phir <b>Add</b> press karein.</> : <><b>Open as window:</b> Chrome ke menu <b>⋮</b> se <b>Save and share → Create shortcut</b> select karein, phir <b>Open as window</b> check karke <b>Create</b> press karein.</>}
                <button onClick={() => { try { navigator.share?.({ title: "winkox", url: location.href }); } catch { } setWarnChrome(false); }} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-[#7edfff] py-2 font-bold text-[#07435a]">Share / Open in Chrome</button>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800">
                {d.ios ? <span className="flex items-start gap-1"><AppleIcon size={14} className="mt-0.5 shrink-0" /> Press <ShareIcon size={12} className="inline" /> <b>Add to Home Screen</b> → <b>Add</b>.</span>
                  : d.android ? <span className="flex items-start gap-1"><AndroidIcon size={14} className="mt-0.5 shrink-0" /> Press <b>Create</b>, then <b>Install</b> — winkox home screen par aa jayegi.</span>
                    : <span className="flex items-start gap-1"><LaptopIcon size={14} className="mt-0.5 shrink-0" /> Press <b>Create</b> — desktop/Start Menu/Dock shortcut ban jayega.</span>}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={close} className="rounded-full bg-[#7edfff] px-7 py-2.5 text-sm font-bold text-[#07435a] hover:bg-[#5ed3fa]">Cancel</button>
              {!warnChrome && <button onClick={create} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-[#7edfff] px-7 py-2.5 text-sm font-bold text-[#07435a] hover:bg-[#5ed3fa] disabled:opacity-60">{busy ? "Opening…" : (<><CheckIcon size={14} /> Create shortcut</>)}</button>}
            </div>
          </div>
        </div>
      )}

      {iosHint && (
        <div className="fixed inset-x-0 bottom-28 z-[95] flex justify-center px-4">
          <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[#3a2470] bg-[#140c2a] p-3 text-xs text-white shadow-2xl">
            <ShareIcon size={22} className="shrink-0 text-[#8fd3ff]" />
            <div>Press <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>. iPhone par shortcut isi tarah banta hai.</div>
            <button onClick={() => setIosHint(false)} className="shrink-0 text-slate-400"><XIcon size={14} /></button>
          </div>
        </div>
      )}
    </>
  );
}
