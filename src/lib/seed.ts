import { dbConnect } from "./mongo";
import { isMysqlEnabled } from "./mysql";
import { Game, HelpArticle, PaymentAccount, Settings, User } from "@/models";
import { DEFAULT_HELP, DEFAULT_VIP } from "./platform";

const envStr = (name: string, fallback = "") => process.env[name]?.trim() || fallback;
const envNum = (name: string, fallback = 0) => {
  const v = Number(process.env[name] ?? fallback);
  return Number.isFinite(v) ? v : fallback;
};

const SUPER_ADMIN = {
  role: "admin",
  name: envStr("SUPER_ADMIN_NAME", "Super Admin"),
  phone: envStr("SUPER_ADMIN_PHONE", "03000000000"),
  username: envStr("SUPER_ADMIN_USERNAME", "superadmin"),
  adminId: envStr("SUPER_ADMIN_ID", "WX-ADM-0001"),
  password: envStr("SUPER_ADMIN_PASSWORD", "admin123"),
  level: 2,
};

/** ===== DEFAULT LOGIN ACCOUNTS (Real database mode only) ===== */
export const DEFAULT_ACCOUNTS = isMysqlEnabled()
  ? [{ role: "admin", name: SUPER_ADMIN.name, phone: SUPER_ADMIN.phone, username: SUPER_ADMIN.username, adminId: SUPER_ADMIN.adminId, password: SUPER_ADMIN.password }]
  : [{ role: "admin", name: SUPER_ADMIN.name, phone: SUPER_ADMIN.phone, username: SUPER_ADMIN.username, adminId: SUPER_ADMIN.adminId, password: SUPER_ADMIN.password }];

export async function cleanupDemoAccounts() {
  const demoFilters = [
    { username: { $in: ["system", "wx-adm-0002", "agent", "demo"] } },
    { adminId: { $in: ["WX-SYS-0000", "WX-ADM-0002"] } },
    { phone: { $in: ["03999999999", "03000000001", "03007654321", "03001234567", "03211112222"] } },
    { name: { $in: ["System", "Ahmed Support", "Bilal Agent", "Demo Client"] } },
  ];

  await User.deleteMany({ $or: demoFilters });
}

export async function ensureAdmin() {
  const superAdmin = SUPER_ADMIN;
  const existing = await User.findOne({ $or: [{ phone: superAdmin.phone }, { adminId: superAdmin.adminId }, { username: superAdmin.username }] }).lean();
  if (!existing) {
    await User.create({
      name: superAdmin.name,
      phone: superAdmin.phone,
      username: superAdmin.username,
      adminId: superAdmin.adminId,
      role: "admin",
      passwordHash: "plain:" + superAdmin.password,
      passwordPlain: superAdmin.password,
      referralCode: null,
      balance: 0,
      totalDeposited: 0,
      vipLevel: 0,
      withdrawPin: null,
      referredBy: null,
      isActive: true,
      paymentDepositLimit: envNum("SUPER_ADMIN_DEPOSIT_LIMIT", 0),
      lastLoginAt: null,
      createdBy: null,
      adminNote: "Super admin created from environment variables",
    });
  }

  if (isMysqlEnabled()) {
    await cleanupDemoAccounts();
    return;
  }

  await cleanupDemoAccounts();
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
