"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { Game } from "@/models";
import { ensureGames } from "@/lib/seed";
import { Hi, useI18n } from "@/lib/i18n/client";
import { GAME_META } from "@/components/lobby/Lobby";
import { PlayIcon, ZapIcon } from "@/components/Icons";
import { gatewayConfig } from "@/lib/gateway";
import { getCurrentUser } from "@/lib/auth";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function GamesPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  const { t, locale } = useI18n();
  void locale;
  void params; void searchParams;
  return usePage(async () => {

  await dbConnect();
  await ensureGames();
  const [gw, me] = await Promise.all([gatewayConfig(), getCurrentUser()]);
  const list = await Game.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  const cards = list.filter((g) => g.category === "wg-cards");
  const originals = list.filter((g) => g.category !== "wg-cards");
  return (
    <div className="space-y-6">
      <div className="on-image relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#3b0764] via-[#6d28d9] to-[#c026d3] p-6 text-white shadow-[0_10px_40px_rgba(139,92,246,.4)]">
        <img src="/lobby/jackpot.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover object-left opacity-60 [mask-image:linear-gradient(90deg,transparent,black_40%)]" />
        <h1 className="relative text-3xl font-black"><Hi s={t("playAndEarn")} /></h1>
        <p className="relative mt-1 font-medium text-[#e9ddff]">{t("pickGame")}</p>
      </div>
      {gw.enabled && (me?.balance ?? 0) < 100 && (
        <Link href="/client/wallet" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffb800]/50 bg-[#ffb800]/10 p-4 text-sm">
          <span className="flex items-center gap-2 text-[#ffe0a3]"><ZapIcon size={18} /> <b className="text-white">Balance kam hai.</b> Test gateway se instant balance add karein aur games khelein (koi asli paisa nahi).</span>
          <span className="btn-gold rounded-full px-4 py-1.5 text-xs font-black">Add test balance →</span>
        </Link>
      )}
      {list.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">{t("gamesSoon")}</div>}
      {originals.length > 0 && <Section title={t("originalGames")} games={originals} playLabel={t("playNow")} />}
      {cards.length > 0 && (
        <Section
          title={<span className="flex items-center gap-2"><span className="btn-gold rounded-md px-2 py-0.5 text-xs font-black">WG</span> {t("wgLive")}</span>}
          games={cards}
          accent
          playLabel={t("live")}
        />
      )}
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}

function Section({ title, games, accent, playLabel }: { title: React.ReactNode; games: { _id: unknown; slug: string; icon?: string | null; name: string; description?: string | null }[]; accent?: boolean; playLabel: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((g) => (
          <Link key={String(g._id)} href={`/client/games/${g.slug}`} className="group overflow-hidden rounded-2xl border transition hover:-translate-y-1 wx-card wx-hover">
            <div className="on-image relative aspect-[1.25]">
              {GAME_META[g.slug] ? <img src={GAME_META[g.slug].img} alt={g.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center bg-black/40 text-4xl">{g.icon}</div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {GAME_META[g.slug]?.provider && <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{GAME_META[g.slug].provider}</span>}
              {accent && <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>}
            </div>
            <div className="p-3">
              <div className="text-base font-bold text-white">{g.name}</div>
              <div className="line-clamp-2 text-xs text-slate-400">{g.description}</div>
              <div className="btn-gold mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-black"><PlayIcon size={10} />{playLabel}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
