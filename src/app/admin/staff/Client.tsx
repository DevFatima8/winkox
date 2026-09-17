"use client";
import { dbConnect } from "@/lib/mongo";
import { AdminLog, SupportThread, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { Card, StatusBadge, fmtDate } from "@/components/Shell";
import { CreateStaffForm, EditStaffForm } from "@/components/admin/StaffForms";
import { deleteStaffAction, toggleStaffAction } from "@/lib/actions";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function StaffPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const me = await getCurrentUser();
  if (!me || me.level < 2) return REDIRECT("/admin");
  await dbConnect();
  // owner never appears; super admins visible only to owner (level 3) — a super admin sees only sub-admins + self
  const roles: ("admin" | "subadmin")[] = me.level >= 3 ? ["admin", "subadmin"] : ["subadmin"];
  const staff = await User.find({ role: { $in: roles } }).sort({ role: 1, createdAt: 1 }).lean();
  const [chatStats, actStats] = await Promise.all([
    SupportThread.aggregate<{ _id: string; c: number }>([{ $match: { assignedTo: { $ne: null } } }, { $group: { _id: "$assignedTo", c: { $sum: 1 } } }]),
    AdminLog.aggregate<{ _id: string; c: number; last: Date }>([{ $group: { _id: "$actorId", c: { $sum: 1 }, last: { $max: "$createdAt" } } }]),
  ]);
  const cm = new Map(chatStats.map((c) => [String(c._id), c.c]));
  const am = new Map(actStats.map((a) => [String(a._id), a]));
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Admins / Staff</h1><p className="text-sm text-[#b8a7e6]">Sub-admin accounts banayein — unki Login ID auto-generate hoti hai aur password aap set karte hain. Sub-admins clients ko support dete hain, deposits/withdraws process karte hain aur sab kuch dekh sakte hain — lekin kisi ka password ya dusre admin ki info nahi dekh sakte.</p></div>
      {me.adminId && <div className="rounded-xl bg-black/30 px-4 py-2 text-sm text-[#b8a7e6] ring-1 ring-[#3a2470]">Aapki apni Login ID: <b className="font-mono text-[#ffb800]">{me.adminId}</b> — password change ke liye <a href="/admin/account" className="text-[#c4b5fd] underline">My Account</a>.</div>}
      <Card title="Create new admin account"><CreateStaffForm canCreateSuper={me.level >= 3} /></Card>
      <Card title={`Staff accounts (${staff.length})`}>
        <div className="space-y-4">
          {staff.map((u) => { const a = am.get(String(u._id)); return (
            <div key={String(u._id)} className="rounded-2xl border border-[#3a2470] bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{u.name}</span><span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${u.role === "admin" ? "bg-[#ffb800]/20 text-[#ffb800]" : "bg-[#d946ef]/20 text-[#f0abfc]"}`}>{u.role === "admin" ? "SUPER ADMIN" : "SUB ADMIN"}</span><StatusBadge status={u.isActive ? "active" : "blocked"} /></div>
                  <div className="mt-1 grid gap-x-6 gap-y-0.5 text-xs text-[#b8a7e6] sm:grid-cols-2">
                    <span>Login ID: <b className="font-mono text-[#ffb800]">{u.adminId}</b></span>
                    <span>Password: <b className="font-mono text-[#ffb800]">{u.passwordPlain ?? "••••••"}</b></span>
                    <span>Phone: {u.phone.startsWith("ADM") ? "—" : u.phone}</span>
                    <span>Created: {fmtDate(u.createdAt)} · Last login: {fmtDate(u.lastLoginAt)}</span>
                    <span>Chats handled: <b className="text-white">{cm.get(String(u._id)) ?? 0}</b></span>
                    <span>Actions: <b className="text-white">{a?.c ?? 0}</b>{a?.last ? ` · last ${fmtDate(a.last)}` : ""}</span>
                  </div>
                  {u.adminNote && <div className="mt-1 text-xs text-[#6f5fa3]">Note: {u.adminNote}</div>}
                </div>
                <div className="flex gap-2">
                  <form action={toggleStaffAction.bind(null, String(u._id), !u.isActive)}><button className={`rounded-lg px-3 py-1.5 text-xs font-bold ${u.isActive ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{u.isActive ? "Block" : "Unblock"}</button></form>
                  <form action={deleteStaffAction.bind(null, String(u._id))}><button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Delete</button></form>
                </div>
              </div>
              <div className="mt-3"><EditStaffForm id={String(u._id)} name={u.name} note={u.adminNote ?? ""} /></div>
            </div>
          ); })}
          {staff.length === 0 && <p className="py-6 text-center text-[#6f5fa3]">Abhi koi sub-admin nahi. Upar se banayein.</p>}
        </div>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
