"use client";
import { Card, StatCard, fmt, fmtDate } from "@/components/Shell";
import { CopyLink } from "@/components/ProfileForms";
import { useI18n } from "@/lib/i18n/client";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function TeamPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  const { t } = useI18n();
  void params; void searchParams;
  return usePage(async () => {
    const response = await fetch("/api/player/team", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Team data load nahi ho saka.");
    const team = data.team as { _id: string; name: string; totalDeposited: number; createdAt: string }[];
    const commission = Number(data.commission ?? 0);
    const comm = data.commissions as { _id: string; kind: string; fromUserId: { name: string } | null; pct: number; createdAt: string; amount: number }[];
    const referralCode = data.referralCode as string | null;
    const depositCommissionPct = Number(data.depositCommissionPct ?? 1.5);
    const link = `${typeof window !== "undefined" ? window.location.origin : "https://winkox.shop"}/signup?ref=${referralCode ?? ""}`;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-white">My Team</h1>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-3">
          <StatCard label="Team members" value={team.length} />
          <StatCard label="Team deposits" value={fmt(team.reduce((s, t) => s + (t.totalDeposited ?? 0), 0))} accent="text-emerald-300" />
          <StatCard label="My commission" value={fmt(commission)} accent="text-[#ffb800]" />
        </div>
        <Card title={t("inviteEarn")}>
          <p className="mb-2 text-sm text-[#b8a7e6]">{t("inviteText", { d: depositCommissionPct })} <b className="font-mono text-white">{referralCode}</b></p>
          <CopyLink link={link} />
        </Card>
        <Card title="Members">
          <ul className="divide-y divide-[#3a2470]/50 text-sm">
            {team.map((t) => <li key={String(t._id)} className="flex items-center justify-between py-2"><span className="text-white">{t.name.slice(0, 2)}***{t.name.slice(-1)} <span className="text-xs text-[#b8a7e6]">joined {fmtDate(t.createdAt)}</span></span><span className="text-xs text-[#b8a7e6]">Deposited {fmt(t.totalDeposited ?? 0)}</span></li>)}
            {team.length === 0 && <li className="py-6 text-center text-[#6f5fa3]">Abhi koi member nahi — Profile se apna link share karein.</li>}
          </ul>
        </Card>
        <Card title="Commission history">
          <ul className="divide-y divide-[#3a2470]/50 text-sm">
            {comm.map((c) => <li key={String(c._id)} className="flex items-center justify-between py-2"><span className="text-[#e9ddff]">{c.kind === "deposit" ? "Deposit" : c.kind === "bet" ? "Bet" : c.kind === "referral" ? "Referral bonus" : "Signup"} · {c.fromUserId?.name ?? "-"} · {c.pct}% <span className="text-xs text-[#6f5fa3]">{fmtDate(c.createdAt)}</span></span><span className="font-bold text-emerald-300">+{fmt(c.amount)}</span></li>)}
            {comm.length === 0 && <li className="py-6 text-center text-[#6f5fa3]">Abhi koi commission nahi.</li>}
          </ul>
        </Card>
      </div>
    );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
