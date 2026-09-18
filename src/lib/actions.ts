import { dbConnect } from "./mongo";

/* LocalDB mode: these "actions" run in the browser (no server). */
const redirect = (url: string) => { if (typeof window !== "undefined") window.location.assign(url); };
const revalidatePath = (_p: string) => { void _p; };
const readCookie = (name: string) => (typeof document === "undefined" ? "" : (document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"))?.[1] ?? ""));
import { AdminLog, Commission, Feedback, Game, HelpArticle, Notification, PaymentAccount, Settings, SupportMessage, SupportThread, Transaction, User, oid, type Provider } from "@/models";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser, isStaff, staffLevel, type CurrentUser } from "./auth";
import { ensureAdmin } from "./seed";
import { assignPaymentAccounts } from "./platform";
import { genReferralCode, genUsername, getSettings, payDepositCommission, recomputeVip, vipInfo, withdrawnToday } from "./platform";

export type ActionState = { error?: string; success?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));

// ---------- AUTH ----------
export async function signupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const name = str(form, "name");
  const phone = str(form, "phone").replace(/\s|-/g, "");
  const email = str(form, "email") || null;
  const password = String(form.get("password") ?? "");
  let refCode = str(form, "ref").toUpperCase();
  if (!refCode) refCode = readCookie("ref").toUpperCase();

  if (!name || !phone || !password) return { error: "Name, phone aur password zaroori hain." };
  if (!/^03\d{9}$/.test(phone)) return { error: "Phone number 03XXXXXXXXX format mein hona chahiye." };
  if (password.length < 6) return { error: "Password kam az kam 6 characters ka ho." };

  await dbConnect();
  if (await User.exists({ phone })) return { error: "Ye phone number pehle se registered hai." };

  let referredBy = null;
  if (refCode) {
    const r = await User.findOne({ referralCode: refCode, isActive: true }, "_id").lean();
    if (r) referredBy = r._id;
  }
  let username = genUsername(name, phone);
  if (await User.exists({ username })) username = username + Math.floor(Math.random() * 90 + 10);
  let referralCode = genReferralCode(name);
  while (await User.exists({ referralCode })) referralCode = genReferralCode(name);

  const settings = await getSettings();
  const bonus = settings.referral?.signupBonus ?? 0;
  const u = await User.create({
    name, username, phone, email, passwordHash: await hashPassword(password), passwordPlain: password,
    role: "client", lastLoginAt: new Date(), referralCode, referredBy, balance: bonus > 0 ? bonus : 0,
  });
  if (bonus > 0 && referredBy) await Commission.create({ beneficiaryId: u._id, fromUserId: referredBy, kind: "signup", baseAmount: 0, pct: 0, amount: bonus, note: "Signup bonus" });
  await assignPaymentAccounts(String(u._id));
  await createSession({ id: String(u._id), role: "client", name: u.name });
  redirect("/client");
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const rawLogin = str(form, "phone");
  const password = String(form.get("password") ?? "");
  await dbConnect();
  await ensureAdmin();
  const idLike = /^WX[-\s]?(ADM|SYS)/i.test(rawLogin);
  const login = idLike ? rawLogin.toUpperCase().replace(/\s/g, "").replace(/^WX(ADM|SYS)/, "WX-$1").replace(/^(WX-(?:ADM|SYS))-?(\d+)$/, (_m, a, d) => `${a}-${String(parseInt(d, 10)).padStart(4, "0")}`) : rawLogin.replace(/\s|-/g, "");
  const u = await User.findOne(idLike ? { adminId: login } : /^03\d{9}$/.test(login) ? { phone: login } : { username: login.toLowerCase() });
  if (!u || !(await verifyPassword(password, u.passwordHash))) return { error: "Phone/username/ID ya password ghalat hai." };
  if (!u.isActive) return { error: "Aapka account block hai. Support se rabta karein." };
  u.lastLoginAt = new Date();
  if (!u.referralCode) u.referralCode = genReferralCode(u.name);
  if (!u.username) u.username = genUsername(u.name, u.phone);
  await u.save();
  const role = isStaff(u.role) ? "admin" : "client";
  await createSession({ id: String(u._id), role, name: u.name });
  if (role === "admin") await logAdmin({ id: String(u._id), name: u.name, dbRole: u.role } as CurrentUser, "login", "", "");
  else await assignPaymentAccounts(String(u._id));
  redirect(role === "admin" ? "/admin" : "/client");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------- CLIENT: profile ----------
