import { dbConnect } from "./mongo";
import { GatewaySession, Transaction, User, oid } from "@/models";
import { getSettings, payDepositCommission, recomputeVip, vipInfo, withdrawnToday } from "./platform";
import { notifyUser } from "./notifications";

const TTL_MS = 10 * 60 * 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function gatewayConfig() {
  const s = await getSettings();
  const g: { enabled?: boolean; autoWithdraw?: boolean; testOtp?: string; maxPerTxn?: number; dailyLimit?: number; label?: string } = s.fakeGateway ?? {};
  return { enabled: g.enabled ?? true, autoWithdraw: g.autoWithdraw ?? true, testOtp: g.testOtp ?? "1234", maxPerTxn: g.maxPerTxn ?? 50000, dailyLimit: g.dailyLimit ?? 200000, label: g.label ?? "Instant Deposit (Test Mode)", minDeposit: s.wallet?.minDeposit ?? 100, minWithdraw: s.wallet?.minWithdraw ?? 1000, vipLevels: s.vipLevels };
}

async function usedToday(userId: string, kind: "deposit" | "withdraw") {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [agg] = await Transaction.aggregate<{ s: number }>([{ $match: { userId: oid(userId), type: kind, method: "gateway", status: "approved", createdAt: { $gte: since } } }, { $group: { _id: null, s: { $sum: "$amount" } } }]);
  return agg?.s ?? 0;
}

export async function createSession(userId: string, kind: "deposit" | "withdraw", provider: "jazzcash" | "easypaisa", amount: number, accountNumber: string, pin?: string, holderName = "") {
  await dbConnect();
  const cfg = await gatewayConfig();
  if (!cfg.enabled) return { error: "Test gateway abhi band hai." };
  if (kind === "withdraw" && !cfg.autoWithdraw) return { error: "Instant test withdraw band hai." };
  if (!["jazzcash", "easypaisa"].includes(provider)) return { error: "Provider select karein." };
  amount = Math.floor(Number(amount));
  const min = kind === "deposit" ? cfg.minDeposit : cfg.minWithdraw;
  if (!Number.isFinite(amount) || amount < min) return { error: `Minimum Rs. ${min} hai.` };
  if (amount > cfg.maxPerTxn) return { error: `Ek transaction max Rs. ${cfg.maxPerTxn.toLocaleString()} (test limit).` };
  if (!/^03\d{9}$/.test(accountNumber)) return { error: "Account number 03XXXXXXXXX format mein ho." };
  const used = await usedToday(userId, kind);
  if (used + amount > cfg.dailyLimit) return { error: `Test gateway daily limit Rs. ${cfg.dailyLimit.toLocaleString()} — aaj baqi Rs. ${Math.max(0, cfg.dailyLimit - used).toLocaleString()}.` };
  const u = await User.findById(userId, "balance withdrawPin vipLevel isActive").lean();
  if (!u || !u.isActive) return { error: "Account block hai." };
  if (kind === "deposit" && u.paymentDepositLimit && u.paymentDepositLimit > 0) {
    const [used] = await Transaction.aggregate<{ s: number }>([{ $match: { userId: oid(userId), type: "deposit", status: { $in: ["pending", "approved"] } } }, { $group: { _id: null, s: { $sum: "$amount" } } }]);
    if ((used?.s ?? 0) + amount > u.paymentDepositLimit) return { error: `Payment lock active hai. Total deposit limit Rs. ${u.paymentDepositLimit.toLocaleString()} hai; baqi Rs. ${Math.max(0, u.paymentDepositLimit - (used?.s ?? 0)).toLocaleString()} hai.` };
  }
  if (kind === "withdraw") {
    if (!holderName || holderName.trim().length < 3) return { error: "Apne account holder ka naam likhein." };
    if (!u.withdrawPin) return { error: "Pehle Profile se Withdrawal PIN set karein." };
    if (pin !== u.withdrawPin) return { error: "Withdrawal PIN ghalat hai." };
    if ((u.balance ?? 0) < amount) return { error: "Insufficient balance." };
    const { cur } = vipInfo(u.vipLevel ?? 0, cfg.vipLevels);
    if (cur?.perWithdrawMax && amount > cur.perWithdrawMax) return { error: `VIP limit: ek withdraw max Rs. ${cur.perWithdrawMax.toLocaleString()}.` };
    const today = await withdrawnToday(oid(userId));
    if (cur?.dailyWithdrawLimit && today + amount > cur.dailyWithdrawLimit) return { error: `VIP daily withdraw limit Rs. ${cur.dailyWithdrawLimit.toLocaleString()}.` };
  }
  await GatewaySession.updateMany({ userId: oid(userId), status: { $in: ["created", "otp"] } }, { $set: { status: "cancelled" } });
  const sess = await GatewaySession.create({ userId: oid(userId), kind, provider, amount, accountNumber, holderName, expiresAt: new Date(Date.now() + TTL_MS) });
  return { ok: true, id: String(sess._id) };
}

