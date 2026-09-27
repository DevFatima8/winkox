"use client";
import { GameView, GAME_SLUGS } from "@/components/GameView";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function GamePageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
    const { slug } = params ?? {};
    if (!GAME_SLUGS.includes(slug)) return NOT_FOUND;
    const response = await fetch(`/api/public/data?view=game&slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return NOT_FOUND;
    return <GameView slug={slug} backHref="/player" />;
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
