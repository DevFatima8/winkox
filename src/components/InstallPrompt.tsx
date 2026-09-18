"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, AppleIcon, AndroidIcon, LaptopIcon, ShareIcon } from "./Icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function detect() {
  if (typeof navigator === "undefined") return { ios: false, android: false, ipad: false, mobile: false, safari: false };
  const ua = navigator.userAgent || "";
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ios = /iPhone|iPod/.test(ua) || ipad;
  const android = /android/i.test(ua);
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return { ios, android, ipad, mobile: ios || android, safari };
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [popup, setPopup] = useState(false);
  const [showBtn, setShowBtn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);
  const [d, setD] = useState(detect());

  useEffect(() => {
    setD(detect());
    const sd = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (sd) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShowBtn(true); };
    const onInstalled = () => { setInstalled(true); setShowBtn(false); setPopup(false); setBusy(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setShowBtn(true), 1000);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); };
  }, []);

  const open = () => setPopup(true);
  const close = () => { setPopup(false); setBusy(false); };

  const create = async () => {
    setBusy(true);
    const dev = detect();
    // Chrome/Edge/Android/desktop: the BROWSER ITSELF shows the native "Create a shortcut" dialog (Arena style)
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === "accepted") { setInstalled(true); setPopup(false); setBusy(false); return; }
        setBusy(false); return;
      } catch { /* continue to fallbacks */ }
    }
    // iPhone/iPad: Safari Share sheet → Add to Home Screen
    if (dev.ios) {
      if (navigator.share) {
        try { await navigator.share({ title: "WinX555", text: "WinX555 — Khelo aur Kamao", url: location.href }); setPopup(false); setBusy(false); setHint(true); setTimeout(() => setHint(false), 9000); return; } catch { setBusy(false); }
      }
      setPopup(false); setBusy(false); setHint(true); setTimeout(() => setHint(false), 9000);
      return;
    }
    // Android without Chrome install API
    if (dev.android) {
      if (navigator.share) { try { await navigator.share({ title: "WinX555", url: location.href }); } catch {} }
      const a = document.createElement("a"); a.href = "/download/winx555-install.html"; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
      setPopup(false); setBusy(false); return;
    }
    // Desktop fallback: shortcut file + app window
    const isMac = /Mac OS X|Macintosh/.test(navigator.userAgent);
    const a = document.createElement("a"); a.href = isMac ? "/download/WinX555.webloc" : "/download/WinX555.url"; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
    try { window.open(location.href, "winx555app", "width=430,height=860,resizable=yes,scrollbars=yes"); } catch {}
    setPopup(false); setBusy(false);
  };

  if (installed) return null;
  const siteName = "WinX555 — Khelo aur Kamao (WinX555)";
  const host = typeof location !== "undefined" ? location.host : "winx555games.shop";

  return (
    <>
      {showBtn && (
        <button onClick={open} className="keep-white fixed bottom-20 left-3 z-[45] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 active:scale-95 md:bottom-6 md:left-6">
          <DownloadIcon size={16} /> Install App
        </button>
      )}

      {/* Arena-style native-feeling shortcut dialog */}
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
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] text-[#2a1500] shadow"><img src="/favicon.png" alt="" className="h-7 w-7" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /></span>
              <div className="min-w-0">
                <div className="truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">{siteName}</div>
                <div className="mt-1 text-xs text-slate-500">{host}</div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800">
              {d.ios ? (
                <span className="flex items-start gap-1"><AppleIcon size={14} className="mt-0.5 shrink-0" /> Press <b>Create</b>, then in the Share sheet tap <ShareIcon size={12} className="inline" /> <b>“Add to Home Screen”</b> → <b>Add</b>.</span>
              ) : d.android ? (
                <span className="flex items-start gap-1"><AndroidIcon size={14} className="mt-0.5 shrink-0" /> Press <b>Create</b>, then tap <b>Install</b> in the browser popup — the icon appears with your apps.</span>
              ) : (
                <span className="flex items-start gap-1"><LaptopIcon size={14} className="mt-0.5 shrink-0" /> Press <b>Create</b> to install WinX555 as an app (Desktop & Start Menu shortcut).</span>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={close} className="rounded-full bg-[#7edfff] px-7 py-2.5 text-sm font-bold text-[#07435a] transition hover:bg-[#5ed3fa]">Cancel</button>
              <button onClick={create} disabled={busy} className="rounded-full bg-[#7edfff] px-7 py-2.5 text-sm font-bold text-[#07435a] transition hover:bg-[#5ed3fa] disabled:opacity-60">{busy ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {hint && (
        <div className="fixed inset-x-0 bottom-28 z-[95] flex justify-center px-4 md:left-auto md:right-6 md:justify-end">
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-[#3a2470] bg-[#140c2a] p-3 text-xs text-white shadow-2xl">
            <ShareIcon size={22} className="shrink-0 text-[#8fd3ff]" />
            <div>Tap <b>Share</b>, scroll down and choose <b>“Add to Home Screen”</b>, then <b>Add</b>.</div>
            <button onClick={() => setHint(false)} className="shrink-0 text-slate-400"><XIcon size={14} /></button>
          </div>
        </div>
      )}
    </>
  );
}
