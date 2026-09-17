"use client";
import { dbConnect } from "@/lib/mongo";
import { Game } from "@/models";
import { GameView, GAME_SLUGS } from "@/components/GameView";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function GamePageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const { slug } = params ?? {};
  await dbConnect();
  const g = await Game.findOne({ slug }).lean();
  if (!g || !GAME_SLUGS.includes(slug)) return NOT_FOUND;
  return <GameView slug={slug} backHref="/client" />;
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
