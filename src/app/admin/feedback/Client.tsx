"use client";
import { dbConnect } from "@/lib/mongo";
import { Feedback } from "@/models";
import { Card, fmtDate } from "@/components/Shell";
import { updateFeedbackAction } from "@/lib/actions";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function FeedbackAdminPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const { status } = searchParams ?? {};
  await dbConnect();
  const filter = status && ["new", "reviewed", "resolved"].includes(status) ? { status: status as "new" | "reviewed" | "resolved" } : {};
  const list = await Feedback.find(filter).sort({ createdAt: -1 }).limit(300).lean();
  const counts = await Feedback.aggregate<{ _id: string; c: number }>([{ $group: { _id: "$status", c: { $sum: 1 } } }]);
  const n = (k: string) => counts.find((c) => c._id === k)?.c ?? 0;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Reward Feedback & Complaints</h1><p className="text-sm text-[#b8a7e6]">Users ke bonus/reward claims, shikayat aur suggestions (/feedback page se).</p></div>
      <div className="flex gap-2">
        {[["", "All"], ["new", `New (${n("new")})`], ["reviewed", `Reviewed (${n("reviewed")})`], ["resolved", `Resolved (${n("resolved")})`]].map(([v, l]) => <a key={v} href={v ? `/admin/feedback?status=${v}` : "/admin/feedback"} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${(status ?? "") === v ? "btn-violet" : "bg-black/30 text-[#b8a7e6]"}`}>{l}</a>)}
      </div>
      <Card>
        <ul className="divide-y divide-[#3a2470]/50">
          {list.map((f) => (
            <li key={String(f._id)} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${f.type === "complaint" ? "bg-red-500/20 text-red-300" : f.type === "reward" ? "bg-[#ffb800]/20 text-[#ffb800]" : "bg-[#8b5cf6]/20 text-[#c4b5fd]"}`}>{f.type}</span><b className="text-white">{f.name}</b><span className="text-xs text-[#b8a7e6]">{f.phone}</span><span className="text-xs text-[#6f5fa3]">{fmtDate(f.createdAt)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.status === "new" ? "bg-yellow-500/15 text-yellow-400" : f.status === "resolved" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-300"}`}>{f.status}</span></div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#e9ddff]">{f.message}</p>
                  {f.adminNote && <p className="mt-1 text-xs text-[#b8a7e6]">Note: {f.adminNote}</p>}
                </div>
                <form action={updateFeedbackAction} className="flex flex-wrap items-center gap-1.5">
                  <input type="hidden" name="id" value={String(f._id)} />
                  <input name="note" placeholder="Admin note" defaultValue={f.adminNote} className="w-40 rounded-lg border border-[#3a2470] bg-black/30 px-2 py-1 text-xs text-white" />
                  <button name="status" value="reviewed" className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">Reviewed</button>
                  <button name="status" value="resolved" className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">Resolved</button>
                </form>
              </div>
            </li>
          ))}
          {list.length === 0 && <li className="py-8 text-center text-[#6f5fa3]">Koi feedback nahi.</li>}
        </ul>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
