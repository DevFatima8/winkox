"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/Icons";

const THEME_KEY = "wx_theme";

const getCookieTheme = (): "light" | "dark" | null => {
  const m = document.cookie.match(/(?:^|; )theme=([^;]+)/);
  const v = m?.[1];
  return v === "light" || v === "dark" ? v : null;
};

const getStoredTheme = (): "light" | "dark" | null => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch { }
  return getCookieTheme();
};

const syncThemeDom = (light: boolean) => {
  document.documentElement.classList.toggle("light", light);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", light ? "#f3f6f9" : "#050b0f");
};

const persistTheme = (light: boolean) => {
  const value = light ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, value); } catch { }
  document.cookie = `theme=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
};

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    const isLight = stored ? stored === "light" : document.documentElement.classList.contains("light");
    setLight(isLight);
    syncThemeDom(isLight);
    persistTheme(isLight);
  }, []);

  const apply = (isLight: boolean) => {
    setLight(isLight);
    syncThemeDom(isLight);
    persistTheme(isLight);
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
