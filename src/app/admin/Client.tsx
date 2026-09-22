"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { GameResult, PaymentAccount, SupportThread, Transaction, User } from "@/models";
import { Card, StatCard, StatusBadge, ProviderBadge, fmt, fmtDate } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";


const sumOf = async (match: Record<string, unknown>, field: string) => {
  const [r] = await Transaction.aggregate<{ s: number }>([{ $match: match }, { $group: { _id: null, s: { $sum: `$${field}` } } }]);
  return r?.s ?? 0;
};
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function AdminDashboardClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
    const me = (await getCurrentUser())!;
    await dbConnect();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);

    const [totalUsers, todayUsers, dep, wd, pending, accActive, balAgg, resAgg, todayDeposits, todayGameResults, earlierGameUsers, todaySignups] = await Promise.all([
      User.countDocuments({ role: { $in: ["client", "agent"] } }),
      User.countDocuments({ role: { $in: ["client", "agent"] }, createdAt: { $gte: startOfDay } }),
      sumOf({ type: "deposit", status: "approved" }, "amount"),
      sumOf({ type: "withdraw", status: "approved" }, "amount"),
      Transaction.countDocuments({ status: "pending" }),
      PaymentAccount.countDocuments({ isActive: true }),
      User.aggregate<{ s: number }>([{ $match: { role: { $in: ["client", "agent"] } } }, { $group: { _id: null, s: { $sum: "$balance" } } }]),
      GameResult.aggregate<{ c: number; bet: number; win: number }>([{ $group: { _id: null, c: { $sum: 1 }, bet: { $sum: "$betAmount" }, win: { $sum: "$winAmount" } } }]),
      Transaction.find({ type: "deposit", status: "approved", createdAt: { $gte: startOfDay, $lt: endOfDay } }).lean(),
      GameResult.find({ createdAt: { $gte: startOfDay, $lt: endOfDay }, outcome: { $ne: "pending" } }).lean(),
      GameResult.find({ createdAt: { $lt: startOfDay }, outcome: { $ne: "pending" } }).lean(),
      User.find({ role: { $in: ["client", "agent"] }, createdAt: { $gte: startOfDay, $lt: endOfDay } }).sort({ createdAt: -1 }).lean(),
    ]);
    const res = resAgg[0] ?? { c: 0, bet: 0, win: 0 };
    const todayPaymentTotal = todayDeposits.reduce((sum, tx) => sum + tx.amount, 0);
    const todayBetTotal = todayGameResults.reduce((sum, game) => sum + game.betAmount, 0);
    const todayPayoutTotal = todayGameResults.reduce((sum, game) => sum + game.winAmount, 0);
    const todayEarned = todayBetTotal - todayPayoutTotal;
    const earlierPlayerIds = new Set(earlierGameUsers.map((game) => game.userId).filter((id): id is string => !!id).map(String));
    const todayPlayerIds = [...new Set(todayGameResults.map((game) => game.userId).filter((id): id is string => !!id).map(String))];
    const repeatedPlayerIds = todayPlayerIds.filter((id) => earlierPlayerIds.has(id));
    const repeatedPlayers = await Promise.all(repeatedPlayerIds.map(async (id) => {
      const user = await User.findById(id).lean();
      return user ? { id, name: user.name, phone: user.phone, registrationIp: user.registrationIp, registeredAt: user.createdAt, playedAt: todayGameResults.find((game) => String(game.userId) === id)?.createdAt } : null;
    }));
    const [agents, openChats, unreadChats] = await Promise.all([User.countDocuments({ role: "agent" }), SupportThread.countDocuments({ status: "open" }), SupportThread.countDocuments({ unreadForAdmin: { $gt: 0 } })]);

    const [recentResults, recentUsers, pendingTx] = await Promise.all([
      GameResult.find().sort({ createdAt: -1 }).limit(8)
        .populate<{ gameId: { name: string; icon: string } | null }>("gameId", "name icon")
        .populate<{ userId: { name: string } | null }>("userId", "name").lean(),
      User.find({ role: { $in: ["client", "agent"] } }).sort({ createdAt: -1 }).limit(6).lean(),
      Transaction.find({ status: "pending" }).sort({ createdAt: -1 }).limit(6).populate<{ userId: { name: string } | null }>("userId", "name").lean(),
    ]);

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4 md:grid-cols-4 2xl:grid-cols-6">
          <StatCard label="Total Users" value={totalUsers} sub={`+${todayUsers} aaj register hue`} accent="text-yellow-400" />
          <StatCard label="Today's Payments" value={fmt(todayPaymentTotal)} sub={`${todayDeposits.length} approved deposits`} accent="text-emerald-400" />
          <StatCard label="Today's Earnings" value={fmt(todayEarned)} sub={`${fmt(todayBetTotal)} bets − payouts`} accent={todayEarned >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Repeat Players Today" value={repeatedPlayers.length} sub={`${todayPlayerIds.length} players today`} accent="text-cyan-300" />
          <StatCard label="Total Deposits" value={fmt(dep)} accent="text-emerald-400" />
          <StatCard label="Total Withdrawals" value={fmt(wd)} accent="text-red-400" />
          <StatCard label="Pending Requests" value={pending} sub="approval ka intezar" accent={pending > 0 ? "text-orange-400" : undefined} />
          <StatCard label="Total Game Rounds" value={res.c} />
          <StatCard label="Total Bets" value={fmt(res.bet)} />
          <StatCard label="Total Payouts" value={fmt(res.win)} />
          <StatCard label="Users Wallet Balance" value={fmt(balAgg[0]?.s ?? 0)} sub={`${accActive} payment accounts active`} />
          <StatCard label="House Profit (games)" value={fmt(res.bet - res.win)} accent={res.bet - res.win >= 0 ? "text-emerald-400" : "text-red-400"} sub="total bets − total payouts" />
          <StatCard label="Agents" value={agents} sub="staff accounts" />
          <StatCard label="Support chats" value={openChats} sub={`${unreadChats} unread`} accent={unreadChats > 0 ? "text-orange-400" : undefined} />
          <StatCard label="Net Cash (Dep − Wd)" value={fmt(dep - wd)} accent="text-[#ffb800]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(me.level >= 2
            ? [["/admin/support", "Live Support"], ["/admin/staff", "Admins / Staff"], ["/admin/logs", "Activity Logs"], ["/admin/notifications", "Send Notification"], ["/admin/games", "Games On/Off"], ["/admin/vip", "VIP Levels"], ["/admin/records", "Records"], ["/admin/help", "Help Center"], ["/admin/settings", "Settings"]]
            : [["/admin/support", "Live Support"], ["/admin/deposits", "Deposits"], ["/admin/withdrawals", "Withdrawals"], ["/admin/notifications", "Send Notification"], ["/admin/records", "Records"], ["/admin/account", "My Account"]]
          ).map(([h, l]) => <Link key={h} href={h} className="btn-outline rounded-full px-4 py-1.5 text-xs font-bold">{l}</Link>)}
        </div>

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <Card title="Latest Game Results" action={<Link href="/admin/results" className="text-sm text-yellow-400">View all →</Link>}>
            {recentResults.length === 0 ? <Empty text="Abhi koi game result nahi." /> : (
              <ul className="divide-y divide-slate-800">
                {recentResults.map((r) => (
                  <li key={String(r._id)} className="flex items-center justify-between py-2.5 text-sm">
                    <div><span className="mr-2">{r.gameId?.icon}</span><span className="font-medium text-white">{r.gameId?.name}</span><span className="ml-2 text-slate-400">{r.userId?.name ?? "—"}</span></div>
                    <div className="flex items-center gap-3"><span className="text-slate-400">{fmt(r.betAmount)}</span><StatusBadge status={r.outcome} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Pending Deposits / Withdraws" action={<span className="flex gap-3 text-sm"><Link href="/admin/deposits" className="text-emerald-400">Deposits →</Link><Link href="/admin/withdrawals" className="text-red-400">Withdrawals →</Link></span>}>
            {pendingTx.length === 0 ? <Empty text="Koi pending request nahi." /> : (
              <ul className="divide-y divide-slate-800">
                {pendingTx.map((t) => (
                  <li key={String(t._id)} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold uppercase ${t.type === "deposit" ? "text-emerald-400" : "text-red-400"}`}>{t.type}</span>
                      <span className="text-white">{t.userId?.name}</span>
                      <ProviderBadge provider={t.provider} />
                    </div>
                    <span className="font-semibold text-white">{fmt(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Recently Registered Clients" action={<Link href="/admin/users" className="text-sm text-yellow-400">All users →</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Name</th><th className="pb-2">Phone</th><th className="pb-2">Balance</th><th className="pb-2">Registered</th><th className="pb-2">Last Login</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {recentUsers.map((x) => (
                  <tr key={String(x._id)}>
                    <td className="py-2 font-medium text-white">{x.name}</td>
                    <td className="py-2 text-slate-300">{x.phone}</td>
                    <td className="py-2 text-slate-300">{fmt(x.balance)}</td>
                    <td className="py-2 text-slate-400">{fmtDate(x.createdAt)}</td>
                    <td className="py-2 text-slate-400">{fmtDate(x.lastLoginAt)}</td>
                  </tr>
                ))}
                {recentUsers.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Abhi koi client register nahi hua.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Today’s Signups & Repeat Players">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">User</th><th className="pb-2">Phone</th><th className="pb-2">Signup date</th><th className="pb-2">Registration IP</th><th className="pb-2">Today status</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {todaySignups.map((user) => <tr key={String(user._id)}><td className="py-2 font-medium text-white">{user.name}</td><td className="py-2 text-slate-300">{user.phone}</td><td className="py-2 text-slate-400">{fmtDate(user.createdAt)}</td><td className="py-2 font-mono text-xs text-cyan-300">{user.registrationIp ?? "IP unavailable"}</td><td className="py-2 text-slate-300">{repeatedPlayers.some((player) => player?.id === String(user._id)) ? "Repeat player" : "New player"}</td></tr>)}
                {todaySignups.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Aaj koi signup nahi hua.</td></tr>}
              </tbody>
            </table>
          </div>
          {repeatedPlayers.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Today’s repeat players</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">User</th><th className="pb-2">Signup date</th><th className="pb-2">Registration IP</th><th className="pb-2">Played today</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {repeatedPlayers.filter((player): player is NonNullable<typeof player> => !!player).map((player) => <tr key={player.id}><td className="py-2 font-medium text-white">{player.name}</td><td className="py-2 text-slate-400">{fmtDate(player.registeredAt)}</td><td className="py-2 font-mono text-xs text-cyan-300">{player.registrationIp ?? "IP unavailable"}</td><td className="py-2 text-slate-400">{player.playedAt ? fmtDate(player.playedAt) : "-"}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-500">{text}</p>;
}