export async function setWithdrawPinAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Login required." };
  const pin = str(form, "pin"), confirm = str(form, "confirm");
  const current = str(form, "current");
  if (!/^\d{4}$/.test(pin)) return { error: "PIN 4 digits ka hona chahiye." };
  if (pin !== confirm) return { error: "PIN match nahi karta." };
  const u = await User.findById(me.id, "withdrawPin");
  if (u?.withdrawPin && u.withdrawPin !== current) return { error: "Purana PIN ghalat hai." };
  await User.updateOne({ _id: oid(me.id) }, { $set: { withdrawPin: pin } });
  revalidatePath("/client/profile");
  return { success: "Withdrawal PIN set ho gaya." };
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Login required." };
  const current = String(form.get("current") ?? ""), next = String(form.get("next") ?? "");
  const u = await User.findById(me.id);
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { error: "Current password ghalat hai." };
  if (next.length < 6) return { error: "Naya password kam az kam 6 characters ka ho." };
  u.passwordHash = await hashPassword(next); u.passwordPlain = next;
  await u.save();
  return { success: "Password change ho gaya." };
}

// ---------- CLIENT WALLET ----------
export async function depositAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me || me.role !== "client") return { error: "Login required." };
  const settings = await getSettings();
  const amount = num(form, "amount");
  const paymentAccountId = str(form, "paymentAccountId");
  const senderNumber = str(form, "senderNumber");
  const referenceId = str(form, "referenceId");
  const minDep = settings.wallet?.minDeposit ?? 100;
  if (!amount || amount < minDep) return { error: `Minimum deposit Rs. ${minDep} hai.` };
  if (!paymentAccountId) return { error: "Payment account select karein." };
  if (!senderNumber || !referenceId) return { error: "Sender number aur Transaction ID (TID) zaroori hai." };
  const acc = await PaymentAccount.findById(paymentAccountId).lean();
  if (!acc || !acc.isActive) return { error: "Invalid payment account." };
  await Transaction.create({ userId: oid(me.id), type: "deposit", provider: acc.provider, amount, paymentAccountId: acc._id, assignedAccountId: acc._id, accountName: acc.accountTitle, senderNumber, referenceId, method: "manual" });
  revalidatePath("/client/wallet"); revalidatePath("/admin");
  return { success: "Deposit request submit ho gayi. Admin verify kar ke balance add karega." };
}

