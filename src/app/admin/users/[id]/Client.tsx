"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { Commission, Game, GameResult, Transaction, User } from "@/models";
import { Card, ProviderBadge, StatCard, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { deleteUserAction, toggleUserActiveAction } from "@/lib/actions";
import { UserEditForm } from "@/components/admin/UserEditForm";
import { BalanceAdjustForm } from "@/components/admin/BalanceAdjustForm";
import { PaymentLockForm } from "@/components/admin/PaymentLockForm";
import { getSettings, vipInfo } from "@/lib/platform";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { usePage, NOT_FOUND } from "@/lib/useDb";

export default function UserDetailClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
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
        const deposits = tx.filter((t) => t.type === "deposit");
        const withdrawals = tx.filter((t) => t.type === "withdraw");
        const bets = plays.reduce((sum, p) => sum + p.betAmount, 0);
        const wins = plays.reduce((sum, p) => sum + p.winAmount, 0);
        const limit = u.paymentDepositLimit ?? 0;
        const pending = deposits.filter((t) => t.status === "pending").reduce((sum, t) => sum + t.amount, 0);

        return <div className="space-y-6">
            <Header id={id} user={u} canSee={canSee} />
            <nav className="flex gap-2 overflow-x-auto rounded-xl border border-[#3a2470] bg-black/20 p-2 text-xs font-semibold">
                {["Basic Info", "Info Edit", "Control Switches", "Member Payout Info", "Recharge Records", "Payout Records", "Downline Summary", "Game Details", "Promotion Records"].map((label) => <a key={label} href={`#${label.toLowerCase().replaceAll(" ", "-")}`} className="whitespace-nowrap rounded-lg border border-[#3a2470] px-3 py-2 text-[#b8a7e6] hover:border-[#00e5a0] hover:text-white">{label}</a>)}
            </nav>

            <section id="basic-info" className="space-y-3">
                <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-5">
                    <StatCard label="Balance / Max Withdraw" value={fmt(u.balance)} accent="text-[#ffb800]" sub={`Max ${fmt(cur?.perWithdrawMax ?? cur?.dailyWithdrawLimit ?? 0)}`} />
                    <StatCard label="Locked Balance" value={limit ? fmt(limit) : "Unlocked"} accent={limit ? "text-amber-300" : "text-emerald-300"} sub={limit ? `Pending room ${fmt(Math.max(0, limit - (u.totalDeposited ?? 0) - pending))}` : "Payment lock off"} />
                    <StatCard label="Total Recharge Amount" value={fmt(u.totalDeposited ?? 0)} accent="text-emerald-300" sub={`${deposits.length} recharge records`} />
                    <StatCard label="Pending Recharge" value={fmt(pending)} accent="text-orange-300" sub="Awaiting approval" />
                    <StatCard label="Game Turnover" value={fmt(bets)} accent="text-cyan-300" sub={`Wins ${fmt(wins)}`} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <section id="control-switches"><Card title="Account Status"><InfoGrid items={[["Operation", u.isActive ? "Available" : "Blocked"], ["Games", u.blockedGames?.length ? `${u.blockedGames.length} restricted` : "Available"], ["Payout", u.withdrawPin ? "PIN enabled" : "PIN not set"], ["Payment lock", limit ? fmt(limit) : "Off"]]} /></Card></section>
                    <section id="downline"><Card title="Ownership & Referral"><InfoGrid items={[["Member level", u.role], ["VIP", `${u.vipLevel ?? 0} ${cur?.name ?? ""}`], ["Register source", referrer ? referrer.name : "Direct"], ["Downline", `${team.length} members`]]} /></Card></section>
                    <Card title="Identity & Contact"><InfoGrid items={[["Real name", u.name], ["Phone", u.phone], ["Email", u.email ?? "-"], ["Username", u.username ?? "-"]]} /></Card>
                </div>
            </section>

            <section id="info-edit" className="grid gap-4 md:grid-cols-2">
                <Card title="Credentials & Settings">
                    <InfoGrid items={[["Username", u.username ?? "-"], ["Phone", u.phone], ["Password", canSee ? (u.passwordPlain ?? "••••••") : "Hidden"], ["Withdraw PIN", canSee ? (u.withdrawPin ?? "Not set") : "Hidden"]]} />
                    {canSee ? <UserEditForm user={{ id, name: u.name, username: u.username ?? "", email: u.email ?? "", role: u.role, passwordPlain: u.passwordPlain ?? "", withdrawPin: u.withdrawPin ?? "", agentCommissionPct: u.agentCommissionPct ?? null, blockedGames: u.blockedGames ?? [], balance: u.balance, paymentDepositLimit: limit }} games={games.map((g) => ({ slug: g.slug, name: g.name, icon: g.icon ?? "" }))} /> : <p className="mt-3 rounded-xl bg-black/30 p-3 text-xs text-[#b8a7e6]">Account changes sirf Super Admin kar sakta hai.</p>}
                    {canSee && <div className="mt-5 border-t border-[#3a2470]/60 pt-5"><h3 className="mb-2 text-sm font-bold text-white">Manual wallet balance</h3><p className="mb-3 text-xs text-[#b8a7e6]">Sirf Super Admin user ko amount de ya uske balance se amount remove kar sakta hai.</p><BalanceAdjustForm userId={id} balance={u.balance} /></div>}
                    <PaymentLockForm userId={id} limit={limit} />
                </Card>
                <div className="space-y-6"><Card title={`Team / Referrals (${team.length})`}>{team.length ? <ul className="divide-y divide-[#3a2470]/50 text-sm">{team.map((t) => <li key={String(t._id)} className="flex justify-between py-2"><Link href={`/admin/users/${t._id}`} className="text-white">{t.name} <span className="text-xs text-[#b8a7e6]">{t.phone}</span></Link><span className="text-xs text-[#b8a7e6]">Deposited {fmt(t.totalDeposited ?? 0)}</span></li>)}</ul> : <Empty text="Koi referral nahi." />}</Card><Card title="Commission history">{comm.length ? <ul className="divide-y divide-[#3a2470]/50 text-sm">{comm.map((c) => <li key={String(c._id)} className="flex justify-between py-2"><span>{c.kind} · {c.fromUserId?.name ?? "-"}</span><b className="text-emerald-300">+{fmt(c.amount)}</b></li>)}</ul> : <Empty text="Abhi koi commission nahi." />}</Card></div>
            </section>

            <section id="member-payout-info" className="grid gap-4 md:grid-cols-2"><Card title="Member Payout Info"><InfoGrid items={[["Withdrawal PIN", canSee ? (u.withdrawPin ?? "Not set") : "Hidden"], ["Daily withdraw limit", fmt(cur?.dailyWithdrawLimit ?? 0)], ["Per withdraw max", fmt(cur?.perWithdrawMax ?? 0)], ["Total withdrawn", fmt(u.totalWithdrawn ?? 0)]]} /></Card><Card title="Registration / Login Information"><InfoGrid items={[["Register IP", canSee ? (u.registrationIp ?? "-") : "Hidden"], ["Register time", fmtDate(u.createdAt)], ["Last login IP", canSee ? (u.lastLoginIp ?? "-") : "Hidden"], ["Last login time", fmtDate(u.lastLoginAt)], ["Historical IPs", canSee ? ((u.historicalIps ?? []).join(", ") || "-") : "Hidden"]]} /></Card></section>
            <section id="recharge-records" className="grid gap-4 md:grid-cols-2"><Card title="Recharge Records"><TransactionTable rows={deposits} /></Card><section id="game-details"><Card title={`Game Details — Bets ${fmt(bets)} · Wins ${fmt(wins)}`}><ul className="divide-y divide-[#3a2470]/50 text-sm">{plays.map((p) => <li key={String(p._id)} className="flex justify-between py-2"><span>{p.gameId?.icon} {p.gameId?.name}</span><span>Bet {fmt(p.betAmount)} · <b className="text-emerald-300">Win {fmt(p.winAmount)}</b></span></li>)}{!plays.length && <li className="py-3 text-[#6f5fa3]">Koi game nahi kheli.</li>}</ul></Card></section></section>
            <section id="payout-records" className="grid gap-4 md:grid-cols-2"><Card title="Payout Records"><TransactionTable rows={withdrawals} /></Card><section id="promotion-records"><Card title="Promotion Records">{comm.length ? <ul className="divide-y divide-[#3a2470]/50 text-sm">{comm.slice(0, 10).map((c) => <li key={String(c._id)} className="flex justify-between py-2"><span>{c.kind} · {fmtDate(c.createdAt)}</span><span className="text-emerald-300">+{fmt(c.amount)}</span></li>)}</ul> : <Empty text="No promotion records." />}</Card></section></section>
        </div>;
    }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}

