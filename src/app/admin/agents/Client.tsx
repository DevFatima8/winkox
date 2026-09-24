"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { Commission, User } from "@/models";
import { Card, StatCard, fmt, fmtDate } from "@/components/Shell";
import { getSettings } from "@/lib/platform";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

type RecentCommission = {
  _id: unknown;
  beneficiaryId: { name: string; role: string } | null;
  fromUserId: { name: string } | null;
  kind: string;
  pct: number;
  amount: number;
};

export default function AgentsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
    await dbConnect();
    const s = await getSettings();
    const [agents, refStats, commTotal, recent] = await Promise.all([
      User.find({ role: "agent" }).sort({ commissionEarned: -1 }).lean(),
      User.aggregate<{ _id: string; c: number; dep: number }>([{ $match: { referredBy: { $ne: null } } }, { $group: { _id: "$referredBy", c: { $sum: 1 }, dep: { $sum: "$totalDeposited" } } }]),
      Commission.aggregate<{ _id: string; s: number }>([{ $group: { _id: "$kind", s: { $sum: "$amount" } } }]),
      Commission.find().sort({ createdAt: -1 }).limit(40).populate<{ beneficiaryId: { name: string; role: string } | null; fromUserId: { name: string } | null }>([{ path: "beneficiaryId", select: "name role" }, { path: "fromUserId", select: "name" }]).lean<RecentCommission[]>(),
    ]);
    const rm = new Map(refStats.map((r) => [String(r._id), r]));
    const topRef = await User.find({ _id: { $in: refStats.map((r) => r._id) }, role: "client" }).sort({ commissionEarned: -1 }).limit(15).lean();
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-white">Agents & Referrals</h1><p className="text-sm text-[#b8a7e6]">Kisi bhi user ko <b>Users → Manage → Role: Agent</b> se agent promote karein. Har user ka apna referral link hota hai; commission rates Settings mein hain.</p></div>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-4">
          <StatCard label="Agents" value={agents.length} />
          <StatCard label="Deposit commission paid" value={fmt(commTotal.find((c) => c._id === "deposit")?.s ?? 0)} accent="text-emerald-300" />
          <StatCard label="Bet commission paid" value={fmt(commTotal.find((c) => c._id === "bet")?.s ?? 0)} accent="text-[#ffb800]" />
          <StatCard label="Rates" value={`${s.referral?.depositCommissionPct ?? 2}% / ${s.referral?.betCommissionPct ?? 1.5}%`} sub={`Agent deposit ${s.referral?.agentDepositCommissionPct ?? 8}%`} />
        </div>
        <Card title="Agent accounts (staff)">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#6f5fa3]"><tr><th className="pb-2">Agent</th><th className="pb-2">Phone</th><th className="pb-2">Referral code</th><th className="pb-2">Team</th><th className="pb-2">Team deposits</th><th className="pb-2">Commission %</th><th className="pb-2">Earned</th><th className="pb-2">Balance</th><th className="pb-2">Since</th></tr></thead>
              <tbody className="divide-y divide-[#3a2470]/50">
                {agents.map((a) => { const r = rm.get(String(a._id)); return <tr key={String(a._id)}><td className="py-2"><Link href={`/admin/users/${a._id}`} className="font-medium text-white hover:text-[#ffb800]">{a.name}</Link></td><td className="py-2 text-[#e9ddff]">{a.phone}</td><td className="py-2 font-mono text-[#ffb800]">{a.referralCode}</td><td className="py-2 text-white">{r?.c ?? 0}</td><td className="py-2 text-[#e9ddff]">{fmt(r?.dep ?? 0)}</td><td className="py-2 text-[#e9ddff]">{a.agentCommissionPct ?? s.referral?.agentDepositCommissionPct ?? 8}%</td><td className="py-2 font-bold text-emerald-300">{fmt(a.commissionEarned ?? 0)}</td><td className="py-2 text-white">{fmt(a.balance)}</td><td className="py-2 text-xs text-[#b8a7e6]">{fmtDate(a.createdAt)}</td></tr>; })}
                {agents.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-[#6f5fa3]">Abhi koi agent nahi. Users page se kisi user ko agent banayein.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <Card title="Top referrers (clients)">
            <ul className="divide-y divide-[#3a2470]/50 text-sm">
              {topRef.map((u) => { const r = rm.get(String(u._id)); return <li key={String(u._id)} className="flex items-center justify-between py-2"><Link href={`/admin/users/${u._id}`} className="text-white hover:text-[#ffb800]">{u.name} <span className="text-xs text-[#b8a7e6]">{u.referralCode}</span></Link><span className="text-xs text-[#b8a7e6]">{r?.c ?? 0} refs · earned <b className="text-emerald-300">{fmt(u.commissionEarned ?? 0)}</b></span></li>; })}
              {topRef.length === 0 && <li className="py-4 text-center text-[#6f5fa3]">—</li>}
            </ul>
          </Card>
          <Card title="Recent commissions">
            <ul className="divide-y divide-[#3a2470]/50 text-sm">
              {recent.map((c) => <li key={String(c._id)} className="flex items-center justify-between py-2"><span className="text-[#e9ddff]"><b className="text-white">{c.beneficiaryId?.name}</b> {c.beneficiaryId?.role === "agent" && <span className="rounded bg-[#d946ef]/20 px-1 text-[10px] text-[#f0abfc]">AGENT</span>} ← {c.fromUserId?.name} · {c.kind} {c.pct}%</span><span className="font-bold text-emerald-300">+{fmt(c.amount)}</span></li>)}
              {recent.length === 0 && <li className="py-4 text-center text-[#6f5fa3]">—</li>}
            </ul>
          </Card>
        </div>
      </div>
    );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