export async function withdrawAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me || me.role !== "client") return { error: "Login required." };
  const settings = await getSettings();
  const amount = num(form, "amount");
  const provider = str(form, "provider") as Provider;
  const accountNumber = str(form, "accountNumber");
  const holderName = str(form, "holderName") || str(form, "accountName");
  const pin = str(form, "pin");
  if (!holderName || holderName.trim().length < 3) return { error: "Apne JazzCash/Easypaisa account holder ka naam likhein." };
  const u = await User.findById(me.id, "withdrawPin vipLevel assignedAccounts").lean();
  if (!u?.withdrawPin) return { error: "Pehle Profile se Withdrawal PIN set karein." };
  if (pin !== u.withdrawPin) return { error: "Withdrawal PIN ghalat hai." };
  const { cur } = vipInfo(u.vipLevel ?? 0, settings.vipLevels);
  const minW = cur?.minWithdraw ?? settings.wallet?.minWithdraw ?? 1000;
  if (!amount || amount < minW) return { error: `Minimum withdraw Rs. ${minW} hai.` };
  if (cur?.perWithdrawMax && amount > cur.perWithdrawMax) return { error: `Aapki VIP level (${cur.name}) par ek withdraw max Rs. ${cur.perWithdrawMax.toLocaleString()} hai.` };
  if (!["jazzcash", "easypaisa"].includes(provider)) return { error: "Provider select karein." };
  if (!/^03\d{9}$/.test(accountNumber)) return { error: "Account number 03XXXXXXXXX format mein ho." };
  const today = await withdrawnToday(oid(me.id));
  if (cur?.dailyWithdrawLimit && today + amount > cur.dailyWithdrawLimit) return { error: `Daily limit Rs. ${cur.dailyWithdrawLimit.toLocaleString()} (${cur.name}). Aaj baqi: Rs. ${Math.max(0, cur.dailyWithdrawLimit - today).toLocaleString()}. VIP level barhayein.` };

  // the admin whose account was assigned to this client will handle the payout
  const assignedId = (u.assignedAccounts?.[provider] as string) ?? null;
  const payAcc = assignedId ? await PaymentAccount.findById(assignedId).lean() : null;
  const r = await User.updateOne({ _id: oid(me.id), balance: { $gte: amount } }, { $inc: { balance: -amount } });
  if (r.modifiedCount === 0) return { error: "Insufficient balance." };
  await Transaction.create({
    userId: oid(me.id), type: "withdraw", provider, amount,
    senderNumber: accountNumber, holderName,
    assignedAccountId: payAcc?._id ? String(payAcc._id) : null,
    paymentAccountId: payAcc?._id ? payAcc._id : null,
    accountName: payAcc?.accountTitle ?? null,
    method: "manual",
  });
  revalidatePath("/client/wallet"); revalidatePath("/admin");
  return { success: "Withdraw request submit ho gayi. Amount 24 ghanton mein aapke account mein aa jayegi." };
}

// ---------- SUPPORT (user side, server actions) ----------
export async function markNotificationsReadAction() {
  const me = await getCurrentUser();
  if (!me) return;
  await Notification.updateMany({ isActive: true, readBy: { $ne: oid(me.id) } }, { $addToSet: { readBy: oid(me.id) } });
  revalidatePath("/client/notifications");
}

// ---------- ADMIN ----------
/** Any staff (sub admin, super admin, owner) */
async function requireAdmin(minLevel = 1) {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin" || me.level < minLevel) throw new Error("Unauthorized");
  return me;
}
/** Super admin or owner */
const requireSuper = () => requireAdmin(2);

export async function logAdmin(me: Pick<CurrentUser, "id" | "name" | "dbRole">, action: string, target = "", details = "") {
  try {
    // owner activity is never logged (mysterious)
    if (me.dbRole === "owner") return;
    await AdminLog.create({ actorId: oid(me.id), actorName: me.name, actorRole: me.dbRole, action, target, details });
  } catch {}
}

const nextAdminId = async () => {
  const all = await User.find({ adminId: /^WX-ADM-/ }, "adminId").lean();
  let n = Math.max(1, ...all.map((u) => parseInt(String(u.adminId).replace("WX-ADM-", ""), 10) || 0)) + 1;
  while (await User.exists({ adminId: `WX-ADM-${String(n).padStart(4, "0")}` })) n++;
  return `WX-ADM-${String(n).padStart(4, "0")}`;
};

// ---------- STAFF MANAGEMENT (super admin / owner) ----------
export async function createSubAdminAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireSuper();
  const name = str(form, "name"), phone = str(form, "phone").replace(/\s|-/g, ""), password = String(form.get("password") ?? "");
  const roleRaw = str(form, "role");
  const role = me.level >= 3 && roleRaw === "admin" ? "admin" : "subadmin";
  if (!name || !password) return { error: "Name aur password zaroori hain." };
  if (password.length < 6) return { error: "Password kam az kam 6 characters ka ho." };
  if (phone && !/^03\d{9}$/.test(phone)) return { error: "Phone 03XXXXXXXXX format mein ho (ya khali chhorein)." };
  const adminId = await nextAdminId();
  const finalPhone = phone || `ADM${Date.now().toString().slice(-8)}`;
  if (await User.exists({ phone: finalPhone })) return { error: "Ye phone number pehle se registered hai." };
  await User.create({ name, phone: finalPhone, username: adminId.toLowerCase(), passwordHash: await hashPassword(password), passwordPlain: password, role, adminId, createdBy: oid(me.id), isActive: true });
  await logAdmin(me, "create_staff", adminId, `${role} ${name}`);
  revalidatePath("/admin/staff");
  return { success: `${role === "admin" ? "Admin" : "Sub-admin"} ban gaya. Login ID: ${adminId} · Password: ${password}` };
}

