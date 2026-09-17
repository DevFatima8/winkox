"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { BannerCarousel, Drawer, JackpotCounter, LeaderboardTable, Marquee, TopButton, GameTabs, WinnersTicker, type Row, type Slide } from "./LobbyClient";
import { NotificationBell } from "@/components/NotificationBell";
import { SupportWidget } from "@/components/SupportWidget";
import { PwaRegister } from "@/components/PwaRegister";
import { InstallApp } from "@/components/InstallApp";
import { OpenSupportButton } from "@/components/OpenSupport";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useI18n, Hi } from "@/lib/i18n/client";
import { WhatsAppIcon, TelegramIcon, FacebookIcon, InstagramIcon, YouTubeIcon, HeadsetIcon, HomeIcon, GiftIcon, UsersIcon, WalletIcon, UserIcon, ZapIcon, BanknoteIcon, ShieldIcon, FlameIcon, TrophyIcon, CrownIcon, PlayIcon, DownloadIcon, SlotIcon, GamepadIcon, SpadeIcon, FishIcon, CricketIcon, TicketIcon } from "@/components/Icons";

export type Viewer = { loggedIn: boolean; isAdmin: boolean; name?: string; balance?: number };
export type Links = { whatsapp?: string; whatsappChannel?: string; telegram?: string; telegramChannel?: string; facebook?: string; instagram?: string; youtube?: string; androidUrl?: string; iosUrl?: string };

export const BRAND = { name: "WinX555", domain: "winx555games.shop", whatsapp: "https://wa.me/923000000000", telegram: "https://t.me/winx555" };

/* ---------------- static content ---------------- */
export const GAME_META: Record<string, { img: string; provider: string; label: string; cat: string[]; hot?: boolean; badge?: string }> = {
  aviator: { img: "/games/aviator.jpg", provider: "SPRIBE", label: "Aviator", cat: ["Hot", "Mini Games", "Demo"], hot: true, badge: "HOT" },
  "chicken-dash": { img: "/games/chicken-dash.jpg", provider: "JILI", label: "Chicken Dash", cat: ["Hot", "Mini Games", "Demo"], badge: "NEW" },
  "dragon-tiger": { img: "/games/dragon-tiger.jpg", provider: "WG", label: "Dragon Tiger", cat: ["Hot", "Cards", "Live", "Demo"], badge: "LIVE" },
  "andar-bahar": { img: "/games/andar-bahar.jpg", provider: "JILI", label: "Andar Bahar", cat: ["Hot", "Cards", "Live", "Demo"], badge: "LIVE" },
  "chicken-road-2": { img: "/games/chicken-road.jpg", provider: "IN", label: "Chicken Road 2", cat: ["Hot", "Mini Games", "Demo"], hot: true },
  plinko: { img: "/games/plinko.jpg", provider: "WG", label: "Plinko", cat: ["Hot", "Mini Games", "Demo"], badge: "1000x" },
  "aviator-x": { img: "/games/aviator-x.jpg", provider: "SPRIBE", label: "Aviator X", cat: ["Hot", "Mini Games", "Demo"], badge: "NEW" },
  limbo: { img: "/games/limbo.jpg", provider: "WG", label: "Limbo", cat: ["Hot", "Mini Games", "Demo"], badge: "1M x" },
  mines: { img: "/games/mines.jpg", provider: "SPRIBE", label: "Mines", cat: ["Hot", "Mini Games", "Demo"], hot: true },
  "lucky-777": { img: "/games/lucky-777.jpg", provider: "JILI", label: "Lucky 777", cat: ["Hot", "Slot", "Demo"], badge: "777x" },
};
export const GAME_ORDER = ["aviator", "aviator-x", "chicken-dash", "mines", "dragon-tiger", "limbo", "andar-bahar", "chicken-road-2", "plinko", "lucky-777"];

