/**
 * Client-side auth (LocalDB mode). Session lives in sessionStorage (per browser tab) so you can be
 * logged in as Admin in one tab and as a Client in another. A "last session" copy in localStorage
 * restores login in new tabs until you log out.
 */
import { User, type UserDoc } from "@/models";
import { dbConnect } from "./mongo";

export type Role = "admin" | "client";
export type DbRole = "owner" | "admin" | "subadmin" | "agent" | "client";
export const staffLevel = (r: DbRole | string | null | undefined) => (r === "owner" ? 3 : r === "admin" ? 2 : r === "subadmin" ? 1 : 0);
export const isStaff = (r: DbRole | string | null | undefined) => staffLevel(r) > 0;
export type SessionUser = { id: string; role: Role; name: string };

const KEY = "wx_session";
const isBrowser = () => typeof window !== "undefined";

export async function hashPassword(pw: string) { return "plain:" + pw; }
export async function verifyPassword(pw: string, hash: string) { return hash === "plain:" + pw || hash === pw; }

export function getSessionSync(): SessionUser | null {
  if (!isBrowser()) return null;
  try {
    const s = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY + "_last");
    if (!s) return null;
    const u = JSON.parse(s) as SessionUser;
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, s);
    return u;
  } catch { return null; }
}
export async function getSession(): Promise<SessionUser | null> { return getSessionSync(); }
export async function createSession(user: SessionUser) {
  if (!isBrowser()) return;
  const s = JSON.stringify(user);
  sessionStorage.setItem(KEY, s); localStorage.setItem(KEY + "_last", s);
  window.dispatchEvent(new CustomEvent("wx:session"));
}
export async function destroySession() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(KEY); localStorage.removeItem(KEY + "_last");
  window.dispatchEvent(new CustomEvent("wx:session"));
}

export type CurrentUser = {
  id: string; name: string; username: string | null; phone: string; email: string | null; role: Role; dbRole: DbRole; balance: number; isActive: boolean;
  level: number; adminId: string | null; vipLevel: number; totalDeposited: number; blockedGames: string[]; referralCode: string | null; hasPin: boolean; commissionEarned: number;
};
export function toCurrentUser(u: UserDoc): CurrentUser {
  const dbRole = (u.role as DbRole) ?? "client";
  return {
    id: String(u._id), name: u.name, username: u.username ?? null, phone: u.phone, email: u.email ?? null,
    role: isStaff(dbRole) ? "admin" : "client", dbRole, balance: u.balance ?? 0, isActive: u.isActive !== false, level: staffLevel(dbRole), adminId: u.adminId ?? null,
    vipLevel: u.vipLevel ?? 0, totalDeposited: u.totalDeposited ?? 0, blockedGames: u.blockedGames ?? [], referralCode: u.referralCode ?? null, hasPin: !!u.withdrawPin, commissionEarned: u.commissionEarned ?? 0,
  };
}
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = getSessionSync();
  if (!s) return null;
  await dbConnect();
  const u = await User.findById(s.id).lean();
  if (!u) { await destroySession(); return null; }
  return toCurrentUser(u);
}
export async function requireRole(role: Role) {
  const u = await getCurrentUser();
  if (!u || u.role !== role) return null;
  return u;
}