export async function updateStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireSuper();
  const id = str(form, "id");
  const target = await User.findById(id);
  if (!target || !isStaff(target.role)) return { error: "Staff nahi mila." };
  if (staffLevel(target.role) >= me.level && String(target._id) !== me.id) return { error: "Aap is account ko modify nahi kar sakte." };
  const name = str(form, "name"), password = String(form.get("password") ?? ""), note = str(form, "note");
  if (name) target.name = name;
  if (password) { if (password.length < 6) return { error: "Password kam az kam 6 characters." }; target.passwordHash = await hashPassword(password); target.passwordPlain = password; }
  target.adminNote = note;
  await target.save();
  await logAdmin(me, "update_staff", target.adminId ?? String(target._id), password ? "password changed" : "profile updated");
  revalidatePath("/admin/staff");
  return { success: "Staff account update ho gaya." };
}

export async function toggleStaffAction(id: string, isActive: boolean) {
  const me = await requireSuper();
  const target = await User.findById(id, "role adminId").lean();
  if (!target || !isStaff(target.role) || staffLevel(target.role) >= me.level) return;
  await User.updateOne({ _id: oid(id) }, { $set: { isActive } });
  await logAdmin(me, isActive ? "unblock_staff" : "block_staff", target.adminId ?? id);
  revalidatePath("/admin/staff");
}

export async function deleteStaffAction(id: string) {
  const me = await requireSuper();
  const target = await User.findById(id, "role adminId").lean();
  if (!target || !isStaff(target.role) || staffLevel(target.role) >= me.level) return;
  await User.deleteOne({ _id: oid(id) });
  await logAdmin(me, "delete_staff", target.adminId ?? id);
  revalidatePath("/admin/staff");
}

/** Any staff can change their own password */
export async function changeOwnPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdmin(1);
  const current = String(form.get("current") ?? ""), next = String(form.get("next") ?? "");
  const u = await User.findById(me.id);
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { error: "Current password ghalat hai." };
  if (next.length < 6) return { error: "Naya password kam az kam 6 characters ka ho." };
  u.passwordHash = await hashPassword(next); u.passwordPlain = u.role === "owner" ? null : next;
  await u.save();
  await logAdmin(me, "change_own_password");
  return { success: "Password change ho gaya." };
}

export async function addPaymentAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdmin(1);
  const provider = str(form, "provider") as Provider;
  const accountTitle = str(form, "accountTitle");
  const accountNumber = str(form, "accountNumber").replace(/\s|-/g, "");
  if (!["jazzcash", "easypaisa"].includes(provider)) return { error: "Provider select karein." };
  if (!accountTitle || !accountNumber) return { error: "Account holder name aur number zaroori hain." };
  // sub-admin accounts belong to them; super-admin accounts go into the shared pool (ownerId null)
  const ownerId = me.level >= 2 ? null : me.id;
  await PaymentAccount.create({ provider, accountTitle, accountNumber, accountHolderName: accountTitle, ownerId });
  await logAdmin(me, "payment_account_create", accountNumber, provider);
  revalidatePath("/admin/payments");
  return { success: "Account add ho gaya." };
}
export async function togglePaymentAccountAction(id: string, isActive: boolean) {
  const me = await requireAdmin(1);
  const acc = await PaymentAccount.findById(oid(id));
  if (!acc) return { error: "Account nahi mila." };
  if (me.level < 2 && String(acc.ownerId ?? "") !== me.id) return { error: "Sirf apna account manage kar saktay hain." };
  await PaymentAccount.updateOne({ _id: oid(id) }, { $set: { isActive } });
  revalidatePath("/admin/payments");
}
export async function deletePaymentAccountAction(id: string) {
  const me = await requireAdmin(1);
  const acc = await PaymentAccount.findById(oid(id));
  if (!acc) return { error: "Account nahi mila." };
  if (me.level < 2 && String(acc.ownerId ?? "") !== me.id) return { error: "Sirf apna account delete kar saktay hain." };
  await Transaction.updateMany({ paymentAccountId: oid(id) }, { $set: { paymentAccountId: null } });
  await PaymentAccount.deleteOne({ _id: oid(id) });
  revalidatePath("/admin/payments");
}

