"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, CheckIcon, AppleIcon, AndroidIcon } from "./Icons";

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

/** Direct install — no instructions. Returns true if it handled it. */
export function installDirect(deferredRef: { current: BIPEvent | null }): boolean {
  const d = detect();
  // iPhone/iPad: open the system Share sheet directly — user taps "Add to Home Screen" once
  if (d.ios && navigator.share) { try { navigator.share({ title: "WinX555", text: "WinX555 — Khelo aur Kamao", url: location.href }); return true; } catch { return false; } }
  return false;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [d, setD] = useState(detect());
  const [showBtn, setShowBtn] = useState(false);
  const [iosTip, setIosTip] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setD(detect());
    const sd = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (sd) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); const ev = e as BIPEvent; setDeferred(ev); setShowBtn(true);
      (window as unknown as Record<string, unknown>).__wxBIP = async () => { try { await ev.prompt(); const { outcome } = await ev.userChoice; if (outcome === "accepted") { setInstalled(true); setShowBtn(false); } } catch {} }; };
    const onInstalled = () => { setInstalled(true); setShowBtn(false); setInstalling(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setShowBtn(true), 1200);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); };
  }, []);

  const click = async () => {
    setInstalling(true);
    const dev = detect();
    if (deferred) {
      // native one-tap (Android Chrome, desktop Chrome/Edge): app installs directly
      try { await deferred.prompt(); const { outcome } = await deferred.userChoice; setDeferred(null); if (outcome !== "accepted") setInstalling(false); return; }
      catch { /* fall through */ }
    }
    // iPhone / iPad: system Share sheet opens immediately
    if (dev.ios) {
      if (navigator.share) { try { await navigator.share({ title: "WinX555", text: "WinX555 — Khelo aur Kamao", url: location.href }); setInstalling(false); return; } catch { /* cancelled */ } }
      // older Safari without Web Share: tiny floating hint
      setIosTip(true); setTimeout(() => setIosTip(false), 6000); setInstalling(false); return;
    }
    // Android without native prompt (Firefox / in-app browser / older): download the PWA launcher directly
    if (dev.android) {
      const a = document.createElement("a");
      a.href = "/download/winx555.webmanifest"; a.download = "winx555-install.html";
      document.body.appendChild(a); a.click(); a.remove();
      // also offer Chrome re-open hint via Web Share (many phones add shortcut from it)
      if (navigator.share) try { await navigator.share({ title: "WinX555", url: location.href }); } catch {}
      setInstalling(false); return;
    }
    // Desktop fallback: download shortcut
    const a = document.createElement("a");
    a.href = "/download/winx555.webmanifest"; a.download = "winx555-install.html";
    document.body.appendChild(a); a.click(); a.remove();
    setInstalling(false);
  };

  if (installed) return null;
  return (
    <>
      {showBtn && (
        <button onClick={click} className="keep-white fixed bottom-20 left-3 z-[45] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 active:scale-95 md:bottom-6 md:left-6">
          <DownloadIcon size={16} /> {installing ? "Installing…" : "Install App"}
        </button>
      )}
      {iosTip && (
        <div className="fixed bottom-36 left-3 z-[50] w-64 rounded-2xl border border-[#3a2470] bg-[#140c2a] p-3 text-xs text-white shadow-2xl md:left-6">
          <div className="mb-1 flex items-center justify-between font-black"><span>Add to Home Screen</span><button onClick={() => setIosTip(false)} className="text-slate-400"><XIcon size={14} /></button></div>
          <p className="text-[#b8a7e6]">Tap <b className="text-sky-300">Share 􀈂</b> → <b className="text-white">Add to Home Screen</b> → Add. App icon ban jayega.</p>
        </div>
      )}
    </>
  );
}
