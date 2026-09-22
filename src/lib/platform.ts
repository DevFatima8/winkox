import { dbConnect } from "./mongo";
import { Commission, HelpArticle, PaymentAccount, Settings, Transaction, User, type PaymentAccountDoc, type SettingsDoc, type UserDoc, type ObjectId } from "@/models";

// VIP defaults modelled on 9K-style tiers (PKR). Admin can edit in panel.
export const DEFAULT_VIP = [
  { level: 0, name: "Bronze", minDeposit: 0, dailyWithdrawLimit: 5000, perWithdrawMax: 5000, minWithdraw: 1000 },
  { level: 1, name: "Silver", minDeposit: 300, dailyWithdrawLimit: 15000, perWithdrawMax: 10000, minWithdraw: 1000 },
  { level: 2, name: "Gold", minDeposit: 1000, dailyWithdrawLimit: 30000, perWithdrawMax: 20000, minWithdraw: 1000 },
  { level: 3, name: "Platinum", minDeposit: 5000, dailyWithdrawLimit: 60000, perWithdrawMax: 40000, minWithdraw: 1000 },
  { level: 4, name: "Diamond", minDeposit: 20000, dailyWithdrawLimit: 150000, perWithdrawMax: 100000, minWithdraw: 1000 },
  { level: 5, name: "Royal", minDeposit: 50000, dailyWithdrawLimit: 300000, perWithdrawMax: 200000, minWithdraw: 1000 },
  { level: 6, name: "Legend", minDeposit: 150000, dailyWithdrawLimit: 1000000, perWithdrawMax: 500000, minWithdraw: 1000 },
];

export type VipLevel = (typeof DEFAULT_VIP)[number];

export async function getSettings(): Promise<SettingsDoc> {
  await dbConnect();
  let s = await Settings.findOne({ key: "main" }).lean<SettingsDoc>();
  if (!s) {
    s = (await Settings.create({ key: "main", vipLevels: DEFAULT_VIP })).toObject() as SettingsDoc;
  } else if (!s.vipLevels || s.vipLevels.length === 0) {
    await Settings.updateOne({ key: "main" }, { $set: { vipLevels: DEFAULT_VIP } });
    s = { ...s, vipLevels: DEFAULT_VIP as SettingsDoc["vipLevels"] };
  }
  return s;
}

export function vipFor(totalDeposited: number, levels: { level?: number | null; minDeposit?: number | null }[]) {
  let lvl = 0;
  for (const l of levels) if ((l.minDeposit ?? 0) <= totalDeposited && (l.level ?? 0) > lvl) lvl = l.level ?? 0;
  return lvl;
}

export function vipInfo(level: number, levels: SettingsDoc["vipLevels"]) {
  const sorted = [...levels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const cur = sorted.find((l) => l.level === level) ?? sorted[0];
  const next = sorted.find((l) => (l.level ?? 0) > level) ?? null;
  return { cur, next, all: sorted };
}

/** Recalculate a user's VIP level from approved deposits. */
export async function recomputeVip(userId: ObjectId) {
  const s = await getSettings();
  const [agg] = await Transaction.aggregate<{ dep: number; wd: number }>([
    { $match: { userId, status: "approved" } },
    { $group: { _id: null, dep: { $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] } }, wd: { $sum: { $cond: [{ $eq: ["$type", "withdraw"] }, "$amount", 0] } } } },
  ]);
  const dep = agg?.dep ?? 0, wd = agg?.wd ?? 0;
  const level = vipFor(dep, s.vipLevels);
  await User.updateOne({ _id: userId }, { $set: { totalDeposited: dep, totalWithdrawn: wd, vipLevel: level } });
  return { dep, wd, level };
}

/** Today's approved+pending withdrawals for a user (PKT day). */
export async function withdrawnToday(userId: ObjectId) {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
  const start = new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate()) - 5 * 3600 * 1000);
  const [agg] = await Transaction.aggregate<{ s: number }>([
    { $match: { userId, type: "withdraw", status: { $in: ["approved", "pending"] }, createdAt: { $gte: start } } },
    { $group: { _id: null, s: { $sum: "$amount" } } },
  ]);
  return agg?.s ?? 0;
}

/** Pay referral / agent commission on an approved deposit. */
export async function payDepositCommission(depositorId: ObjectId, amount: number) {
  const dep = await User.findById(depositorId, "referredBy name").lean();
  if (!dep?.referredBy) return;
  const ref = await User.findById(dep.referredBy, "role agentCommissionPct isActive").lean();
  if (!ref || !ref.isActive) return;
  const s = await getSettings();
  const pct = ref.role === "agent" ? (ref.agentCommissionPct ?? s.referral?.agentDepositCommissionPct ?? 8) : (s.referral?.depositCommissionPct ?? 4);
  if (pct <= 0) return;
  const c = Math.round(amount * pct) / 100;
  if (c <= 0) return;
  await User.updateOne({ _id: ref._id }, { $inc: { balance: c, commissionEarned: c } });
  await Commission.create({ beneficiaryId: ref._id, fromUserId: depositorId, kind: "deposit", baseAmount: amount, pct, amount: c, note: `Deposit commission from ${dep.name}` });
}