export async function getSession(userId: string, id: string) {
  await dbConnect();
  const s = await GatewaySession.findOne({ _id: oid(id), userId: oid(userId) }).lean();
  if (!s) return null;
  if (["created", "otp"].includes(s.status) && s.expiresAt.getTime() < Date.now()) { await GatewaySession.updateOne({ _id: s._id }, { $set: { status: "expired" } }); s.status = "expired"; }
  const cfg = await gatewayConfig();
  return { id: String(s._id), kind: s.kind, provider: s.provider, amount: s.amount, accountNumber: s.accountNumber, status: s.status, txnRef: s.txnRef, expiresAt: s.expiresAt.getTime(), testOtp: cfg.testOtp, attemptsLeft: 3 - (s.otpAttempts ?? 0) };
}

export async function sendOtp(userId: string, id: string) {
  await dbConnect();
  const s = await GatewaySession.findOne({ _id: oid(id), userId: oid(userId), status: "created" });
  if (!s) return { error: "Session invalid ya expired." };
  s.status = "otp"; await s.save();
  return { ok: true };
}

export async function verifyOtp(userId: string, id: string, otp: string) {
  await dbConnect();
  const cfg = await gatewayConfig();
  const s = await GatewaySession.findOne({ _id: oid(id), userId: oid(userId), status: "otp" });
  if (!s) return { error: "Session invalid ya expired." };
  if (s.expiresAt.getTime() < Date.now()) { s.status = "expired"; await s.save(); return { error: "Session expire ho gayi. Dobara try karein." }; }
  if (otp.trim() !== cfg.testOtp) {
    s.otpAttempts = (s.otpAttempts ?? 0) + 1;
    if (s.otpAttempts >= 3) { s.status = "failed"; await s.save(); return { error: "3 ghalat OTP — payment failed.", failed: true }; }
    await s.save();
    return { error: `OTP ghalat hai. ${3 - s.otpAttempts} attempts baqi.` };
  }
  const uid = oid(userId);
  const ref = `TST${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  if (s.kind === "deposit") {
    const u = await User.findById(uid, "assignedAccounts paymentDepositLimit").lean();
    if (u?.paymentDepositLimit && u.paymentDepositLimit > 0) {
      const [used] = await Transaction.aggregate<{ s: number }>([{ $match: { userId: uid, type: "deposit", status: { $in: ["pending", "approved"] } } }, { $group: { _id: null, s: { $sum: "$amount" } } }]);
      if ((used?.s ?? 0) + s.amount > u.paymentDepositLimit) { s.status = "failed"; await s.save(); return { error: `Payment lock active hai. Total deposit limit Rs. ${u.paymentDepositLimit.toLocaleString()} cross ho gayi.`, failed: true }; }
    }
    const assignedId = (u?.assignedAccounts?.[s.provider] as string) ?? null;
    const acc = assignedId ? await import("@/models").then(() => null) : null; void acc;
    const tx = await Transaction.create({ userId: uid, type: "deposit", provider: s.provider, amount: s.amount, senderNumber: s.accountNumber, assignedAccountId: assignedId, paymentAccountId: assignedId, referenceId: ref, method: "gateway", status: "approved", adminNote: "Test gateway (instant)", processedAt: new Date(), processedByName: "System (test gateway)" });
    await User.updateOne({ _id: uid }, { $inc: { balance: s.amount } });
    await recomputeVip(uid);
    await payDepositCommission(uid, s.amount);
    await notifyUser(userId, "Purchase successful", `Your instant deposit of Rs. ${s.amount.toLocaleString()} has been added to your balance.`, "success");
    s.transactionId = tx._id;
  } else {
    const upd = await User.updateOne({ _id: uid, balance: { $gte: s.amount } }, { $inc: { balance: -s.amount } });
    if (!upd.modifiedCount) { s.status = "failed"; await s.save(); return { error: "Insufficient balance.", failed: true }; }
    const tx = await Transaction.create({ userId: uid, type: "withdraw", provider: s.provider, amount: s.amount, senderNumber: s.accountNumber, holderName: s.holderName ?? "", accountName: "Client payout", referenceId: ref, method: "gateway", status: "approved", adminNote: "Auto-approved test payout", processedAt: new Date(), processedByName: "System (test gateway)" });
    await recomputeVip(uid);
    await notifyUser(userId, "Withdrawal approved", `Your instant withdrawal of Rs. ${s.amount.toLocaleString()} has been approved and processed.`, "success");
    s.transactionId = tx._id;
  }
  s.status = "paid"; s.txnRef = ref; await s.save();
  const me = await User.findById(uid, "balance").lean();
  return { ok: true, txnRef: ref, balance: r2(me?.balance ?? 0) };
}

export async function cancelSession(userId: string, id: string) {
  await dbConnect();
  await GatewaySession.updateOne({ _id: oid(id), userId: oid(userId), status: { $in: ["created", "otp"] } }, { $set: { status: "cancelled" } });
  return { ok: true };
}
