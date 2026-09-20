"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { Commission, Game, GameResult, Transaction, User, oid } from "@/models";
import { Card, ProviderBadge, StatCard, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { deleteUserAction, toggleUserActiveAction } from "@/lib/actions";
import { UserEditForm } from "@/components/admin/UserEditForm";
import { PaymentLockForm } from "@/components/admin/PaymentLockForm";
import { getSettings, vipInfo } from "@/lib/platform";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function UserDetailClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
    const { id } = params ?? {};
    const me = (await getCurrentUser())!;
    const canSee = me.level >= 2;
    await dbConnect();
    const u = await User.findById(id).lean();
    if (!u || isStaff(u.role)) return NOT_FOUND;
    const [games, tx, plays, team, comm, settings, referrer] = await Promise.all([
      Game.find().sort({ createdAt: 1 }).lean(),
      Transaction.find({ userId: u._id }).sort({ createdAt: -1 }).limit(50).lean(),
      GameResult.find({ userId: u._id }).sort({ createdAt: -1 }).limit(30).populate<{ gameId: { name: string; icon: string } | null }>("gameId", "name icon").lean(),
      User.find({ referredBy: u._id }).sort({ createdAt: -1 }).lean(),
      Commission.find({ beneficiaryId: u._id }).sort({ createdAt: -1 }).limit(30).populate<{ fromUserId: { name: string } | null }>("fromUserId", "name").lean(),
      getSettings(),
      u.referredBy ? User.findById(u.referredBy, "name phone role").lean() : null,
    ]);
    const { cur } = vipInfo(u.vipLevel ?? 0, settings.vipLevels);
    const betTotal = plays.reduce((s, p) => s + p.betAmount, 0), winTotal = plays.reduce((s, p) => s + p.winAmount, 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/users" className="text-xs text-[#b8a7e6] hover:text-white">← All users</Link>
            <h1 className="text-2xl font-bold text-white">{u.name} <span className="text-base font-normal text-[#b8a7e6]">@{u.username ?? "-"}</span></h1>
            <div className="text-sm text-[#b8a7e6]">{u.phone} · {u.email ?? "no email"} · Joined {fmtDate(u.createdAt)} · Last login {fmtDate(u.lastLoginAt)}</div>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={u.isActive ? "active" : "blocked"} />
            {canSee && <form action={toggleUserActiveAction.bind(null, id, !u.isActive)} className="flex items-center gap-2">{u.isActive && <input name="reason" required placeholder="Block reason" className="w-36 rounded-lg border border-[#3a2470] bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none" />}<button className={`rounded-lg px-3 py-1.5 text-xs font-bold ${u.isActive ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{u.isActive ? "Block account" : "Unblock"}</button></form>}
            {canSee && <form action={deleteUserAction.bind(null, id)}><button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Delete user</button></form>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-4">
          <StatCard label="Balance" value={fmt(u.balance)} accent="text-[#ffb800]" />
          <StatCard label="VIP Level" value={`${u.vipLevel ?? 0} ${cur?.name ?? ""}`} sub={`Daily withdraw limit Rs. ${(cur?.dailyWithdrawLimit ?? 0).toLocaleString()}`} />
          <StatCard label="Total Deposited" value={fmt(u.totalDeposited ?? 0)} accent="text-emerald-300" sub={`Withdrawn ${fmt(u.totalWithdrawn ?? 0)}`} />
          <StatCard label="Commission Earned" value={fmt(u.commissionEarned ?? 0)} sub={`${team.length} referrals · code ${u.referralCode ?? "-"}`} />
        </div>

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <Card title="Credentials & Settings">
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase text-[#6f5fa3]">Username</div><div className="font-mono text-white">{u.username ?? "-"}</div></div>
              <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase text-[#6f5fa3]">Phone</div><div className="font-mono text-white">{u.phone}</div></div>
              {canSee && <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase text-[#6f5fa3]">Password</div><div className="font-mono text-[#ffb800]">{u.passwordPlain ?? "••••••"}</div></div>}
              {canSee && <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase text-[#6f5fa3]">Withdraw PIN</div><div className="font-mono text-[#ffb800]">{u.withdrawPin ?? "not set"}</div></div>}
            </div>
            {referrer && <p className="mb-3 text-xs text-[#b8a7e6]">Referred by: <b className="text-white">{referrer.name}</b> ({referrer.phone}) {referrer.role === "agent" && <span className="rounded bg-[#d946ef]/20 px-1.5 text-[10px] font-black text-[#f0abfc]">AGENT</span>}</p>}
            {canSee ? (
              <UserEditForm
                user={{ id, name: u.name, username: u.username ?? "", email: u.email ?? "", role: u.role, passwordPlain: u.passwordPlain ?? "", withdrawPin: u.withdrawPin ?? "", agentCommissionPct: u.agentCommissionPct ?? null, blockedGames: u.blockedGames ?? [], balance: u.balance, paymentDepositLimit: u.paymentDepositLimit ?? 0 }}
                games={games.map((g) => ({ slug: g.slug, name: g.name, icon: g.icon ?? "" }))}
              />
            ) : (
              <p className="rounded-xl bg-black/30 p-3 text-xs text-[#b8a7e6]">Account changes (password, PIN, block, balance, game restrictions) sirf Super Admin kar sakta hai.{u.blockedGames?.length ? ` Restricted games: ${u.blockedGames.join(", ")}` : ""}</p>
            )}
            <PaymentLockForm userId={id} limit={u.paymentDepositLimit ?? 0} />
          </Card>

          <div className="space-y-6">
            <Card title={`Team / Referrals (${team.length})`}>
              {team.length === 0 ? <p className="text-sm text-[#6f5fa3]">Koi referral nahi.</p> : (
                <ul className="divide-y divide-[#3a2470]/50 text-sm">
                  {team.map((t) => <li key={String(t._id)} className="flex items-center justify-between py-2"><Link href={`/admin/users/${t._id}`} className="text-white hover:text-[#ffb800]">{t.name} <span className="text-xs text-[#b8a7e6]">{t.phone}</span></Link><span className="text-xs text-[#b8a7e6]">Deposited {fmt(t.totalDeposited ?? 0)}</span></li>)}
                </ul>
              )}
            </Card>
            <Card title="Commission history">
              {comm.length === 0 ? <p className="text-sm text-[#6f5fa3]">Abhi koi commission nahi.</p> : (
                <ul className="divide-y divide-[#3a2470]/50 text-sm">
                  {comm.map((c) => <li key={String(c._id)} className="flex items-center justify-between py-2"><span className="text-[#e9ddff]">{c.kind} · {c.fromUserId?.name ?? "-"} · {c.pct}% of {fmt(c.baseAmount)}</span><span className="font-bold text-emerald-300">+{fmt(c.amount)}</span></li>)}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <Card title="Deposits & Withdrawals">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-[#6f5fa3]"><tr><th className="pb-2">Type</th><th className="pb-2">Provider</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2">Date</th></tr></thead>
                <tbody className="divide-y divide-[#3a2470]/50">
                  {tx.map((t) => <tr key={String(t._id)}><td className={`py-2 font-bold uppercase ${t.type === "deposit" ? "text-emerald-300" : "text-red-300"}`}>{t.type}</td><td className="py-2"><ProviderBadge provider={t.provider} /></td><td className="py-2 text-white">{fmt(t.amount)}</td><td className="py-2"><StatusBadge status={t.status} /></td><td className="py-2 text-xs text-[#b8a7e6]">{fmtDate(t.createdAt)}</td></tr>)}
                  {tx.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-[#6f5fa3]">Koi transaction nahi.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title={`Game activity (last 30) — Bets ${fmt(betTotal)} · Wins ${fmt(winTotal)}`}>
            <ul className="divide-y divide-[#3a2470]/50 text-sm">
              {plays.map((p) => <li key={String(p._id)} className="flex items-center justify-between py-2"><span className="text-[#e9ddff]">{p.gameId?.icon} {p.gameId?.name} <span className="text-xs text-[#6f5fa3]">{p.resultData}</span></span><span className="flex items-center gap-2"><span className="text-[#b8a7e6]">Bet {fmt(p.betAmount)}</span><span className="text-emerald-300">Win {fmt(p.winAmount)}</span><StatusBadge status={p.outcome} /></span></li>)}
              {plays.length === 0 && <li className="py-4 text-center text-[#6f5fa3]">Koi game nahi kheli.</li>}
            </ul>
          </Card>
        </div>
      </div>
    );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
