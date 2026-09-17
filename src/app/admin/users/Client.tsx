"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { User } from "@/models";
import { Card, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { toggleUserActiveAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function UsersPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const { q, role } = searchParams ?? {};
  const me = (await getCurrentUser())!;
  const canSee = me.level >= 2;
  await dbConnect();
  const filter: Record<string, unknown> = { role: { $nin: ["owner", "admin", "subadmin"] } };
  if (role === "agent" || role === "client") filter.role = role;
  if (q) filter.$or = [{ name: new RegExp(q, "i") }, { phone: new RegExp(q, "i") }, { username: new RegExp(q, "i") }, { referralCode: new RegExp(q, "i") }];
  const list = await User.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Users / Clients</h1>
        <form className="flex w-full flex-wrap gap-2 md:w-auto">
          <input name="q" defaultValue={q} placeholder="Search name / phone / username" className="min-w-0 flex-1 rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#d946ef] md:w-64 md:flex-none" />
          <select name="role" defaultValue={role ?? ""} className="rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white"><option value="">All</option><option value="client">Clients</option><option value="agent">Agents</option></select>
          <button className="btn-violet rounded-xl px-4 py-2 text-sm font-bold">Search</button>
        </form>
        <span className="rounded-lg bg-black/30 px-3 py-1 text-sm text-[#b8a7e6]">Total: <b className="text-[#ffb800]">{list.length}</b></span>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-[#6f5fa3]">
              <tr><th className="pb-2">User</th><th className="pb-2">Username</th><th className="pb-2">Phone</th>{canSee && <th className="pb-2">Password</th>}{canSee && <th className="pb-2">PIN</th>}<th className="pb-2">Role</th><th className="pb-2">VIP</th><th className="pb-2">Balance</th><th className="pb-2">Deposited</th><th className="pb-2">Status</th><th className="pb-2">Signup</th><th className="pb-2">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#3a2470]/50">
              {list.map((u) => (
                <tr key={String(u._id)}>
                  <td className="py-2.5"><Link href={`/admin/users/${u._id}`} className="font-medium text-white hover:text-[#ffb800]">{u.name}</Link>{u.blockedGames?.length ? <div className="text-[10px] text-red-300">{u.blockedGames.length} game(s) restricted</div> : null}</td>
                  <td className="py-2.5 text-[#e9ddff]">{u.username ?? "-"}</td>
                  <td className="py-2.5 text-[#e9ddff]">{u.phone}</td>
                  {canSee && <td className="py-2.5 font-mono text-xs text-[#ffb800]">{u.passwordPlain ?? "••••"}</td>}
                  {canSee && <td className="py-2.5 font-mono text-xs text-[#ffb800]">{u.withdrawPin ?? "-"}</td>}
                  <td className="py-2.5"><span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${u.role === "agent" ? "bg-[#d946ef]/20 text-[#f0abfc]" : "bg-black/30 text-[#b8a7e6]"}`}>{u.role.toUpperCase()}</span></td>
                  <td className="py-2.5 text-[#ffb800]">{u.vipLevel ?? 0}</td>
                  <td className="py-2.5 text-white">{fmt(u.balance)}</td>
                  <td className="py-2.5 text-[#e9ddff]">{fmt(u.totalDeposited ?? 0)}</td>
                  <td className="py-2.5"><StatusBadge status={u.isActive ? "active" : "blocked"} /></td>
                  <td className="py-2.5 text-xs text-[#b8a7e6]">{fmtDate(u.createdAt)}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1.5">
                      <Link href={`/admin/users/${u._id}`} className="btn-violet rounded-lg px-2.5 py-1 text-xs font-semibold">{canSee ? "Manage" : "View"}</Link>
                      {canSee && <form action={toggleUserActiveAction.bind(null, String(u._id), !u.isActive)}>
                        <button className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${u.isActive ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{u.isActive ? "Block" : "Unblock"}</button>
                      </form>}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={12} className="py-6 text-center text-[#6f5fa3]">Koi user nahi.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