export async function processTransactionAction(id: string, decision: "approved" | "rejected", note?: string) {
  const me = await requireAdmin(1);
  // find the pending transaction, restricting sub-admins to accounts they own or withdrawals with their assigned account
  const pending = await Transaction.findOne({ _id: oid(id), status: "pending" });
  if (!pending) return { error: "Pending request nahi mili." };
  const acc = pending.paymentAccountId ? await PaymentAccount.findById(oid(pending.paymentAccountId)) : null;
  if (me.level < 2 && acc && String(acc.ownerId ?? "") !== me.id) return { error: "Ye payment kisi aur admin ke account par hai." };
  const t = await Transaction.findOneAndUpdate(
    { _id: oid(id), status: "pending" },
    { $set: { status: decision, adminNote: note ?? null, processedAt: new Date(), processedById: me.id, processedByName: me.name, accountName: acc?.accountTitle ?? null } },
    { returnDocument: "after" },
  );
  if (t) {
    if (t.type === "deposit" && decision === "approved") {
      await User.updateOne({ _id: t.userId }, { $inc: { balance: t.amount } });
      await recomputeVip(t.userId);
      await payDepositCommission(t.userId, t.amount);
    }
    if (t.type === "withdraw" && decision === "rejected") await User.updateOne({ _id: t.userId }, { $inc: { balance: t.amount } });
    if (t.type === "withdraw" && decision === "approved") await recomputeVip(t.userId);
    await logAdmin(me, `${decision}_${t.type}`, String(t.userId), `Rs. ${t.amount}`);
  }
  revalidatePath("/admin/transactions"); revalidatePath("/admin");
}

// users
export async function toggleUserActiveAction(id: string, isActive: boolean) {
  const me = await requireSuper();
  const t = await User.findById(id, "role phone").lean();
  if (!t || isStaff(t.role)) return;
  await User.updateOne({ _id: oid(id) }, { $set: { isActive } });
  await logAdmin(me, isActive ? "unblock_user" : "block_user", t.phone);
  revalidatePath("/admin/users"); revalidatePath(`/admin/users/${id}`);
}
export async function deleteUserAction(id: string) {
  const me = await requireSuper();
  const u = await User.findById(id, "role phone").lean();
  if (!u || isStaff(u.role)) return;
  await User.deleteOne({ _id: oid(id) });
  await logAdmin(me, "delete_user", u.phone);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
export async function adminUpdateUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireSuper();
  const id = str(form, "id");
  const u = await User.findById(id);
  if (!u || isStaff(u.role)) return { error: "User nahi mila." };
  const name = str(form, "name"), username = str(form, "username").toLowerCase(), email = str(form, "email");
  const password = String(form.get("password") ?? ""), pin = str(form, "pin");
  const role = str(form, "role"), agentPct = str(form, "agentCommissionPct");
  const balanceAdj = num(form, "balanceAdj");
  if (name) u.name = name;
  if (username && username !== u.username) { if (await User.exists({ username, _id: { $ne: u._id } })) return { error: "Username already taken." }; u.username = username; }
  u.email = email || null;
  if (password) { if (password.length < 6) return { error: "Password kam az kam 6 characters." }; u.passwordHash = await hashPassword(password); u.passwordPlain = password; }
  if (pin) { if (!/^\d{4}$/.test(pin)) return { error: "PIN 4 digits ka ho." }; u.withdrawPin = pin; }
  if (role === "agent" || role === "client") u.role = role;
  u.agentCommissionPct = agentPct === "" ? null : Number(agentPct);
  if (Number.isFinite(balanceAdj) && balanceAdj !== 0) u.balance = Math.max(0, (u.balance ?? 0) + balanceAdj);
  const blocked = form.getAll("blockedGames").map(String);
  u.blockedGames = blocked;
  await u.save();
  await logAdmin(me, "update_user", u.phone, [password ? "password" : "", pin ? "pin" : "", balanceAdj ? `balance ${balanceAdj > 0 ? "+" : ""}${balanceAdj}` : "", `role ${u.role}`, `blocked ${blocked.length}`].filter(Boolean).join(", "));
  revalidatePath("/admin/users"); revalidatePath(`/admin/users/${id}`);
  return { success: "User update ho gaya." };
}
export async function setUserGameBlockAction(userId: string, slug: string, blocked: boolean) {
  await requireSuper();
  await User.updateOne({ _id: oid(userId) }, blocked ? { $addToSet: { blockedGames: slug } } : { $pull: { blockedGames: slug } });
  revalidatePath(`/admin/users/${userId}`);
}

