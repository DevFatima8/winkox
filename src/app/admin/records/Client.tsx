"use client";
import { dbConnect } from "@/lib/mongo";
import { Transaction } from "@/models";
import { Card, StatCard, fmt } from "@/components/Shell";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function RecordsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  await dbConnect();
  const agg = await Transaction.aggregate<{ _id: { type: string; status: string }; c: number; s: number }>([{ $group: { _id: { type: "$type", status: "$status" }, c: { $sum: 1 }, s: { $sum: "$amount" } } }]);
  const get = (t: string, st: string) => agg.find((a) => a._id.type === t && a._id.status === st) ?? { c: 0, s: 0 };
  const daily = await Transaction.aggregate<{ _id: { d: string; type: string }; s: number; c: number }>([
    { $match: { status: "approved" } },
    { $group: { _id: { d: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:00" } }, type: "$type" }, s: { $sum: "$amount" }, c: { $sum: 1 } } },
    { $sort: { "_id.d": -1 } }, { $limit: 60 },
  ]);
  const days = Array.from(new Set(daily.map((d) => d._id.d)));
  const byProvider = await Transaction.aggregate<{ _id: { p: string; type: string }; s: number; c: number }>([{ $match: { status: "approved" } }, { $group: { _id: { p: "$provider", type: "$type" }, s: { $sum: "$amount" }, c: { $sum: 1 } } }]);
  const topDep = await Transaction.aggregate<{ _id: string; s: number; c: number; user: { name: string; phone: string }[] }>([
    { $match: { status: "approved", type: "deposit" } }, { $group: { _id: "$userId", s: { $sum: "$amount" }, c: { $sum: 1 } } }, { $sort: { s: -1 } }, { $limit: 10 },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
  ]);
  const depA = get("deposit", "approved"), wdA = get("withdraw", "approved");
  const gwAgg = await Transaction.aggregate<{ _id: string; s: number; c: number }>([{ $match: { method: "gateway", status: "approved" } }, { $group: { _id: "$type", s: { $sum: "$amount" }, c: { $sum: 1 } } }]);
  const gwDep = gwAgg.find((g) => g._id === "deposit"), gwWd = gwAgg.find((g) => g._id === "withdraw");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Deposit & Withdrawal Records</h1>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-4">
        <StatCard label="Total Deposits (approved)" value={fmt(depA.s)} sub={`${depA.c} transactions`} accent="text-emerald-300" />
        <StatCard label="Total Withdrawals (approved)" value={fmt(wdA.s)} sub={`${wdA.c} transactions`} accent="text-red-300" />
        <StatCard label="Net (Dep − Wd)" value={fmt(depA.s - wdA.s)} accent="text-[#ffb800]" />
        <StatCard label="Pending" value={`${get("deposit", "pending").c} dep · ${get("withdraw", "pending").c} wd`} sub={`Rs. ${(get("deposit", "pending").s + get("withdraw", "pending").s).toLocaleString()} pending`} />
        <StatCard label="Rejected deposits" value={fmt(get("deposit", "rejected").s)} sub={`${get("deposit", "rejected").c} txns`} />
        <StatCard label="Rejected withdrawals" value={fmt(get("withdraw", "rejected").s)} sub={`${get("withdraw", "rejected").c} txns`} />
        {byProvider.filter((p) => p._id.type === "deposit").map((p) => <StatCard key={p._id.p} label={`Deposits via ${p._id.p}`} value={fmt(p.s)} sub={`${p.c} txns`} />)}
        <StatCard label="Test gateway volume (fake)" value={`${fmt(gwDep?.s ?? 0)} in`} sub={`${gwDep?.c ?? 0} test deposits · ${fmt(gwWd?.s ?? 0)} out (${gwWd?.c ?? 0})`} accent="text-[#ffb800]" />
        <StatCard label="Real deposits (excl. test)" value={fmt(depA.s - (gwDep?.s ?? 0))} sub={`Real withdrawals ${fmt(wdA.s - (gwWd?.s ?? 0))}`} accent="text-emerald-300" />
      </div>
      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Card title="Daily summary (PKT)">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#6f5fa3]"><tr><th className="pb-2">Date</th><th className="pb-2">Deposits</th><th className="pb-2">Withdrawals</th><th className="pb-2">Net</th></tr></thead>
              <tbody className="divide-y divide-[#3a2470]/50">
                {days.map((d) => { const dep = daily.find((x) => x._id.d === d && x._id.type === "deposit"); const wd = daily.find((x) => x._id.d === d && x._id.type === "withdraw"); const net = (dep?.s ?? 0) - (wd?.s ?? 0); return <tr key={d}><td className="py-2 text-white">{d}</td><td className="py-2 text-emerald-300">{fmt(dep?.s ?? 0)} <span className="text-xs text-[#6f5fa3]">({dep?.c ?? 0})</span></td><td className="py-2 text-red-300">{fmt(wd?.s ?? 0)} <span className="text-xs text-[#6f5fa3]">({wd?.c ?? 0})</span></td><td className={`py-2 font-bold ${net >= 0 ? "text-[#ffb800]" : "text-red-300"}`}>{fmt(net)}</td></tr>; })}
                {days.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-[#6f5fa3]">Abhi koi approved transaction nahi.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Top depositors">
          <ul className="divide-y divide-[#3a2470]/50 text-sm">
            {topDep.map((t, i) => <li key={String(t._id)} className="flex items-center justify-between py-2"><span className="text-white">#{i + 1} {t.user[0]?.name ?? "-"} <span className="text-xs text-[#b8a7e6]">{t.user[0]?.phone}</span></span><span className="font-bold text-emerald-300">{fmt(t.s)} <span className="text-xs font-normal text-[#6f5fa3]">({t.c})</span></span></li>)}
            {topDep.length === 0 && <li className="py-4 text-center text-[#6f5fa3]">—</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
