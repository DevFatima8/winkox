"use client";
import Link from "next/link";
import { GAME_META, GAME_ORDER } from "@/components/lobby/Lobby";
import { Header, BottomNav } from "@/components/lobby/Lobby";
import { useSession } from "@/lib/useDb";
import { useI18n } from "@/lib/i18n/client";
import { ArrowLeftIcon, TrophyIcon } from "@/components/Icons";

export default function AllGames() {
  const { user } = useSession();
  const { t } = useI18n();
  return (
    <div className="wx-bg min-h-[100dvh] text-white">
      <Header viewer={{ loggedIn: !!user, isAdmin: user?.role === "admin", name: user?.name, balance: user?.balance }} />
      <main className={`${"mx-auto w-full max-w-[560px] md:max-w-[880px] lg:max-w-[1200px] xl:max-w-[1320px] 2xl:max-w-[1600px] min-[2200px]:max-w-[1900px]"} px-2 pb-28 pt-4 sm:px-4 md:px-4 lg:px-6`}>
        <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 text-sm font-bold text-[#c4b5fd] ring-1 ring-[#3a2470] hover:bg-black/40"><ArrowLeftIcon size={16} /> {t("home")}</Link>
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white shadow-lg shadow-fuchsia-500/30"><TrophyIcon size={26} /></span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">All Hot Games</h1>
            <p className="text-sm text-slate-400">{GAME_ORDER.length} games · {t("hotGames")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {GAME_ORDER.map((slug) => {
            const m = GAME_META[slug];
            return (
              <Link key={slug} href={`/games/${slug}`} className="wx-hover group relative overflow-hidden rounded-2xl border border-[#232d5a] bg-[#112350]">
                <div className="relative aspect-[1.25]">
                  <img src={m.img} alt={m.label} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent" />
                  {m.badge && <span className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black shadow md:px-2 md:text-[10px]" style={{ background: m.badge === "HOT" || m.badge === "NEW" ? "#ffb800" : "#0ea5e9", color: "#1a0d00" }}>{m.badge}</span>}
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-black md:text-[10px]"><span className="text-[#ffb800]">{m.provider}</span></span>
                </div>
                <div className="flex items-center justify-between gap-1 bg-black/40 px-2 py-1.5">
                  <span className="truncate text-[11px] font-bold text-white md:text-xs">{m.label}</span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] opacity-0 transition group-hover:opacity-100">▶</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <BottomNav viewer={{ loggedIn: !!user, isAdmin: user?.role === "admin" }} active="home" />
    </div>
  );
}
