"use client";
import { dbConnect } from "@/lib/mongo";
import { Game, GameResult, User } from "@/models";
import { Card } from "@/components/Shell";
import { toggleGameAction } from "@/lib/actions";
import { GAME_META } from "@/components/lobby/Lobby";
import { getCurrentUser } from "@/lib/auth";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function GamesAdminPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const me = (await getCurrentUser())!;
  await dbConnect();
  const [games, stats, blocked] = await Promise.all([
    Game.find().sort({ createdAt: 1 }).lean(),
    GameResult.aggregate<{ _id: string; c: number; bet: number; win: number }>([{ $group: { _id: "$gameId", c: { $sum: 1 }, bet: { $sum: "$betAmount" }, win: { $sum: "$winAmount" } } }]),
    User.aggregate<{ _id: string; c: number }>([{ $unwind: "$blockedGames" }, { $group: { _id: "$blockedGames", c: { $sum: 1 } } }]),
  ]);
  const sm = new Map(stats.map((s) => [String(s._id), s]));
  const bm = new Map(blocked.map((b) => [b._id, b.c]));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Games On / Off</h1>
        <p className="text-sm text-[#b8a7e6]">Game off karne par wo lobby se hat jati hai aur koi bet nahi lag sakti. Kisi ek user ko block karne ke liye Users → user → Game Restrictions.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => {
          const s = sm.get(String(g._id)); const meta = GAME_META[g.slug];
          return (
            <Card key={String(g._id)}>
              <div className="flex items-start gap-3">
                {meta ? <img src={meta.img} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/30 text-3xl">{g.icon}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-bold text-white">{g.name}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${g.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{g.isActive ? "ON" : "OFF"}</span>
                  </div>
                  <div className="text-xs text-[#b8a7e6]">{g.slug} · {g.category}</div>
                  <div className="mt-1 text-xs text-[#b8a7e6]">{s?.c ?? 0} rounds · Bets Rs. {(s?.bet ?? 0).toLocaleString()} · Payout Rs. {(s?.win ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-[#b8a7e6]">Profit: <b className={(s?.bet ?? 0) - (s?.win ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}>Rs. {((s?.bet ?? 0) - (s?.win ?? 0)).toLocaleString()}</b> · {bm.get(g.slug) ?? 0} users restricted</div>
                </div>
              </div>
              {me.level >= 2 && <form action={toggleGameAction.bind(null, String(g._id), !g.isActive)} className="mt-3">
                <button className={`w-full rounded-xl py-2 text-sm font-bold ${g.isActive ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "btn-gold"}`}>{g.isActive ? "Turn OFF" : "Turn ON"}</button>
              </form>}
            </Card>
          );
        })}
      </div>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
