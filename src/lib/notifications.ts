import { dbConnect } from "./mongo";
import { Notification, User, oid } from "@/models";
import type { NotificationDoc } from "@/models";

type NotificationType = "info" | "promo" | "warning" | "success";

export async function notifyUser(userId: string, title: string, body: string, type: NotificationType = "info") {
  await dbConnect();
  const notification = await Notification.create({ title, body, type, audience: "user", userId: oid(userId) });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wx:notification-local"));
  return notification;
}

export async function notifyAdmins(title: string, body: string, type: NotificationType = "info") {
  await dbConnect();
  const notification = await Notification.create({ title, body, type, audience: "admins", userId: null });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wx:notification-local"));
  return notification;
}

export async function getNotifications(userId: string | null, role: string | null) {
  await dbConnect();
  const uid = userId ? oid(userId) : null;
  type Aud = "all" | "clients" | "agents" | "admins" | "user";
  const aud: Aud[] = ["all"];
  if (role === "client") aud.push("clients");
  if (role === "agent") aud.push("clients", "agents");
  if (role === "admin" || role === "owner" || role === "subadmin") aud.push("admins");
  const q: Record<string, unknown> = uid ? { isActive: true, $or: [{ audience: { $in: aud } }, { audience: "user", userId: uid }] } : { isActive: true, audience: "all" };
  const list = await Notification.find(q).sort({ createdAt: -1 }).limit(30).lean<NotificationDoc[]>();
  return {
    items: list.map((n) => ({ id: String(n._id), title: n.title, body: n.body, type: n.type, audience: n.audience, at: n.createdAt, read: uid ? (n.readBy ?? []).some((r) => String(r) === String(uid)) : false })),
    unread: uid ? list.filter((n) => !(n.readBy ?? []).some((r) => String(r) === String(uid))).length : 0,
  };
}
export async function markAllNotificationsRead(userId: string | null) {
  if (!userId) return { ok: false };
  await dbConnect();
  await Notification.updateMany({ isActive: true, readBy: { $ne: oid(userId) } }, { $addToSet: { readBy: oid(userId) } });
  return { ok: true };
}