const PROVIDER_STYLE: Record<string, string> = { SPRIBE: "text-[#ff5c5c] tracking-[0.15em]", JILI: "text-[#ffd76a] italic", WG: "text-[#c4b5fd]", IN: "text-white" };
const BADGE_STYLE: Record<string, string> = { "777x": "bg-gradient-to-r from-[#ef4444] to-[#b91c1c]", "1M x": "bg-gradient-to-r from-[#0ea5e9] to-[#6366f1]", HOT: "bg-gradient-to-r from-[#ff3b5c] to-[#ff8a00]", NEW: "bg-gradient-to-r from-[#22c55e] to-[#16a34a]", LIVE: "bg-gradient-to-r from-[#d946ef] to-[#8b5cf6]", "1000x": "bg-gradient-to-r from-[#ffb800] to-[#ff8a00] text-slate-950" };

export const MARQUEE = [
"WinX555 mein khush aamdeed! Register karein aur PKR 1500 welcome bonus hasil karein",
"Har deposit par 7% bonus — PKR 60,000 tak! JazzCash & Easypaisa instant",
"1 dost invite karein jo top-up kare — 588 PKR bonus + 1.5% betting commission + 4% top-up commission",
  "💵 Har bet par cashback — agle din 00:00 ke baad claim karein 📅",
"🆘 Har hafte PKR 100,000 tak rescue fund!",
"Rozana 3 random red packets — PKR 888,888 tak jeetne ka mauqa",
];

const SLIDES: Slide[] = [
  { bg: "bg-gradient-to-r from-[#04261f] via-[#0b5a4a] to-[#0a8f9e]", img: "/lobby/hero.jpg", kicker: "Welcome bonus", title: "Receive |PKR 1500| for free", sub: "Register now & claim your welcome reward instantly", href: "/signup", cta: "Register now" },
  { bg: "bg-gradient-to-r from-[#0a0f14] via-[#12252e] to-[#0e7490]", img: "/games/aviator.jpg", kicker: "Most played", title: "Aviator |up to 1000x|", sub: "Cash out before the plane flies away", href: "/games/aviator", cta: "Play now" },
  { bg: "bg-gradient-to-r from-[#3b0a0a] via-[#7a1f2b] to-[#c2410c]", img: "/games/dragon-tiger.jpg", kicker: "WG Cards live", title: "Dragon Tiger |Tie pays 8:1|", sub: "20-second live rounds · real cards", href: "/games/dragon-tiger", cta: "Join table" },
  { bg: "bg-gradient-to-r from-[#0b2a12] via-[#0f5132] to-[#059669]", img: "/lobby/jackpot.jpg", kicker: "Every deposit", title: "|7% bonus| on every deposit", sub: "Win up to PKR 60,000 — JazzCash & Easypaisa", href: "/promo", cta: "View promo" },
];

const CAT_ICONS: Record<string, ReactNode> = { Slot: <SlotIcon size={14} />, "Mini Games": <GamepadIcon size={14} />, Live: <HeadsetIcon size={14} />, Cards: <SpadeIcon size={14} />, Fishing: <FishIcon size={14} />, Sports: <CricketIcon size={14} />, Lottery: <TicketIcon size={14} /> };
const CATS: { key: string; label: string; icon: string; img: string; grad: string }[] = [
  { key: "Slot", label: "Slot", icon: "🎰", img: "/lobby/cats/slot.jpg", grad: "from-[#0e7490]" },
  { key: "Mini Games", label: "Mini Games", icon: "🎮", img: "/lobby/jackpot.jpg", grad: "from-[#059669]" },
  { key: "Live", label: "Live Casino", icon: "🎧", img: "/lobby/cats/live.jpg", grad: "from-[#dc2626]" },
  { key: "Cards", label: "Cards", icon: "🃏", img: "/games/andar-bahar.jpg", grad: "from-[#ea580c]" },
  { key: "Fishing", label: "Fishing", icon: "🐟", img: "/lobby/cats/fishing.jpg", grad: "from-[#0284c7]" },
  { key: "Sports", label: "Sports", icon: "🏏", img: "/lobby/cats/sports.jpg", grad: "from-[#16a34a]" },
  { key: "Lottery", label: "Lottery", icon: "🎱", img: "/lobby/cats/lottery.jpg", grad: "from-[#ca8a04]" },
];

