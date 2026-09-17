"use client";
import { dbConnect } from "@/lib/mongo";
import { Game, GameResult } from "@/models";
import { Card, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function ResultsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  await dbConnect();
  const [rows, gameList] = await Promise.all([
    GameResult.find().sort({ createdAt: -1 }).limit(500)
      .populate<{ gameId: { name: string; icon: string } | null }>("gameId", "name icon")
      .populate<{ userId: { name: string; phone: string } | null }>("userId", "name phone").lean(),
    Game.find().lean(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Game Results</h1>
      <div className="flex flex-wrap gap-2">
        {gameList.map((g) => <span key={String(g._id)} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300">{g.icon} {g.name}</span>)}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="pb-2">Game</th><th className="pb-2">Player</th><th className="pb-2">Round</th><th className="pb-2">Bet</th><th className="pb-2">Win</th><th className="pb-2">Outcome</th><th className="pb-2">Details</th><th className="pb-2">Time</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={String(r._id)}>
                  <td className="py-2.5 font-medium text-white">{r.gameId?.icon} {r.gameId?.name}</td>
                  <td className="py-2.5 text-slate-300">{r.userId?.name ?? "—"}<div className="text-xs text-slate-500">{r.userId?.phone}</div></td>
                  <td className="py-2.5 text-slate-400">#{r.roundNo ?? "-"}</td>
                  <td className="py-2.5 text-slate-200">{fmt(r.betAmount)}</td>
                  <td className="py-2.5 text-emerald-400">{fmt(r.winAmount)}</td>
                  <td className="py-2.5"><StatusBadge status={r.outcome} /></td>
                  <td className="py-2.5 text-xs text-slate-400">{r.resultData ?? "-"}</td>
                  <td className="py-2.5 text-slate-400">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500">Abhi koi result nahi. Jaise hi clients khelenge, har round ka result yahan show hoga.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
