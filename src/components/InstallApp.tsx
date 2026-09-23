"use client";
import { GooglePlayIcon, AppleIcon, DownloadIcon } from "@/components/Icons";

const openPopup = () => window.dispatchEvent(new Event("wx:open-install"));
// Google Play badge — try the install right away, same result as tapping "Install as App"
const installNow = () => window.dispatchEvent(new Event("wx:install-now"));

export function InstallApp({ compact }: { androidUrl?: string; iosUrl?: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-2" : "space-y-2"}>
      <button onClick={installNow} className="store-badge keep-white flex w-full items-center gap-2 rounded-lg bg-black px-3 py-2 text-left text-white ring-1 ring-white/15 transition hover:scale-[1.02] hover:ring-[#ffb800] active:scale-95">
        <GooglePlayIcon size={26} />
        <span><span className="block text-[8px] font-normal uppercase tracking-wide text-slate-300">Get it on</span><span className="flex items-center gap-1 text-sm font-black">Google Play <DownloadIcon size={12} /></span></span>
      </button>
      <button onClick={openPopup} className="store-badge keep-white flex w-full items-center gap-2 rounded-lg bg-black px-3 py-2 text-left text-white ring-1 ring-white/15 transition hover:scale-[1.02] hover:ring-[#ffb800] active:scale-95">
        <AppleIcon size={26} />
        <span><span className="block text-[8px] font-normal uppercase tracking-wide text-slate-300">Download on the</span><span className="flex items-center gap-1 text-sm font-black">App Store <DownloadIcon size={12} /></span></span>
      </button>
    </div>
  );
}