const LEADERS: Row[] = [
  { rank: 4, name: "ab***112", amount: 12_450_900, up: true }, { rank: 5, name: "mk***778", amount: 9_874_210, up: false }, { rank: 6, name: "sa***301", amount: 8_120_400, up: true },
  { rank: 7, name: "us***905", amount: 7_655_180, up: true }, { rank: 8, name: "ha***217", amount: 6_940_022, up: false }, { rank: 9, name: "zi***640", amount: 6_102_750, up: true },
  { rank: 10, name: "fa***588", amount: 5_770_310, up: true }, { rank: 11, name: "im***432", amount: 5_412_960, up: false }, { rank: 12, name: "bi***019", amount: 5_201_115, up: true },
  { rank: 13, name: "no***873", amount: 5_004_388, up: false }, { rank: 14, name: "ta***256", amount: 4_950_170, up: true }, { rank: 15, name: "he***077", amount: 4_915_174, up: false },
  { rank: 16, name: "by***323", amount: 4_499_286, up: true }, { rank: 17, name: "gk***344", amount: 3_067_098, up: true }, { rank: 18, name: "yw***354", amount: 1_649_361, up: false },
];

export const CONTAINER = "mx-auto w-full max-w-[560px] md:max-w-[880px] lg:max-w-[1200px] xl:max-w-[1320px] 2xl:max-w-[1600px] min-[2200px]:max-w-[1900px]";

/* ---------------- pieces ---------------- */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const img = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-8 w-8 sm:h-10 sm:w-10";
  const txt = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-lg sm:text-xl";
  return (
    <Link href="/" className="flex items-center gap-2">
      <BrandLogo className={`${img} shrink-0 object-contain drop-shadow-[0_0_12px_rgba(255,184,0,.55)]`} />
      <span className={`${txt} font-black tracking-tight leading-none`}>
        <span className="text-gold-grad">Win</span><span className="text-white">X</span><span className="text-violet-grad">555</span>
      </span>
    </Link>
  );
}

