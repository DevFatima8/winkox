"use client";
import { dbConnect } from "@/lib/mongo";
import { Notification, User } from "@/models";
import { Card, fmtDate } from "@/components/Shell";
import { NotificationForm } from "@/components/admin/Forms";
import { deleteNotificationAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function NotificationsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const me = (await getCurrentUser())!;
  await dbConnect();
  const [list, total] = await Promise.all([Notification.find().sort({ createdAt: -1 }).limit(100).lean(), User.countDocuments({ role: { $nin: ["owner", "admin", "subadmin"] } })]);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Notifications / Broadcast</h1><p className="text-sm text-[#b8a7e6]">Yahan message likhein — sab platform users ({total}) ko app/website mein notification mil jayegi (bell icon + popup).</p></div>
      <Card title="Send new notification"><NotificationForm /></Card>
      <Card title={`Sent (${list.length})`}>
        <ul className="divide-y divide-[#3a2470]/50">
          {list.map((n) => (
            <li key={String(n._id)} className="flex items-start justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${n.type === "promo" ? "bg-[#ffb800]/20 text-[#ffb800]" : n.type === "warning" ? "bg-red-500/20 text-red-300" : n.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-[#8b5cf6]/20 text-[#c4b5fd]"}`}>{n.type}</span><b className="text-white">{n.title}</b><span className="text-xs text-[#6f5fa3]">→ {n.audience}</span></div>
                <p className="mt-1 text-sm text-[#e9ddff]">{n.body}</p>
                <div className="mt-1 text-xs text-[#6f5fa3]">{fmtDate(n.createdAt)} · read by {n.readBy.length}</div>
              </div>
              {me.level >= 2 && <form action={deleteNotificationAction.bind(null, String(n._id))}><button className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs text-red-300">Delete</button></form>}
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-[#6f5fa3]">Abhi koi notification nahi bheji.</li>}
        </ul>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
