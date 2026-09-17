"use client";
import { dbConnect } from "@/lib/mongo";
import { GameResult, Transaction, oid } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { Card, ProviderBadge, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function HistoryPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const me = (await getCurrentUser())!;
  await dbConnect();
  const [tx, plays] = await Promise.all([
    Transaction.find({ userId: oid(me.id) }).sort({ createdAt: -1 }).limit(100).lean(),
    GameResult.find({ userId: oid(me.id) }).sort({ createdAt: -1 }).limit(100).populate<{ gameId: { name: string; icon: string } | null }>("gameId", "name icon").lean(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">My History</h1>
      <Card title="Deposits & Withdrawals">
        <ul className="divide-y divide-slate-800 text-sm">
          {tx.map((t) => (
            <li key={String(t._id)} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <span className={`font-bold uppercase ${t.type === "deposit" ? "text-emerald-400" : "text-red-400"}`}>{t.type}</span>
                <ProviderBadge provider={t.provider} />
                <span className="text-xs text-slate-500">{fmtDate(t.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">{fmt(t.amount)}</span>
                <StatusBadge status={t.status} />{t.method === "gateway" && <span className="rounded bg-[#ffb800]/20 px-1.5 py-0.5 text-[9px] font-black text-[#ffb800]">TEST</span>}
              </div>
            </li>
          ))}
          {tx.length === 0 && <li className="py-6 text-center text-slate-500">Abhi koi transaction nahi.</li>}
        </ul>
      </Card>
      <Card title="Game History">
        <ul className="divide-y divide-slate-800 text-sm">
          {plays.map((p) => (
            <li key={String(p._id)} className="flex items-center justify-between py-2.5">
              <div><span className="mr-2">{p.gameId?.icon}</span><span className="font-medium text-white">{p.gameId?.name}</span><span className="ml-2 text-xs text-slate-500">#{p.roundNo} · {fmtDate(p.createdAt)}</span></div>
              <div className="flex items-center gap-3"><span className="text-slate-400">Bet {fmt(p.betAmount)}</span><span className="text-emerald-400">Win {fmt(p.winAmount)}</span><StatusBadge status={p.outcome} /></div>
            </li>
          ))}
          {plays.length === 0 && <li className="py-6 text-center text-slate-500">Abhi koi game nahi kheli.</li>}
        </ul>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