export function Header({ viewer, active = "home" }: { viewer: Viewer; active?: "home" | "promo" | "games" }) {
  const { t } = useI18n();
  const dep = viewer.loggedIn ? "/client/wallet" : "/login";
  const prof = viewer.isAdmin ? "/admin" : viewer.loggedIn ? "/client" : "/login";
  const navCls = (k: string) => `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold transition lg:px-3.5 ${active === k ? "btn-violet" : "text-[#b8a7e6] hover:text-white"}`;
  return (
    <header className="sticky top-0 z-40 border-b border-[#3a2470]/70 bg-[#0b0716]/85 backdrop-blur-xl">
      <div className="wx-shine h-[2px] w-full" />
      <div className={`${CONTAINER} flex items-center justify-between gap-2 px-2 py-2 sm:gap-3 sm:px-3 lg:px-6`}>
        <div className="flex items-center gap-2">
          <span className="md:hidden"><Drawer loggedIn={viewer.loggedIn} isAdmin={viewer.isAdmin} /></span>
          <Logo />
        </div>
        <nav className="hidden items-center gap-0.5 md:flex lg:gap-1">
          <Link href="/" className={navCls("home")}>{t("home")}</Link>
          <Link href="/#games" className={navCls("games")}>{t("games")}</Link>
          <Link href="/promo" className={navCls("promo")}>{t("promo")}</Link>
          <Link href={dep} className="hidden rounded-full px-3 py-1.5 text-sm font-bold text-[#b8a7e6] hover:text-white lg:inline-flex">{t("deposit")}</Link>
          <Link href={viewer.loggedIn ? "/client/team" : "/signup"} className="hidden rounded-full px-3 py-1.5 text-sm font-bold text-[#b8a7e6] hover:text-white lg:inline-flex">{t("invite")}</Link>
          <Link href="/help" className="hidden rounded-full px-3 py-1.5 text-sm font-bold text-[#b8a7e6] hover:text-white lg:inline-flex">{t("help")}</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden md:inline-flex"><ThemeToggle /></span>
          <span className="hidden md:inline-flex"><LanguageSwitch /></span>
          <NotificationBell loggedIn={viewer.loggedIn} />
          <OpenSupportButton className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-[#c4b5fd] ring-1 ring-[#3a2470] hover:text-white"><HeadsetIcon size={16} /></OpenSupportButton>
          <div className="hidden items-center gap-2 md:flex">
            {viewer.loggedIn ? (
              <>
                {!viewer.isAdmin && <span className="hidden whitespace-nowrap rounded-full bg-black/40 px-3 py-1.5 text-xs font-black text-[#ffb800] ring-1 ring-[#ffb800]/40 lg:inline">Rs. {(viewer.balance ?? 0).toLocaleString()}</span>}
                <Link href={prof} className="btn-violet whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold lg:px-4 lg:text-sm">{viewer.isAdmin ? t("adminPanel") : t("myAccount")}</Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-outline whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold lg:px-4 lg:text-sm">{t("login")}</Link>
                <Link href="/signup" className="btn-gold whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black lg:px-4 lg:text-sm">{t("register")}</Link>
              </>
            )}
          </div>
          {/* mobile: compact auth/account button */}
          <span className="md:hidden">
            {viewer.loggedIn ? <Link href={prof} className="btn-violet flex h-8 w-8 items-center justify-center rounded-full" aria-label="Account"><UserIcon size={16} /></Link> : <Link href="/login" className="btn-gold whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-black">{t("login")}</Link>}
          </span>
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ icon, title, right }: { icon: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-base font-black text-white md:text-lg"><span className="on-image flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white">{icon === "🔥" ? <FlameIcon size={15} /> : icon}</span>{title}</div>
      {right}
    </div>
  );
}

export function GameCard({ slug, href }: { slug: string; href: string }) {
  const m = GAME_META[slug];
  return (
    <Link href={href} className="wx-hover group relative overflow-hidden rounded-2xl border border-[#3a2470] bg-[#1b1038]"><span className="on-image contents">
      <div className="relative aspect-[0.86]">
        <img src={m.img} alt={m.label} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0716] via-transparent to-transparent" />
        <span className={`absolute left-2 top-1.5 text-[10px] font-black uppercase drop-shadow ${PROVIDER_STYLE[m.provider]}`}>{m.provider}</span>
        {m.badge && <span className={`absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white shadow ${BADGE_STYLE[m.badge]}`}>{m.badge}</span>}
        <span className="btn-gold absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3.5 py-1 text-[10px] font-black opacity-0 transition group-hover:opacity-100"><PlayIcon size={10} /> PLAY</span>
      </div>
      </span>
      <div className="flex items-center justify-between bg-[#140c2a] px-2 py-1.5">
        <span className="truncate text-xs font-bold text-white">{m.label}</span>
        <span className="text-[#ffb800]"><CrownIcon size={12} /></span>
      </div>
    </Link>
  );
}