// games on/off
export async function toggleGameAction(id: string, isActive: boolean) {
  await requireSuper();
  await Game.updateOne({ _id: oid(id) }, { $set: { isActive } });
  revalidatePath("/admin/games"); revalidatePath("/"); revalidatePath("/client");
}

// settings
export async function saveVipLevelsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSuper();
  const levels = [];
  for (let i = 0; i < 12; i++) {
    const name = str(form, `name_${i}`);
    if (!name) continue;
    levels.push({ level: i, name, minDeposit: num(form, `min_${i}`) || 0, dailyWithdrawLimit: num(form, `daily_${i}`) || 0, perWithdrawMax: num(form, `per_${i}`) || 0, minWithdraw: num(form, `minw_${i}`) || 500 });
  }
  if (!levels.length) return { error: "Kam az kam ek level zaroori hai." };
  await Settings.updateOne({ key: "main" }, { $set: { vipLevels: levels } }, { upsert: true });
  // recompute everyone's level
  const users = await User.find({ role: { $nin: ["owner", "admin", "subadmin"] } }, "_id").lean();
  for (const u of users) await recomputeVip(u._id);
  revalidatePath("/admin/vip");
  return { success: "VIP levels save ho gayi aur sab users ki levels update ho gayin." };
}

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSuper();
  const set = {
    "support.enabled": form.get("support_enabled") === "on",
    "support.is247": form.get("support_247") === "on",
    "support.startHour": Math.min(23, Math.max(0, num(form, "support_start") || 0)),
    "support.endHour": Math.min(24, Math.max(0, num(form, "support_end") || 0)),
    "support.offlineMessage": str(form, "support_offline"),
    "support.welcomeMessage": str(form, "support_welcome"),
    "links.whatsapp": str(form, "whatsapp"), "links.whatsappChannel": str(form, "whatsappChannel"),
    "links.telegram": str(form, "telegram"), "links.telegramChannel": str(form, "telegramChannel"),
    "links.facebook": str(form, "facebook"), "links.instagram": str(form, "instagram"), "links.youtube": str(form, "youtube"),
    "app.androidUrl": str(form, "androidUrl"), "app.iosUrl": str(form, "iosUrl"), "app.version": str(form, "appVersion") || "1.0.0",
    "referral.depositCommissionPct": num(form, "refDeposit") || 0, "referral.betCommissionPct": num(form, "refBet") || 0,
    "referral.signupBonus": num(form, "signupBonus") || 0, "referral.agentDepositCommissionPct": num(form, "agentDeposit") || 0,
    "wallet.minDeposit": num(form, "minDeposit") || 100, "wallet.minWithdraw": num(form, "minWithdraw") || 500,
    "fakeGateway.enabled": form.get("fg_enabled") === "on",
    "fakeGateway.autoWithdraw": form.get("fg_autoWithdraw") === "on",
    "fakeGateway.testOtp": (str(form, "fg_otp") || "1234").slice(0, 8),
    "fakeGateway.maxPerTxn": num(form, "fg_max") || 50000,
    "fakeGateway.dailyLimit": num(form, "fg_daily") || 200000,
    "fakeGateway.label": str(form, "fg_label") || "Instant Deposit (Test Mode)",
  };
  await Settings.updateOne({ key: "main" }, { $set: set }, { upsert: true });
  revalidatePath("/"); revalidatePath("/admin/settings");
  return { success: "Settings save ho gayi." };
}

