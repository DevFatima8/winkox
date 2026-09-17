"use client";
import { dbConnect } from "@/lib/mongo";
import { AdminLog } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { Card, fmtDate } from "@/components/Shell";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function LogsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const me = await getCurrentUser();
  if (!me || me.level < 2) return REDIRECT("/admin");
  const { q } = searchParams ?? {};
  await dbConnect();
  // super admin sees sub-admin (+ own) activity; owner sees everyone's. Owner actions are never logged.
  const filter: Record<string, unknown> = me.level >= 3 ? {} : { actorRole: { $in: ["subadmin", "admin"] } };
  if (q) filter.$or = [{ actorName: new RegExp(q, "i") }, { action: new RegExp(q, "i") }, { target: new RegExp(q, "i") }, { details: new RegExp(q, "i") }];
  const logs = await AdminLog.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white">Activity Logs</h1><p className="text-sm text-[#b8a7e6]">Har admin ne kya kiya — logins, approvals, user changes, notifications.</p></div>
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search admin / action" className="rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white" /><button className="btn-violet rounded-xl px-4 py-2 text-sm font-bold">Search</button></form>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-[#6f5fa3]"><tr><th className="pb-2">Time</th><th className="pb-2">Admin</th><th className="pb-2">Role</th><th className="pb-2">Action</th><th className="pb-2">Target</th><th className="pb-2">Details</th></tr></thead>
            <tbody className="divide-y divide-[#3a2470]/50">
              {logs.map((l) => <tr key={String(l._id)}><td className="py-2 text-xs text-[#b8a7e6]">{fmtDate(l.createdAt)}</td><td className="py-2 font-medium text-white">{l.actorName}</td><td className="py-2 text-xs uppercase text-[#c4b5fd]">{l.actorRole === "admin" ? "super" : l.actorRole}</td><td className="py-2 font-mono text-xs text-[#ffb800]">{l.action}</td><td className="py-2 text-[#e9ddff]">{l.target}</td><td className="py-2 text-xs text-[#b8a7e6]">{l.details}</td></tr>)}
              {logs.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[#6f5fa3]">Koi activity nahi.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
