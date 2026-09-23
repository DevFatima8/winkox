import { dbConnect } from "./mongo";
import { Notification, User, oid } from "@/models";
import { getSessionSync } from "./auth";

type NotificationType = "info" | "promo" | "warning" | "success";

export async function notifyUser(userId: string, title: string, body: string, type: NotificationType = "info") {
  await dbConnect();
  return Notification.create({ title, body, type, audience: "user", userId: oid(userId) });
}

export async function notifyAdmins(title: string, body: string, type: NotificationType = "info") {
  await dbConnect();
  return Notification.create({ title, body, type, audience: "admins", userId: null });
}

export async function getNotifications() {
  await dbConnect();
  const s = getSessionSync();
  const uid = s ? oid(s.id) : null;
  const role = uid ? (await User.findById(uid).lean())?.role : null;
  type Aud = "all" | "clients" | "agents" | "admins" | "user";
  const aud: Aud[] = ["all"];
  if (role === "client") aud.push("clients");
  if (role === "agent") aud.push("clients", "agents");
  if (role === "admin" || role === "owner" || role === "subadmin") aud.push("admins");
  const q: Record<string, unknown> = uid ? { isActive: true, $or: [{ audience: { $in: aud } }, { audience: "user", userId: uid }] } : { isActive: true, audience: "all" };
  const list = await Notification.find(q).sort({ createdAt: -1 }).limit(30).lean();
  return {
    items: list.map((n) => ({ id: String(n._id), title: n.title, body: n.body, type: n.type, at: n.createdAt, read: uid ? (n.readBy ?? []).some((r) => String(r) === String(uid)) : false })),
    unread: uid ? list.filter((n) => !(n.readBy ?? []).some((r) => String(r) === String(uid))).length : 0,
  };
}
export async function markAllNotificationsRead() {
  const s = getSessionSync();
  if (!s) return { ok: false };
  await dbConnect();
  await Notification.updateMany({ isActive: true, readBy: { $ne: oid(s.id) } }, { $addToSet: { readBy: oid(s.id) } });
  return { ok: true };
}
