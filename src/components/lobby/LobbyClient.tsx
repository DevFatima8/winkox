"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n, Hi } from "@/lib/i18n/client";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { Drawer as GlobalDrawer } from "@/components/Drawer";
import { HomeIcon, FlameIcon, SpadeIcon, GamepadIcon, GiftIcon, WalletIcon, BanknoteIcon, HistoryIcon, BookIcon, UserIcon, MegaphoneIcon, MailIcon, ArrowUpIcon, XIcon, MenuIcon, GlobeIcon, CrownIcon, UsersIcon } from "@/components/Icons";
import type { ReactNode } from "react";

/* ---------- Banner carousel ---------- */
export type Slide = { img?: string; bg: string; kicker?: string; title: string; sub?: string; href: string; cta: string; emoji?: string };
export function BannerCarousel({ slides }: { slides: Slide[] }) {
  const { isUr } = useI18n();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);
  return (
    <div className="relative overflow-hidden rounded-2xl border wx-drawer-border shadow-[0_10px_40px_rgba(139,92,246,.35)] md:rounded-3xl" dir="ltr">
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <Link key={k} href={s.href} className={`on-image relative block aspect-[2.2/1] w-full shrink-0 md:aspect-[3.2/1] lg:aspect-[3.6/1] ${s.bg}`}>
            {s.img && <img src={s.img} alt="" className={`absolute inset-y-0 h-full w-[62%] object-cover ${isUr ? "left-0 object-right [mask-image:linear-gradient(270deg,transparent,black_35%)]" : "right-0 object-left [mask-image:linear-gradient(90deg,transparent,black_35%)]"}`} />}
            <div className={`absolute inset-0 ${isUr ? "bg-[radial-gradient(circle_at_80%_30%,rgba(255,255,255,.10),transparent_45%)]" : "bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,.10),transparent_45%)]"}`} />
            <div dir={isUr ? "rtl" : "ltr"} className={`absolute inset-0 flex flex-col justify-center p-4 sm:p-6 lg:p-8 ${isUr ? "items-end text-right" : "items-start"}`}>
              {s.kicker && <span className="mb-2 w-max rounded-full bg-black/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#ffd45a] ring-1 ring-[#ffb800]/50 sm:text-xs">{s.kicker}</span>}
              <h2 className="max-w-[58%] text-[22px] font-black uppercase leading-[1.02] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.7)] sm:text-4xl lg:text-5xl">
                <Hi s={s.title} />
              </h2>
              {s.sub && <p className="mt-1.5 max-w-[58%] text-[11px] font-semibold wx-rowtext drop-shadow sm:text-sm lg:text-base">{s.sub}</p>}
              <span className="btn-gold mt-3 w-max rounded-full px-4 py-1.5 text-xs font-black sm:text-sm">{s.cta} →</span>
            </div>
            {s.emoji && !s.img && <span className={`absolute top-1/2 -translate-y-1/2 text-[64px] drop-shadow-[0_10px_20px_rgba(0,0,0,.5)] sm:text-[110px] lg:text-[150px] ${isUr ? "left-4 lg:left-12" : "right-4 lg:right-12"}`}>{s.emoji}</span>}
          </Link>
        ))}
      </div>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, k) => <button key={k} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-[#ffb800]" : "w-1.5 bg-white/50"}`} />)}
      </div>
    </div>
  );
}

/* ---------- Marquee ---------- */
export function Marquee({ items }: { items: string[] }) {
  const text = items.join("      •      ");
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 ring-1 ring-[#3a2470]">
      <span className="shrink-0 text-[#ffb800]"><MegaphoneIcon size={16} /></span>
      <div className="relative flex-1 overflow-hidden whitespace-nowrap text-xs font-semibold text-white" dir="ltr">
        <div className="inline-block animate-[marq_60s_linear_infinite] pl-[100%]"><bdi>{text}</bdi>      •      <bdi>{text}</bdi></div>
      </div>
      <Link href="/promo" className="relative shrink-0 rounded-md bg-[#241546] p-1.5 text-[#b8a7e6]">
        <MailIcon size={14} /><span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff3b5c] text-[9px] font-bold text-white">3</span>
      </Link>
      <style>{`@keyframes marq{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}`}</style>
    </div>
  );
}

/* ---------- Jackpot counter ---------- */
export function JackpotCounter({ start }: { start: number }) {
  const [v, setV] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setV((x) => x + Math.floor(Math.random() * 900) + 50), 700);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{v.toLocaleString("en-US")}</span>;
}

