"use client";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { GameView, GAME_SLUGS } from "@/components/GameView";
import { Header, BottomNav, CONTAINER } from "@/components/lobby/Lobby";
import { SupportWidget } from "@/components/SupportWidget";
import { Hi, useI18n } from "@/lib/i18n/client";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function PublicGamePageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  const { t, locale } = useI18n();
  void locale;
  void params; void searchParams;
  return usePage(async () => {
  const { slug } = params ?? {};
  if (!GAME_SLUGS.includes(slug)) return NOT_FOUND;
  const s = await getSession();
  if (s?.role === "client") return REDIRECT(`/client/games/${slug}`);

  const viewer = { loggedIn: !!s, isAdmin: s?.role === "admin", name: s?.name };
  return (
    <div className="wx-bg min-h-screen text-white">
      <Header viewer={viewer} active="games" />
      <div className={`${CONTAINER} px-3 pb-28 pt-3 md:px-4 md:pb-10 lg:px-6`}>
        {!viewer.loggedIn && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ffb800]/40 bg-[#ffb800]/10 px-3 py-2 text-xs text-[#ffe0a3] sm:text-sm">
          <span><Hi s={t("demoBar")} cls="font-black text-white" /></span>
          <div className="flex gap-2">
            <Link href="/login" className="btn-outline rounded-md px-2.5 py-1 font-bold">{t("login")}</Link>
            <Link href="/signup" className="btn-gold rounded-md px-2.5 py-1 font-black">{t("register")}</Link>
          </div>
        </div>}
        <GameView slug={slug} backHref="/" />
      </div>
      <SupportWidget />
      <BottomNav viewer={viewer} active="home" />
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
