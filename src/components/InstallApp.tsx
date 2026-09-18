"use client";
import { GooglePlayIcon, AppleIcon } from "@/components/Icons";
import { DownloadIcon } from "@/components/Icons";

/**
 * Direct install badges — no instructions:
 *  • Android / desktop browsers that support it: native install prompt
 *  • iPhone/iPad: opens iOS Share sheet immediately (Add to Home Screen)
 *  • fallback: downloads the app launcher
 */
function direct() {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ev = (window as unknown as { __wxPrompt?: { prompt: () => Promise<unknown> } }).__wxPrompt;
  // try native
  const w = window as unknown as { __wxBIP?: () => Promise<unknown> };
  if (typeof w.__wxBIP === "function") { w.__wxBIP(); return; }
  if (ios) {
    if (navigator.share) { navigator.share({ title: "WinX555", url: location.href }).catch(() => {}); return; }
    alert('Safari mein Share button 􀈂 → "Add to Home Screen" → Add');
    return;
  }
  const a = document.createElement("a");
  a.href = "/download/winx555.webmanifest"; a.download = "winx555-install.html";
  document.body.appendChild(a); a.click(); a.remove();
}

export function InstallApp({ compact }: { androidUrl?: string; iosUrl?: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-2" : "space-y-2"}>
      <button onClick={direct} className="store-badge keep-white flex w-full items-center gap-2 rounded-lg bg-black px-3 py-2 text-left text-white ring-1 ring-white/15 transition hover:scale-[1.02] hover:ring-[#ffb800] active:scale-95">
        <GooglePlayIcon size={26} />
        <span><span className="block text-[8px] font-normal uppercase tracking-wide text-slate-300">Get it on</span><span className="flex items-center gap-1 text-sm font-black">Google Play <DownloadIcon size={12} /></span></span>
      </button>
      <button onClick={direct} className="store-badge keep-white flex w-full items-center gap-2 rounded-lg bg-black px-3 py-2 text-left text-white ring-1 ring-white/15 transition hover:scale-[1.02] hover:ring-[#ffb800] active:scale-95">
        <AppleIcon size={26} />
        <span><span className="block text-[8px] font-normal uppercase tracking-wide text-slate-300">Download on the</span><span className="flex items-center gap-1 text-sm font-black">App Store <DownloadIcon size={12} /></span></span>
      </button>
    </div>
  );
}
