"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, AppleIcon, AndroidIcon, LaptopIcon, CheckIcon, ShareIcon } from "./Icons";

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
  const [d, setD] = useState(detect());
  const [tinyHint, setTinyHint] = useState(false);

  useEffect(() => {
    setD(detect());
    const sd = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (sd) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShowBtn(true); };
    const onInstalled = () => { setInstalled(true); setShowBtn(false); setPopup(false); setBusy(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setShowBtn(true), 1200);
    // one-time friendly auto popup after the page settles
    const auto = setTimeout(() => { if (!localStorage.getItem("wx_install_seen")) setPopup(true); }, 6000);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); clearTimeout(auto); };
  }, []);

  const open = () => setPopup(true);
  const close = () => { setPopup(false); setBusy(false); try { localStorage.setItem("wx_install_seen", "1"); } catch {} };

  const ok = async () => {
    setBusy(true);
    const dev = detect();
    // 1) Native browser install (Android Chrome / Edge / desktop Chrome / Edge / Opera / Samsung)
    if (deferred) {
      try { await deferred.prompt(); const { outcome } = await deferred.userChoice; setDeferred(null); if (outcome === "accepted") { setInstalled(true); setPopup(false); } setBusy(false); return; }
      catch { /* fall through */ }
    }
    // 2) iPhone / iPad — open the system Share sheet right away
    if (dev.ios) {
      if (navigator.share) {
        try { await navigator.share({ title: "WinX555", text: "WinX555 — Khelo aur Kamao", url: location.href }); setPopup(false); setBusy(false); setTinyHint(true); setTimeout(() => setTinyHint(false), 8000); return; } catch { setBusy(false); }
      }
      setPopup(false); setBusy(false); setTinyHint(true); setTimeout(() => setTinyHint(false), 9000);
      return;
    }
    // 3) Android without install API — share into Chrome + launcher file
    if (dev.android) {
      if (navigator.share) { try { await navigator.share({ title: "WinX555", url: location.href }); } catch {} }
      const a = document.createElement("a"); a.href = "/download/winx555-install.html"; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
      setPopup(false); setBusy(false); return;
    }
    // 4) Desktop — download a desktop shortcut + open app-like window
    const isMac = /Mac OS X|Macintosh/.test(navigator.userAgent);
    const a = document.createElement("a"); a.href = isMac ? "/download/WinX555.webloc" : "/download/WinX555.url"; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
    try { window.open(location.href, "winx555app", "width=430,height=840,resizable=yes,scrollbars=yes"); } catch {}
    setPopup(false); setBusy(false);
  };

  if (installed) return null;
  return (
    <>
      {showBtn && (
        <button onClick={open} className="keep-white fixed bottom-20 left-3 z-[45] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 active:scale-95 md:bottom-6 md:left-6">
          <DownloadIcon size={16} /> Install App
        </button>
      )}

      {popup && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4" onClick={close}>
          <div className="game-surface w-full max-w-sm rounded-3xl border border-[#3a2470] bg-[#140c2a] p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={close} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10"><XIcon size={16} /></button>
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] shadow-lg shadow-amber-500/40"><DownloadIcon size={30} className="text-[#2a1500]" /></div>
            <h2 className="text-lg font-black text-white">Add WinX555 to your Home Screen?</h2>
            <p className="mx-auto mt-1 max-w-xs text-xs text-[#b8a7e6]">
              {d.ios ? <>Tap <b className="text-white">OK</b>, then press <ShareIcon size={12} className="inline text-[#8fd3ff]" /> and choose <b className="text-white">“Add to Home Screen”</b> — the WinX555 icon appears on your iPhone/iPad.</>
                : d.android ? <>Tap <b className="text-white">OK</b> then press <b className="text-white">Install</b> in the popup — the WinX555 icon appears with your apps.</>
                : <>Tap <b className="text-white">OK</b> to create a WinX555 shortcut and open it as an app window.</>}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 text-[#b8a7e6]">
              <span className="flex items-center gap-1 text-[11px]">{d.mobile ? <AndroidIcon size={16} className="text-emerald-400" /> : <LaptopIcon size={16} className="text-sky-300" />}{d.android ? "Android" : d.ios ? (d.ipad ? "iPad" : "iPhone") : "Desktop"}</span>
              {d.ios && <span className="flex items-center gap-1 text-[11px]"><AppleIcon size={16} className="text-slate-200" /> Safari</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={close} className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={ok} disabled={busy} className="rounded-2xl bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] py-3 text-sm font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:brightness-110 disabled:opacity-60">
                {busy ? "Adding…" : (<span className="flex items-center justify-center gap-1.5"><CheckIcon size={15} /> OK — Add</span>)}
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">Runs online · no Play Store/App Store needed</p>
          </div>
        </div>
      )}

      {tinyHint && (
        <div className="fixed inset-x-0 bottom-28 z-[95] flex justify-center px-4 md:left-auto md:right-6 md:justify-end">
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-[#3a2470] bg-[#140c2a] p-3 text-xs text-white shadow-2xl">
            <ShareIcon size={22} className="shrink-0 text-[#8fd3ff]" />
            <div>Press the <b>Share</b> icon, scroll down and tap <b>“Add to Home Screen”</b>, then <b>Add</b>.</div>
            <button onClick={() => setTinyHint(false)} className="shrink-0 text-slate-400"><XIcon size={14} /></button>
          </div>
        </div>
      )}
    </>
  );
}
