import { dbConnect } from "./mongo";
import { Game, HelpArticle, PaymentAccount, Settings, User } from "@/models";
import { DEFAULT_HELP, DEFAULT_VIP } from "./platform";

/** ===== DEFAULT LOGIN ACCOUNTS (LocalDB / demo mode) ===== */
export const DEFAULT_ACCOUNTS = [
  { role: "owner", name: "System", phone: "03999999999", username: "system", adminId: "WX-SYS-0000", password: "owner@winkox" },
  { role: "admin", name: "Super Admin", phone: "03000000000", username: "superadmin", adminId: "WX-ADM-0001", password: "admin123" },
  { role: "subadmin", name: "Ahmed Support", phone: "03000000001", username: "wx-adm-0002", adminId: "WX-ADM-0002", password: "subadmin123" },
  { role: "agent", name: "Bilal Agent", phone: "03007654321", username: "agent", adminId: null, password: "agent123", referralCode: "AGENT01", balance: 5000 },
  { role: "client", name: "Demo Client", phone: "03001234567", username: "demo", adminId: null, password: "client123", referralCode: "DEMO01", balance: 50000, pin: "1234" },
  { role: "client", name: "Ali Khan", phone: "03211112222", username: "ali", adminId: null, password: "ali123", referralCode: "ALI001", balance: 12000, pin: "1111", referredBy: "AGENT01" },
] as const;

export async function ensureAdmin() {
  for (const a of DEFAULT_ACCOUNTS) {
    if (await User.exists({ phone: a.phone })) continue;
    const ref = "referredBy" in a && a.referredBy ? await User.findOne({ referralCode: a.referredBy }).lean() : null;
    const balance = "balance" in a ? a.balance : 0;
    await User.create({
      name: a.name, phone: a.phone, username: a.username, adminId: a.adminId, role: a.role, passwordHash: "plain:" + a.password, passwordPlain: a.role === "owner" ? null : a.password,
      referralCode: "referralCode" in a ? a.referralCode : null, balance, totalDeposited: a.role === "client" ? balance : 0, vipLevel: a.role === "client" ? (balance >= 20000 ? 4 : balance >= 5000 ? 3 : balance >= 1000 ? 2 : balance >= 300 ? 1 : 0) : 0,
      withdrawPin: "pin" in a ? a.pin : null, referredBy: ref ? String(ref._id) : null, isActive: true,
    });
  }
}

const GAMES = [
  { slug: "aviator", name: "Aviator", icon: "✈️", category: "original", description: "Plane udne se pehle cash out karein aur multiplier jeetein!" },
  { slug: "aviator-x", name: "Aviator X", icon: "🚀", category: "original", description: "Aviator ka X edition — 3 bets, neon sky, 10,000x tak!" },
  { slug: "chicken-road-2", name: "Chicken Road 2", icon: "🐔", category: "original", description: "Chicken ko road cross karwayein — har lane par multiplier barhta hai!" },
  { slug: "chicken-dash", name: "Chicken Dash", icon: "🐤", category: "original", description: "Busy highway cross karein — Dash boost aur Bonus Bag ke saath 100x tak!" },
  { slug: "plinko", name: "Plinko", icon: "🔴", category: "original", description: "Ball girao, pegs se takra kar multiplier bucket mein — 100x tak!" },
  { slug: "limbo", name: "Limbo", icon: "🎯", category: "original", description: "Target multiplier set karein — 100x tak instant result!" },
  { slug: "mines", name: "Mines", icon: "💎", category: "original", description: "5×5 grid, mines choose karein, gems kholen aur cash out — 10,000x tak!" },
  { slug: "lucky-777", name: "Lucky 777", icon: "🎰", category: "original", description: "Classic 3-reel slot — 7 7 7 par jackpot!" },
  { slug: "dragon-tiger", name: "Dragon Tiger", icon: "🐉", category: "wg-cards", description: "Live table — Dragon, Tiger ya Tie par bet lagayein. Bara card jeet-ta hai!" },
  { slug: "andar-bahar", name: "Andar Bahar", icon: "🃏", category: "wg-cards", description: "Live table — Joker ka match Andar aayega ya Bahar? Predict karein aur jeetein!" },
];
export async function ensureGames() {
  for (const g of GAMES) if (!(await Game.exists({ slug: g.slug }))) await Game.create({ ...g, isActive: true });
}
export async function ensureHelp() { if ((await HelpArticle.countDocuments()) === 0) await HelpArticle.insertMany(DEFAULT_HELP as never); }
export async function ensureSettings() { if (!(await Settings.exists({ key: "main" }))) await Settings.create({ key: "main", vipLevels: DEFAULT_VIP }); }
export async function ensurePaymentAccounts() {
  if ((await PaymentAccount.countDocuments()) === 0) {
    await PaymentAccount.insertMany([{ provider: "jazzcash", accountTitle: "winkox Official", accountNumber: "03035433872", isActive: true }, { provider: "easypaisa", accountTitle: "winkox Official", accountNumber: "03035433872", isActive: true }]);
  }
}

let done = false;
export async function seedAll() {
  if (done) return;
  done = true;
  await ensureAdmin(); await ensureGames(); await ensureSettings(); await ensureHelp(); await ensurePaymentAccounts();
}
export { dbConnect };