export function BottomNav({ viewer, active }: { viewer: Viewer; active: "home" | "promo" | "invite" | "deposit" | "profile" }) {
  const { t } = useI18n();
  const dep = viewer.loggedIn ? "/client/wallet" : "/login";
  const prof = viewer.isAdmin ? "/admin" : viewer.loggedIn ? "/client" : "/login";
  const item = (key: typeof active, href: string, icon: ReactNode, label: string) => (
    <Link href={href} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold min-[380px]:text-[11px] ${active === key ? "text-[#ffb800]" : "text-[#b8a7e6]"}`}>
      <span className="leading-none">{icon}</span><span className="w-full truncate text-center">{label}</span>
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="mx-auto flex w-full max-w-[560px] items-end border-t border-[#3a2470] bg-[#140c2a]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,.5)] backdrop-blur">
        {item("home", "/", <HomeIcon size={22} />, t("home"))}
        {item("promo", "/promo", <GiftIcon size={22} />, t("promo"))}
        <Link href={viewer.loggedIn ? "/client/team" : "/signup"} className="relative -top-4 flex min-w-0 flex-1 flex-col items-center text-[10px] font-semibold text-white min-[380px]:text-[11px]">
          <span className="btn-gold flex h-12 w-12 items-center justify-center rounded-full ring-4 ring-[#0b0716] min-[380px]:h-14 min-[380px]:w-14"><UsersIcon size={24} /></span>
          <span className="mt-0.5">{t("invite")}</span>
        </Link>
        {item("deposit", dep, <WalletIcon size={22} />, t("deposit"))}
        {item("profile", prof, <UserIcon size={22} />, t("profile"))}
      </div>
    </nav>
  );
}

/* ---------------- full lobby ---------------- */
export function Lobby({ viewer, cat, links = {} }: { viewer: Viewer; cat: string; links?: Links }) {
  const { t, locale } = useI18n();
  const wa = links.whatsapp || BRAND.whatsapp; const tg = links.telegram || BRAND.telegram;
  const slides: Slide[] = SLIDES.map((sl, i) => ({ ...sl, kicker: t(`b${i + 1}k` as "b1k"), title: t(`b${i + 1}t` as "b1t"), sub: t(`b${i + 1}s` as "b1s"), cta: [t("registerNow"), t("playNow"), t("joinTable"), t("viewPromo")][i] }));
  const tabLabel: Record<string, string> = { Hot: t("hotLabel"), Recent: t("recent"), Demo: t("demo"), Cards: t("cards"), "Mini Games": t("miniGames"), Live: t("live"), Slot: t("slot"), Fishing: t("fishing"), Sports: t("sports"), Lottery: t("lottery") };
  const catLabel: Record<string, string> = { Slot: t("slot"), "Mini Games": t("miniGames"), Live: t("liveCasino"), Cards: t("cards"), Fishing: t("fishing"), Sports: t("sports"), Lottery: t("lottery") };
  const gameHref = (slug: string) => (viewer.loggedIn && !viewer.isAdmin ? `/client/games/${slug}` : `/games/${slug}`);
  const tabs = ["Hot", "Recent", "Demo", "Cards", "Mini Games", "Live"];
  const activeTab = tabs.includes(cat) || CATS.some((c) => c.key === cat) ? cat : "Hot";
  const games = GAME_ORDER.filter((s) => activeTab === "Recent" || GAME_META[s].cat.includes(activeTab));
  const comingSoon = games.length === 0;

  return (
    <div className="wx-bg min-h-screen text-white">
      <Header viewer={viewer} active="home" />
      <main className={`${CONTAINER} space-y-3 px-2 pb-28 pt-3 md:space-y-5 md:px-4 md:pb-12 lg:px-6`}>
        <BannerCarousel slides={slides} />

        {/* marquee + auth */}
        <section className="wx-card space-y-3 rounded-2xl p-3 md:flex md:items-center md:gap-4 md:space-y-0 md:p-4">
          <div className="min-w-0 md:flex-1"><Marquee items={t("marquee")} /></div>
          {viewer.loggedIn ? (
            <div className="flex items-center justify-between rounded-xl bg-black/30 px-4 py-2.5 ring-1 ring-[#3a2470] md:shrink-0 md:gap-6">
              <div><div className="text-[11px] text-[#b8a7e6]">{t("welcome")}, {viewer.name}</div><div className="text-lg font-black text-[#ffb800]">{viewer.isAdmin ? "Admin" : `Rs. ${(viewer.balance ?? 0).toLocaleString()}`}</div></div>
              <div className="flex gap-2">
                {viewer.isAdmin ? <Link href="/admin" className="btn-violet rounded-full px-5 py-2 text-sm font-bold">{t("adminPanel")}</Link> : (
                  <>
                    <Link href="/client/wallet" className="btn-gold rounded-full px-4 py-2 text-sm font-black">{t("deposit")}</Link>
                    <Link href="/client/wallet" className="btn-outline rounded-full px-4 py-2 text-sm font-bold">{t("withdraw")}</Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:hidden">
              <Link href="/signup" className="btn-gold rounded-full py-3 text-center text-base font-black">{t("register")}</Link>
              <Link href="/login" className="btn-outline rounded-full py-3 text-center text-base font-bold">{t("login")}</Link>
            </div>
          )}
        </section>

        {/* live winners */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs font-bold text-[#b8a7e6]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#22c55e]" />{t("liveWins")}</div>
          <WinnersTicker />
        </section>

        {/* jackpot + categories */}
        <div className="space-y-3 md:grid md:grid-cols-12 md:gap-4 md:space-y-0">
          <Link href="/#games" className="on-image relative block overflow-hidden rounded-2xl border border-[#ffb800]/40 md:col-span-5 lg:col-span-4">
            <img src="/lobby/jackpot.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2e1065] via-[#2e1065]/80 to-transparent" />
            <div className="relative flex h-40 flex-col justify-center p-4 md:h-full md:min-h-[230px] lg:p-6">
              <span className="flex items-center gap-1.5 text-sm font-bold"><FlameIcon size={16} />{t("hotJackpot")}</span>
              <div className="text-gold-grad glow-gold mt-2 text-3xl font-black italic tracking-wide lg:text-4xl">{t("jackpot")}</div>
              <div className="mt-2 w-max rounded-lg border border-[#ffb800]/60 bg-black/60 px-3 py-1 text-lg font-black text-[#ffe9a3] lg:text-xl">PKR <JackpotCounter start={3_301_222_743} /></div>
            </div>
          </Link>
          <section className="grid grid-cols-2 gap-3 md:col-span-7 md:grid-cols-3 lg:col-span-8 lg:grid-cols-4">
            {CATS.map((c) => (
              <Link key={c.key} href={`/?cat=${encodeURIComponent(c.key)}#games`} scroll={false} className="on-image wx-hover group relative h-[96px] overflow-hidden rounded-2xl border border-[#3a2470] lg:h-[110px]">
                <img src={c.img} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <div className={`absolute inset-0 bg-gradient-to-r ${c.grad} via-[#0b0716]/40 to-transparent opacity-80`} />
                <span className="absolute bottom-2 left-2 flex items-center gap-1.5 text-sm font-black drop-shadow rtl:left-auto rtl:right-2"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white">{CAT_ICONS[c.key] ?? c.icon}</span>{catLabel[c.key] ?? c.label}</span>
              </Link>
            ))}
            <Link href="/#games" className="hidden h-[96px] items-center justify-center gap-2 rounded-2xl border border-dashed border-[#8b5cf6]/60 text-sm font-bold text-[#c4b5fd] hover:bg-[#8b5cf6]/10 md:flex lg:h-[110px]"><FlameIcon size={16} /> {t("allHotGames")}</Link>
          </section>
        </div>

        {/* games grid */}
        <section id="games" className="wx-card scroll-mt-16 space-y-3 rounded-2xl p-3 md:p-4">
          <SectionTitle icon="🔥" title={`${tabLabel[activeTab] ?? activeTab} ${t("games")}`} right={<Link href="/#games" className="text-xs font-bold text-[#c4b5fd]">{t("viewAll")} ›</Link>} />
          <GameTabs tabs={tabs} active={activeTab} labels={tabLabel} />
          {comingSoon ? (
            <div className="rounded-xl border border-dashed border-[#3a2470] p-8 text-center text-sm text-[#b8a7e6]">{t("comingSoon", { cat: tabLabel[activeTab] ?? activeTab })}</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
              {games.map((s) => <GameCard key={s} slug={s} href={gameHref(s)} />)}
            </div>
          )}
        </section>

        {/* why us */}
        <section className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 md:grid-cols-4 md:gap-3">
          {([[<ZapIcon key="z" size={20} />, t("instantDeposit"), t("instantDepositSub")], [<BanknoteIcon key="b" size={20} />, t("fastWithdraw"), t("fastWithdrawSub")], [<ShieldIcon key="s" size={20} />, t("secure"), t("secureSub")], [<HeadsetIcon key="h" size={20} />, t("liveSupport"), t("supportSub")]] as [ReactNode, string, string][]).map(([i, tt, d]) => (
            <div key={tt} className="wx-card flex items-center gap-3 rounded-2xl p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6]/30 to-[#d946ef]/30 text-[#c4b5fd]">{i}</span>
              <div><div className="text-sm font-black">{tt}</div><div className="text-[11px] text-[#b8a7e6]">{d}</div></div>
            </div>
          ))}
        </section>

        {/* leaderboard + app */}
        <div className="space-y-3 lg:grid lg:grid-cols-12 lg:gap-4 lg:space-y-0">
          <section className="wx-card rounded-2xl p-3 md:p-4 lg:col-span-7">
            <div className="on-image mx-auto flex w-max items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#8b5cf6] px-5 py-1 text-xs font-black uppercase tracking-wide text-white"><TrophyIcon size={14} />{t("topWinners").replace("🏆 ", "")}</div>
            <div className="mt-4 grid grid-cols-3 items-end gap-2 text-center">
              {[{ p: 2, n: "fs***429", a: 32_741_392, c: "from-slate-200 to-slate-500", h: "h-24" }, { p: 1, n: "gn***850", a: 34_093_974, c: "from-[#ffd45a] to-[#ff8a00]", h: "h-28" }, { p: 3, n: "pr***399", a: 19_749_864, c: "from-[#e8a86b] to-[#8a4a12]", h: "h-24" }].map((x) => (
                <div key={x.p} className={`flex ${x.h} flex-col items-center justify-end rounded-xl bg-gradient-to-b ${x.c} p-2 text-slate-950 shadow-lg`}>
                  <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 bg-white/30 text-base font-black">{x.p === 1 ? <CrownIcon size={18} /> : x.p}</span>
                  <span className="text-xs font-bold">{x.n}</span>
                  <span className="text-[11px] font-black">Rs. {x.a.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3"><LeaderboardTable rows={LEADERS} labels={[t("rank"), t("username"), t("winnings")]} /></div>
          </section>

          <section className="space-y-2 lg:col-span-5">
            <div className="flex items-center gap-2 px-1 text-sm font-bold"><DownloadIcon size={16} />{t("appDownload")}</div>
            <div className="on-image relative overflow-hidden rounded-2xl border border-[#3a2470] bg-gradient-to-br from-[#3b0764] via-[#1b1038] to-[#0b0716] p-4 lg:flex lg:h-[calc(100%-2rem)] lg:items-center">
              <div className="flex items-center gap-4 lg:w-full lg:gap-6">
                <div className="relative h-36 w-20 shrink-0 overflow-hidden rounded-[14px] border-4 border-[#241546] bg-black shadow-xl"><img src="/lobby/jackpot.jpg" alt="" className="h-full w-full object-cover" /></div>
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-black">{t("getApp")}</div>
                  <p className="text-[11px] text-[#b8a7e6]">{t("getAppSub")}</p>
                  <InstallApp androidUrl={links.androidUrl || undefined} iosUrl={links.iosUrl || undefined} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* footer */}
        <footer className="wx-card space-y-5 rounded-2xl p-4 text-center md:p-6">
          <div className="flex flex-col items-center gap-2">
            <Logo size="lg" />
            <p className="max-w-md text-xs text-[#b8a7e6]">{t("tagline")} — {BRAND.domain}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm md:mx-auto md:max-w-3xl md:gap-8">
            {([
              ["Casino", t("casino"), ["/mission", "/rebate", "/vip", "/invite", "/event", "/fund"], t("footerCasino")],
              ["Games", t("games"), ["Hot", "Cards", "Mini Games", "Slot", "Live", "Fishing", "Sports", "Lottery"].map((k) => `/?cat=${encodeURIComponent(k)}#games`), ["Hot", "Cards", "Mini Games", "Slot", "Live", "Fishing", "Sports", "Lottery"].map((k) => tabLabel[k] ?? k)],
              ["Support", t("support"), ["/support", "/help", "/feedback", "/terms", "/privacy", "/responsible-gaming"], [...t("footerSupport"), ...(locale === "ur" ? ["شرائط و ضوابط", "پرائیویسی پالیسی", "ذمہ دارانہ گیمنگ"] : ["Terms & Conditions", "Privacy Policy", "Responsible Gaming"])]],
            ] as [string, string, string[], string[]][]).map(([key, h, hrefs, labels]) => (
              <div key={key}>
                <div className="mb-2 font-bold text-[#c4b5fd]">{h}</div>
                <ul className="space-y-1.5">{hrefs.map((href, idx) => <li key={href}><Link href={href} className="text-[#b8a7e6] hover:text-white">{labels[idx]}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-6">
            <div className="border-t border-[#3a2470] pt-4"><Link href="/license" className="text-sm text-[#b8a7e6] hover:text-white">{t("licenseCompliance")}</Link><Link href="/license" className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#ff3b5c] bg-white text-sm font-black text-[#ff3b5c]">18+</Link></div>
            <div className="mt-5 border-t border-[#3a2470] pt-4 md:mt-0"><div className="text-sm text-[#b8a7e6]">{t("contactUs")}</div>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <a href={wa} target="_blank" rel="noreferrer" title="WhatsApp" className="keep-white flex h-11 w-11 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105"><WhatsAppIcon size={24} /></a>
                <a href={tg} target="_blank" rel="noreferrer" title="Telegram" className="keep-white flex h-11 w-11 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-lg transition hover:scale-105"><TelegramIcon size={24} /></a>
                <OpenSupportButton className="keep-white on-image flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white shadow-lg transition hover:scale-105"><HeadsetIcon size={22} /></OpenSupportButton>
                {links.facebook && <a href={links.facebook} target="_blank" rel="noreferrer" title="Facebook" className="keep-white flex h-11 w-11 items-center justify-center rounded-full bg-[#1877f2] text-white shadow-lg transition hover:scale-105"><FacebookIcon size={24} /></a>}
                {links.instagram && <a href={links.instagram} target="_blank" rel="noreferrer" title="Instagram" className="keep-white flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-lg transition hover:scale-105"><InstagramIcon size={22} /></a>}
                {links.youtube && <a href={links.youtube} target="_blank" rel="noreferrer" title="YouTube" className="keep-white flex h-11 w-11 items-center justify-center rounded-full bg-[#ff0000] text-white shadow-lg transition hover:scale-105"><YouTubeIcon size={24} /></a>}
              </div>
              {(links.whatsappChannel || links.telegramChannel) && (
                <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
                  {links.whatsappChannel && <a href={links.whatsappChannel} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25d366]/20 px-3 py-1 font-bold text-[#7ee2a0]"><WhatsAppIcon size={14} /> {t("whatsappChannel")}</a>}
                  {links.telegramChannel && <a href={links.telegramChannel} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#29a9ea]/20 px-3 py-1 font-bold text-[#8fd3ff]"><TelegramIcon size={14} /> {t("telegramChannel")}</a>}
                </div>
              )}
            </div>
          </div>
          <p className="pb-2 text-[11px] text-[#6f5fa3]">© {new Date().getFullYear()} {BRAND.name} · {BRAND.domain} · {t("playResponsibly")}</p>
        </footer>
      </main>
      <TopButton />
      <SupportWidget userName={viewer.name} />
      <PwaRegister />
      <BottomNav viewer={viewer} active="home" />
      {locale === "ur" && <span className="hidden" />}
    </div>
  );
}