function Header({ id, user: u, canSee }: { id: string; user: any; canSee: boolean }) {
    return <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin/users" className="text-xs text-[#b8a7e6]">← All users</Link><h1 className="text-2xl font-bold text-white">{u.name} <span className="text-base font-normal text-[#b8a7e6]">@{u.username ?? "-"}</span></h1><div className="text-sm text-[#b8a7e6]">{u.phone} · {u.email ?? "no email"} · Joined {fmtDate(u.createdAt)} · Last login {fmtDate(u.lastLoginAt)}</div></div><div className="flex gap-2"><StatusBadge status={u.isActive ? "active" : "blocked"} />{canSee && <form action={toggleUserActiveAction.bind(null, id, !u.isActive)}><button className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300">{u.isActive ? "Block account" : "Unblock"}</button></form>}{canSee && <form action={deleteUserAction.bind(null, id)}><button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Delete user</button></form>}</div></div>;
}
function InfoGrid({ items }: { items: [string, string][] }) { return <div className="grid grid-cols-2 gap-2 text-sm">{items.map(([label, value]) => <div key={label} className="rounded-lg bg-black/20 p-2"><div className="text-[10px] uppercase text-[#6f5fa3]">{label}</div><div className="mt-1 truncate text-white" title={value}>{value}</div></div>)}</div>; }
function TransactionTable({ rows }: { rows: any[] }) { return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-[#6f5fa3]"><tr><th className="pb-2">Provider</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2">Date</th></tr></thead><tbody className="divide-y divide-[#3a2470]/50">{rows.map((t) => <tr key={String(t._id)}><td className="py-2"><ProviderBadge provider={t.provider} /></td><td className="py-2 text-white">{fmt(t.amount)}</td><td className="py-2"><StatusBadge status={t.status} /></td><td className="py-2 text-xs text-[#b8a7e6]">{fmtDate(t.createdAt)}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="py-4 text-center text-[#6f5fa3]">No records.</td></tr>}</tbody></table></div>; }
function Empty({ text }: { text: string }) { return <p className="py-3 text-sm text-[#6f5fa3]">{text}</p>; }