/* ---------- Live winners ticker ---------- */
const NAMES = ["ab***112", "mk***778", "sa***301", "us***905", "ha***217", "zi***640", "fa***588", "im***432", "bi***019", "no***873", "ta***256", "ra***660"];
const GAMES = ["Aviator", "Plinko", "Chicken Dash", "Dragon Tiger", "Chicken Road 2", "Andar Bahar"];
export function WinnersTicker() {
  const [items, setItems] = useState(() => Array.from({ length: 8 }, (_, i) => ({ id: i, n: NAMES[i % NAMES.length], g: GAMES[i % GAMES.length], a: 500 + ((i * 7919) % 45000) })));
  useEffect(() => {
    const id = setInterval(() => setItems((xs) => [{ id: Date.now(), n: NAMES[Math.floor(Math.random() * NAMES.length)], g: GAMES[Math.floor(Math.random() * GAMES.length)], a: Math.floor(200 + Math.random() * 60000) }, ...xs].slice(0, 8)), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((w) => (
        <div key={w.id} className="flex shrink-0 items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-[11px] ring-1 ring-[#3a2470]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]" />
          <span className="text-[#b8a7e6]">{w.n}</span>
          <span className="text-white">{w.g}</span>
          <span className="font-black text-[#ffb800]">+Rs. {w.a.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Leaderboard auto-scroll ---------- */
export type Row = { rank: number; name: string; amount: number; up: boolean };
export function LeaderboardTable({ rows, labels = ["Rank", "Username", "Winnings"] }: { rows: Row[]; labels?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let y = 0;
    const id = setInterval(() => { y += 1; if (y >= el.scrollHeight / 2) y = 0; el.scrollTop = y; }, 40);
    return () => clearInterval(id);
  }, []);
  const all = [...rows, ...rows];
  return (
    <div className="overflow-hidden rounded-xl border wx-drawer-border">
      <div className="on-image grid grid-cols-[60px_1fr_1fr] bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-3 py-1.5 text-center text-xs font-bold text-white"><span>{labels[0]}</span><span>{labels[1]}</span><span>{labels[2]}</span></div>
      <div ref={ref} className="h-32 overflow-hidden bg-black/30 md:h-44 lg:h-52">
        {all.map((r, i) => (
          <div key={i} className="grid grid-cols-[60px_1fr_1fr] border-b wx-drawer-border/60 px-3 py-1.5 text-center text-xs wx-rowtext">
            <span className="font-bold text-white">{r.rank} <span className={r.up ? "text-emerald-400" : "text-[#ff3b5c]"}>{r.up ? "▲" : "▼"}</span></span>
            <span>{r.name}</span>
            <span className="font-semibold text-[#ffb800]">Rs. {r.amount.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Side drawer ---------- */
export function Drawer({ loggedIn, isAdmin }: { loggedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const links: [ReactNode, string, string][] = [
    [<HomeIcon key="h" size={18} />, t("home"), "/"], [<FlameIcon key="f" size={18} />, t("hotGames"), "/#games"], [<SpadeIcon key="c" size={18} />, t("cards"), "/?cat=Cards#games"], [<GamepadIcon key="g" size={18} />, t("miniGames"), "/?cat=Mini%20Games#games"],
    [<GiftIcon key="p" size={18} />, t("promo"), "/promo"], [<CrownIcon key="v" size={18} />, "VIP", "/vip"], [<UsersIcon key="i" size={18} />, t("invite"), loggedIn ? "/client/team" : "/invite"],
    [<WalletIcon key="d" size={18} />, t("deposit"), loggedIn ? "/client/wallet" : "/login"], [<BanknoteIcon key="w" size={18} />, t("withdraw"), loggedIn ? "/client/wallet" : "/login"],
    [<HistoryIcon key="b" size={18} />, t("betHistory"), loggedIn ? "/client/history" : "/login"], [<BookIcon key="k" size={18} />, t("helpCenter"), "/help"], [<UserIcon key="u" size={18} />, t("profile"), isAdmin ? "/admin" : loggedIn ? "/client/profile" : "/login"],
  ];
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-white" aria-label="Menu"><MenuIcon size={24} /></button>
      <GlobalDrawer open={open} onClose={() => setOpen(false)} side="left">
        <div className="flex items-center gap-2 p-4 pb-3">
          <BrandLogo className="h-9 w-9" /><span className="text-lg font-black text-gold-grad">WinX555</span>
        </div>
        <div className="space-y-2 px-3">
          <div className="wx-chip flex items-center justify-between rounded-xl bg-black/30 px-3 py-2.5 text-xs text-[#b8a7e6]"><span className="inline-flex items-center gap-2"><GlobeIcon size={14} /> {t("language")}</span><LanguageSwitch compact /></div>
          <div className="wx-chip flex items-center justify-between rounded-xl bg-black/30 px-3 py-2.5 text-xs text-[#b8a7e6]"><span>Theme</span><ThemeToggle compact /></div>
        </div>
        <nav className="mt-3 space-y-0.5 px-3">
          {links.map(([i, l, h]) => <Link key={l + h} href={h} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold wx-rowtext hover:wx-row"><span className="wx-rowicon">{i}</span>{l}</Link>)}
        </nav>
        {!loggedIn && (
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 p-4">
            <Link href="/signup" className="btn-gold rounded-xl py-2.5 text-center text-sm font-black">{t("register")}</Link>
            <Link href="/login" className="btn-outline rounded-xl py-2.5 text-center text-sm font-bold">{t("login")}</Link>
          </div>
        )}
      </GlobalDrawer>
    </>
  );
}


/* ---------- TOP button ---------- */
export function TopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const h = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  if (!show) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn-violet fixed bottom-24 right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full md:bottom-6 md:right-6" aria-label="Top"><ArrowUpIcon size={20} /></button>
  );
}

/* ---------- Game category tabs ---------- */
export function GameTabs({ tabs, active, labels = {} }: { tabs: string[]; active: string; labels?: Record<string, string> }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {tabs.map((t) => (
        <Link key={t} href={`/?cat=${encodeURIComponent(t)}#games`} scroll={false} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${active === t ? "btn-violet" : "bg-black/30 text-[#b8a7e6] ring-1 ring-[#3a2470] hover:text-white"}`}>
          {labels[t] ?? t}
        </Link>
      ))}
    </div>
  );
}
