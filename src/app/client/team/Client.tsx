"use client";
import { dbConnect } from "@/lib/mongo";
import { Commission, User, oid } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { Card, StatCard, fmt, fmtDate } from "@/components/Shell";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function TeamPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const me = (await getCurrentUser())!;
  await dbConnect();
  const [team, comm] = await Promise.all([
    User.find({ referredBy: oid(me.id) }).sort({ createdAt: -1 }).lean(),
    Commission.find({ beneficiaryId: oid(me.id) }).sort({ createdAt: -1 }).limit(100).populate<{ fromUserId: { name: string } | null }>("fromUserId", "name").lean(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">My Team</h1>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-3">
        <StatCard label="Team members" value={team.length} />
        <StatCard label="Team deposits" value={fmt(team.reduce((s, t) => s + (t.totalDeposited ?? 0), 0))} accent="text-emerald-300" />
        <StatCard label="My commission" value={fmt(me.commissionEarned)} accent="text-[#ffb800]" />
      </div>
      <Card title="Members">
        <ul className="divide-y divide-[#3a2470]/50 text-sm">
          {team.map((t) => <li key={String(t._id)} className="flex items-center justify-between py-2"><span className="text-white">{t.name.slice(0, 2)}***{t.name.slice(-1)} <span className="text-xs text-[#b8a7e6]">joined {fmtDate(t.createdAt)}</span></span><span className="text-xs text-[#b8a7e6]">Deposited {fmt(t.totalDeposited ?? 0)}</span></li>)}
          {team.length === 0 && <li className="py-6 text-center text-[#6f5fa3]">Abhi koi member nahi — Profile se apna link share karein.</li>}
        </ul>
      </Card>
      <Card title="Commission history">
        <ul className="divide-y divide-[#3a2470]/50 text-sm">
          {comm.map((c) => <li key={String(c._id)} className="flex items-center justify-between py-2"><span className="text-[#e9ddff]">{c.kind === "deposit" ? "Deposit" : c.kind === "bet" ? "Bet" : "Signup"} · {c.fromUserId?.name ?? "-"} · {c.pct}% <span className="text-xs text-[#6f5fa3]">{fmtDate(c.createdAt)}</span></span><span className="font-bold text-emerald-300">+{fmt(c.amount)}</span></li>)}
          {comm.length === 0 && <li className="py-6 text-center text-[#6f5fa3]">Abhi koi commission nahi.</li>}
        </ul>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
