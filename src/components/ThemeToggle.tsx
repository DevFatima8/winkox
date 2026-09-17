"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/Icons";

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.classList.contains("light")); }, []);
  const apply = (l: boolean) => {
    setLight(l);
    document.documentElement.classList.toggle("light", l);
    document.cookie = `theme=${l ? "light" : "dark"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", l ? "#f3f6f9" : "#050b0f");
  };
  if (compact) {
    return (
      <div className="flex overflow-hidden rounded-full bg-black/30 ring-1 ring-[#3a2470] text-[11px] font-bold">
        <button onClick={() => apply(false)} className={`px-2.5 py-1 ${!light ? "btn-violet" : "text-[#b8a7e6]"}`} title="Dark"><MoonIcon size={14} /></button>
        <button onClick={() => apply(true)} className={`px-2.5 py-1 ${light ? "btn-violet" : "text-[#b8a7e6]"}`} title="Light"><SunIcon size={14} /></button>
      </div>
    );
  }
  return (
    <button onClick={() => apply(!light)} title={light ? "Switch to Dark mode" : "Switch to Light mode"} aria-label="Toggle theme"
      className="relative flex h-8 w-14 items-center rounded-full bg-black/30 px-1 ring-1 ring-[#3a2470] transition">
      <span className={`absolute left-1 flex h-6 w-6 items-center justify-center rounded-full shadow transition-transform duration-300 ${light ? "translate-x-6 bg-[#ffb020] text-[#1f1200]" : "translate-x-0 bg-[#1e293b] text-white"}`}>{light ? <SunIcon size={13} /> : <MoonIcon size={13} />}</span>
      <span className={`ml-auto mr-1 text-[#b8a7e6] ${light ? "opacity-0" : "opacity-70"}`}><SunIcon size={12} /></span>
    </button>
  );
}
