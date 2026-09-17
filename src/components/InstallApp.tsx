"use client";

import { useEffect, useState } from "react";
import { GooglePlayIcon, AppleIcon } from "@/components/Icons";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallApp({ androidUrl, iosUrl, compact }: { androidUrl?: string; iosUrl?: string; compact?: boolean }) {
  const [deferred, setDeferred] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setDeferred(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", () => setInstalled(true));
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const android = async () => {
    if (androidUrl) { window.open(androidUrl, "_blank"); return; }
    if (deferred) { await deferred.prompt(); await deferred.userChoice; setDeferred(null); return; }
    alert("Chrome menu (⋮) → 'Add to Home screen' / 'Install app' select karein.");
  };
  const apple = () => { if (iosUrl) { window.open(iosUrl, "_blank"); return; } setShowIosTip(true); };
  if (installed && !compact) return <div className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300">App installed hai</div>;
  return (
    <div className={compact ? "flex gap-2" : "space-y-2"}>
      <button onClick={android} className="store-badge flex w-full items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-left text-xs font-bold text-white ring-1 ring-white/15 hover:ring-[#ffb800]"><GooglePlayIcon size={22} /><span><span className="block text-[8px] font-normal text-slate-300">{androidUrl ? "DOWNLOAD APK" : "GET IT ON"}</span>{androidUrl ? "Android App" : "Google Play"}</span></button>
      <button onClick={apple} className="store-badge flex w-full items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-left text-xs font-bold text-white ring-1 ring-white/15 hover:ring-[#ffb800]"><AppleIcon size={22} /><span><span className="block text-[8px] font-normal text-slate-300">Download on the</span>App Store</span></button>
      {showIosTip && !compact && <p className="rounded-lg bg-[#ffb800]/10 px-3 py-2 text-[11px] text-[#ffe0a3]">iPhone: Safari mein <b>Share</b> button → <b>"Add to Home Screen"</b> dabayein — app icon ban jayega.</p>}
      {ios && compact && showIosTip && <span className="text-[10px] text-[#ffe0a3]">Safari → Share → Add to Home Screen</span>}
    </div>
  );
}