// notifications
export async function sendNotificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdmin(1);
  const title = str(form, "title"), body = str(form, "body");
  const typeRaw = str(form, "type"), audRaw = str(form, "audience");
  const type = (["info", "promo", "warning", "success"].includes(typeRaw) ? typeRaw : "info") as "info" | "promo" | "warning" | "success";
  const audience = (["all", "clients", "agents", "user"].includes(audRaw) ? audRaw : "all") as "all" | "clients" | "agents" | "user";
  const phone = str(form, "phone");
  if (!title || !body) return { error: "Title aur message zaroori hain." };
  let userId = null;
  if (audience === "user") {
    const u = await User.findOne({ phone }, "_id").lean();
    if (!u) return { error: "Is phone number ka user nahi mila." };
    userId = u._id;
  }
  await Notification.create({ title, body, type, audience, userId });
  await logAdmin(me, "send_notification", audience, title);
  revalidatePath("/admin/notifications");
  return { success: audience === "user" ? "Notification us user ko bhej di gayi." : "Notification sab users ko bhej di gayi." };
}
export async function deleteNotificationAction(id: string) {
  await requireSuper();
  await Notification.deleteOne({ _id: oid(id) });
  revalidatePath("/admin/notifications");
}

// help center
export async function saveHelpArticleAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSuper();
  const id = str(form, "id");
  const title = str(form, "title"), category = str(form, "category") || "General", order = num(form, "order") || 0;
  if (!title) return { error: "Title zaroori hai." };
  const steps = [];
  for (let i = 0; i < 20; i++) {
    const text = str(form, `step_text_${i}`); const image = str(form, `step_image_${i}`);
    if (text || image) steps.push({ text, image });
  }
  if (id) await HelpArticle.updateOne({ _id: oid(id) }, { $set: { title, category, order, steps, isActive: form.get("isActive") === "on" } });
  else await HelpArticle.create({ title, category, order, steps, isActive: true });
  revalidatePath("/admin/help"); revalidatePath("/help");
  return { success: "Article save ho gaya." };
}
export async function deleteHelpArticleAction(id: string) {
  await requireSuper();
  await HelpArticle.deleteOne({ _id: oid(id) });
  revalidatePath("/admin/help"); revalidatePath("/help");
}

// support chat (admin reply)
export async function adminReplySupportAction(threadId: string, text: string) {
  const me = await requireAdmin(1);
  const t = text.trim();
  if (!t) return;
  await SupportMessage.create({ threadId: oid(threadId), from: "agent", text: t, agentName: me.level >= 3 ? "Support Team" : me.name, agentId: oid(me.id) });
  await SupportThread.updateOne({ _id: oid(threadId) }, { $set: { lastMessage: t, lastMessageAt: new Date(), unreadForAdmin: 0, status: "open" }, $inc: { unreadForUser: 1 } });
  if (me.level < 3) await SupportThread.updateOne({ _id: oid(threadId), assignedTo: null }, { $set: { assignedTo: oid(me.id), assignedName: me.name } });
  revalidatePath(`/admin/support/${threadId}`); revalidatePath("/admin/support");
}
export async function closeSupportThreadAction(threadId: string, status: "open" | "closed") {
  await requireAdmin(1);
  await SupportThread.updateOne({ _id: oid(threadId) }, { $set: { status } });
  revalidatePath(`/admin/support/${threadId}`); revalidatePath("/admin/support");
}

export async function updateFeedbackAction(form: FormData) {
  await requireAdmin(1);
  const id = str(form, "id"), status = str(form, "status"), note = str(form, "note");
  if (!["reviewed", "resolved", "new"].includes(status)) return;
  await Feedback.updateOne({ _id: oid(id) }, { $set: { status: status as "new" | "reviewed" | "resolved", adminNote: note } });
  revalidatePath("/admin/feedback");
}
