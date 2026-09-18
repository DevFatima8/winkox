"use client";
import { GooglePlayIcon, AppleIcon } from "@/components/Icons";
import { openInstallSheet } from "@/components/InstallPrompt";

/** Google Play / App Store badges both open the Add-to-Home-Screen install sheet. */
export function InstallApp({ compact }: { androidUrl?: string; iosUrl?: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-2" : "space-y-2"}>
      <button onClick={openInstallSheet} className="store-badge keep-white flex w-full items-center gap-2 rounded-lg bg-black px-3 py-2 text-left text-white ring-1 ring-white/15 transition hover:scale-[1.02] hover:ring-[#ffb800]">
        <GooglePlayIcon size={24} />
        <span><span className="block text-[8px] font-normal uppercase tracking-wide text-slate-300">Get it on</span><span className="text-sm font-black">Google Play</span></span>
      </button>
      <button onClick={openInstallSheet} className="store-badge keep-white flex w-full items-center gap-2 rounded-lg bg-black px-3 py-2 text-left text-white ring-1 ring-white/15 transition hover:scale-[1.02] hover:ring-[#ffb800]">
        <AppleIcon size={24} />
        <span><span className="block text-[8px] font-normal uppercase tracking-wide text-slate-300">Download on the</span><span className="text-sm font-black">App Store</span></span>
      </button>
      <p className="text-center text-[10px] text-[#b8a7e6]">Tap → follow steps for your phone · no app store needed</p>
    </div>
  );
}
