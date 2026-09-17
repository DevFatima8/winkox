"use client";
import { getCurrentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongo";
import { User } from "@/models";
import { Card } from "@/components/Shell";
import { VipForm } from "@/components/admin/Forms";
import { getSettings } from "@/lib/platform";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function VipPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const _me = await getCurrentUser();
  if (!_me || _me.level < 2) return REDIRECT("/admin");
  await dbConnect();
  const s = await getSettings();
  const dist = await User.aggregate<{ _id: number; c: number }>([{ $match: { role: { $nin: ["owner", "admin", "subadmin"] } } }, { $group: { _id: "$vipLevel", c: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  const levels = [...s.vipLevels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0)).map((l) => ({ level: l.level ?? 0, name: l.name ?? "", minDeposit: l.minDeposit ?? 0, dailyWithdrawLimit: l.dailyWithdrawLimit ?? 0, perWithdrawMax: l.perWithdrawMax ?? 0, minWithdraw: l.minWithdraw ?? 500 }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">VIP Levels</h1>
        <p className="text-sm text-[#b8a7e6]">User ki <b>total approved deposits</b> ke hisaab se level automatic milti hai. Har level ki withdrawal limit yahan set karein. Save karne par sab users ki levels dobara calculate hoti hain.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {levels.map((l) => <span key={l.level} className="rounded-full bg-black/30 px-3 py-1 text-xs text-[#e9ddff] ring-1 ring-[#3a2470]">{l.level} {l.name}: <b className="text-[#ffb800]">{dist.find((d) => d._id === l.level)?.c ?? 0}</b> users</span>)}
      </div>
      <Card title="Level configuration"><VipForm levels={levels} /></Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
