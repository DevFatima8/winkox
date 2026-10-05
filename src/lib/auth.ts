/**
 * Browser identity is resolved from the server's signed HttpOnly cookie.
 */
import type { UserDoc } from "@/models";

export type Role = "admin" | "client";
export type DbRole = "owner" | "admin" | "subadmin" | "agent" | "client";
export const staffLevel = (r: DbRole | string | null | undefined) => (r === "owner" ? 3 : r === "admin" ? 2 : r === "subadmin" ? 1 : 0);
export const isStaff = (r: DbRole | string | null | undefined) => staffLevel(r) > 0;
export type SessionUser = { id: string; role: Role; name: string };

const isBrowser = () => typeof window !== "undefined";

export async function hashPassword(pw: string) { return "plain:" + pw; }
export async function verifyPassword(pw: string, hash: string) { return hash === "plain:" + pw || hash === pw; }

export function getSessionSync(): SessionUser | null {
  return null;
}
export async function getSession(): Promise<SessionUser | null> { return getSessionSync(); }
export async function createSession(user: SessionUser) {
  if (!isBrowser()) return;
  void user;
  window.dispatchEvent(new CustomEvent("wx:session"));
}
export async function destroySession() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent("wx:session"));
}

export type CurrentUser = {
  id: string; name: string; username: string | null; phone: string; email: string | null; role: Role; dbRole: DbRole; balance: number; isActive: boolean; vipBetPoints: number; vipPointsWelcomePending: boolean;
  level: number; adminId: string | null; vipLevel: number; totalDeposited: number; blockedGames: string[]; referralCode: string | null; hasPin: boolean; commissionEarned: number; adminNote: string;
};
export function toCurrentUser(u: UserDoc): CurrentUser {
  const dbRole = (u.role as DbRole) ?? "client";
  return {
    id: String(u._id), name: u.name, username: u.username ?? null, phone: u.phone, email: u.email ?? null,
    role: isStaff(dbRole) ? "admin" : "client", dbRole, balance: u.balance ?? 0, isActive: u.isActive !== false, level: staffLevel(dbRole), adminId: u.adminId ?? null,
    vipLevel: u.vipLevel ?? 0, vipBetPoints: u.vipBetPoints ?? 0, vipPointsWelcomePending: u.vipPointsWelcomePending ?? false, totalDeposited: u.totalDeposited ?? 0, blockedGames: u.blockedGames ?? [], referralCode: u.referralCode ?? null, hasPin: !!u.withdrawPin, commissionEarned: u.commissionEarned ?? 0, adminNote: u.adminNote ?? "",
  };
}
let _userPromise: Promise<CurrentUser | null> | null = null;
let _userPromiseTime = 0;
if (typeof window !== "undefined") {
  window.addEventListener("wx:session", () => { _userPromiseTime = 0; });
}

export async function getCurrentUser(force = false): Promise<CurrentUser | null> {
  if (isBrowser()) {
    const now = Date.now();
    if (!force && _userPromise && (now - _userPromiseTime < 5000)) {
      return _userPromise;
    }
    _userPromiseTime = now;
    _userPromise = (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.user) { await destroySession(); return null; }
        return data.user as CurrentUser;
      } catch {
        return null;
      }
    })();
    return _userPromise;
  }
  return null;
}
export async function requireRole(role: Role) {
  const u = await getCurrentUser();
  if (!u || u.role !== role) return null;
  return u;
}