/** Pay bet commission (called from game engines on each settled bet). Fire-and-forget safe. */
export async function payBetCommission(bettorId: ObjectId, betAmount: number) {
  try {
    const dep = await User.findById(bettorId, "referredBy name").lean();
    if (!dep?.referredBy) return;
    const s = await getSettings();
    const pct = s.referral?.betCommissionPct ?? 1.5;
    if (pct <= 0) return;
    const c = Math.round(betAmount * pct) / 100;
    if (c < 0.01) return;
    await User.updateOne({ _id: dep.referredBy, isActive: true }, { $inc: { balance: c, commissionEarned: c } });
    await Commission.create({ beneficiaryId: dep.referredBy, fromUserId: bettorId, kind: "bet", baseAmount: betAmount, pct, amount: c, note: `Bet commission from ${dep.name}` });
  } catch { }
}

export function genReferralCode(name: string) {
  const base = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "WINKOX";
  return base + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function genUsername(name: string, phone: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "player";
  return `${base}${phone.slice(-4)}`;
}

/** Support hours check (Pakistan time). */
export function supportOnline(sup: SettingsDoc["support"], now = new Date()) {
  if (!sup?.enabled) return false;
  if (sup.is247) return true;
  const h = (now.getUTCHours() + 5) % 24;
  const start = sup.startHour ?? 9, end = sup.endHour ?? 23;
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

export const DEFAULT_HELP = [
  {
    title: "Deposit kaise karein?", category: "Deposit", order: 1,
    steps: [
      { text: "Login karein aur neeche 'Deposit' par tap karein (ya Wallet page kholen).", image: "" },
      { text: "Payment method select karein — JazzCash ya Easypaisa. Aapko admin ka account number aur title dikhega.", image: "" },
      { text: "Apni JazzCash/Easypaisa app se us number par amount send karein (minimum Rs. 100).", image: "" },
      { text: "Wapas aa kar amount, apna sender number aur Transaction ID (TID) likh kar 'Submit Deposit Request' dabayein.", image: "" },
      { text: "Admin verify karke 5–30 minute mein balance add kar deta hai. Status 'My History' mein dekhein.", image: "" },
    ],
  },
  {
    title: "Withdraw kaise karein?", category: "Withdraw", order: 2,
    steps: [
      { text: "Wallet page par 'Withdraw' section kholen.", image: "" },
      { text: "Provider (JazzCash/Easypaisa), apna account number aur amount likhein (minimum Rs. 500). Apni VIP level ki daily limit dekh lein.", image: "" },
      { text: "Apna 4-digit Withdrawal PIN enter karein (pehli baar Profile se set karein).", image: "" },
      { text: "Request submit karein — amount 24 ghanton mein aapke account mein aa jayegi.", image: "" },
    ],
  },
  {
    title: "VIP level kaise barhayein?", category: "Account", order: 3,
    steps: [
      { text: "Aapki total approved deposits ke hisaab se VIP level automatic barhta hai (Silver 300, Gold 1,000, Platinum 5,000 ...).", image: "" },
      { text: "Zyada VIP level = zyada daily withdrawal limit. Profile page par apni level aur agli level ka target dekhein.", image: "" },
    ],
  },
  {
    title: "Invite karke commission kaise kamayein?", category: "Account", order: 4,
    steps: [
      { text: "Profile page par apna referral link copy karein aur doston ko bhejein.", image: "" },
      { text: "Jab aapka dost deposit karega to aapko deposit commission milega, aur uski har bet par bet commission bhi.", image: "" },
      { text: "Commission seedha aapke wallet balance mein add hota hai — 'My Team' section mein details dekhein.", image: "" },
    ],
  },
];

export async function ensureHelp() {
  await dbConnect();
  if ((await HelpArticle.countDocuments()) === 0) await HelpArticle.insertMany(DEFAULT_HELP);
}

/**
 * Assign one random active payment account per provider to a client (called on login / signup).
 * Sub-admin owned accounts are included so deposits land to whichever admin the system assigns.
 * Stable: keeps existing assignment while that account is active.
 */
const oid = (id: string): ObjectId => (String(id).startsWith("oid-") ? (String(id) as unknown as ObjectId) : (id as unknown as ObjectId));

export async function assignPaymentAccounts(userId: string): Promise<Record<string, string>> {
  await dbConnect();
  const user = await User.findById(oid(userId)).lean<UserDoc>();
  const existing = (user?.assignedAccounts ?? {}) as Record<string, string>;
  const accounts = await PaymentAccount.find({ isActive: true }).lean<PaymentAccountDoc[]>();
  const next: Record<string, string> = {};
  for (const provider of ["jazzcash", "easypaisa"]) {
    const cur = existing[provider];
    if (cur && accounts.some((a) => String(a._id) === String(cur) && a.isActive)) {
      next[provider] = String(cur);
      continue;
    }
    const pool = accounts.filter((a) => a.provider === provider);
    if (pool.length) next[provider] = String(pool[Math.floor(Math.random() * pool.length)]._id);
  }
  if (JSON.stringify(next) !== JSON.stringify(existing)) {
    await User.updateOne({ _id: oid(userId) }, { $set: { assignedAccounts: next } });
  }
  return next;
}
