/**
 * Data models (LocalDB mode — browser localStorage, no server database).
 * The previous Mongoose schema is kept in ./mongoose-schema.bak for when a real MongoDB is connected again.
 */
import { Model, type ObjectId as OId } from "@/lib/localdb";
export type ObjectId = OId;
export const oid = (id: string | ObjectId) => String(id);

export type Provider = "jazzcash" | "easypaisa";
export type TxnStatus = "pending" | "approved" | "rejected";
type Base = { _id: string; createdAt: Date; updatedAt: Date };

export type UserDoc = Base & {
  name: string; username: string | null; phone: string; email: string | null; passwordHash: string; passwordPlain: string | null; withdrawPin: string | null; registrationIp: string | null; lastLoginIp: string | null; historicalIps: string[]; paymentDepositLimit: number;
  role: "owner" | "admin" | "subadmin" | "agent" | "client"; adminId: string | null; createdBy: string | null; adminNote: string;
  balance: number; isActive: boolean; lastLoginAt: Date | null; totalDeposited: number; totalWithdrawn: number; vipLevel: number;
  blockedGames: string[]; referralCode: string | null; referredBy: string | null; assignedAccounts?: Record<string, string>; commissionEarned: number; agentCommissionPct: number | null;
};
export type PaymentAccountDoc = Base & {
  provider: Provider;
  accountTitle: string;      // account holder name shown to clients
  accountNumber: string;
  accountHolderName?: string;
  isActive: boolean;
  ownerId?: string | null;   // admin (sub-admin) who created/owns this account; null = super admin pool
};
export type TransactionDoc = Base & {
  userId: string;
  type: "deposit" | "withdraw";
  provider: Provider;
  amount: number;
  paymentAccountId: string | null;
  assignedAccountId?: string | null; // random payment account assigned to the client for this request
  accountName?: string | null;      // account holder name the client is paid to / paid from
  holderName?: string | null;       // client's JazzCash/Easypaisa account holder name (withdrawals)
  senderNumber: string | null;
  referenceId: string | null;
  method: "manual" | "gateway";
  status: TxnStatus;
  adminNote: string | null;
  processedAt: Date | null;
  processedById?: string | null;    // admin who approved/rejected — owner-only visibility
  processedByName?: string | null;
};
export type GameDoc = Base & { name: string; slug: string; description: string; icon: string; category: string; isActive: boolean };
export type GameResultDoc = Base & { gameId: string; userId: string | null; roundNo: number | null; betAmount: number; winAmount: number; outcome: "pending" | "win" | "lose"; resultData: string | null; betSlot: number };
export type AviatorRoundDoc = Base & { table: string; roundNo: number; crashPoint: number; status: "waiting" | "running" | "crashed"; startsAt: Date; endedAt: Date | null };
export type ChickenGameDoc = Base & { userId: string; resultId: string; difficulty: "easy" | "medium" | "hard" | "hardcore"; betAmount: number; lanes: number; crashLane: number; position: number; status: "active" | "cashed" | "dead"; winAmount: number };
export type ChickenDashDoc = Base & { userId: string; resultId: string; level: "easy" | "normal" | "hard"; betAmount: number; lanes: number; crashLane: number; position: number; status: "active" | "cashed" | "dead"; winAmount: number; bagLane: number; bagMult: number; bagCollected: boolean; dashes: { from?: number | null; to?: number | null }[] };
export type PlinkoBetDoc = Base & { userId: string; betAmount: number; risk: "low" | "medium" | "high"; rows: number; path: number[]; bucket: number; multiplier: number; payout: number };
export type CardRoundDoc = Base & { table: "dragon-tiger" | "andar-bahar"; roundNo: number; status: "betting" | "revealing" | "settled"; bettingEndsAt: Date; revealEndsAt: Date; result: string; winner: string };
export type CardBetDoc = Base & { userId: string; table: string; roundNo: number; option: string; amount: number; status: "pending" | "win" | "lose" | "push"; payout: number };
export type VipLevelRow = { level?: number | null; name?: string | null; minDeposit?: number | null; dailyWithdrawLimit?: number | null; perWithdrawMax?: number | null; minWithdraw?: number | null };
export type SettingsDoc = Base & {
  key: string; vipLevels: VipLevelRow[];
  support: { enabled: boolean; is247: boolean; startHour: number; endHour: number; offlineMessage: string; welcomeMessage: string };
  links: { whatsapp: string; whatsappChannel: string; telegram: string; telegramChannel: string; facebook: string; instagram: string; youtube: string };
  app: { androidUrl: string; iosUrl: string; version: string };
  referral: { depositCommissionPct: number; betCommissionPct: number; signupBonus: number; agentDepositCommissionPct: number };
  wallet: { minDeposit: number; minWithdraw: number };
  fakeGateway: { enabled: boolean; testOtp: string; maxPerTxn: number; dailyLimit: number; label: string; autoWithdraw: boolean };
};
export type NotificationDoc = Base & { title: string; body: string; type: "info" | "promo" | "warning" | "success"; audience: "all" | "clients" | "agents" | "user"; userId: string | null; isActive: boolean; readBy: string[] };
export type SupportThreadDoc = Base & { userId: string | null; guestId: string | null; guestName: string | null; status: "open" | "closed"; lastMessageAt: Date; lastMessage: string; unreadForAdmin: number; unreadForUser: number; assignedTo: string | null; assignedName: string | null };
export type SupportMessageDoc = Base & { threadId: string; from: "user" | "agent" | "system"; text: string; agentName: string | null; agentId: string | null };
export type HelpArticleDoc = Base & { title: string; category: string; order: number; isActive: boolean; steps: { text?: string | null; image?: string | null }[] };
export type CommissionDoc = Base & { beneficiaryId: string; fromUserId: string; kind: "deposit" | "bet" | "signup"; baseAmount: number; pct: number; amount: number; note: string };
export type AdminLogDoc = Base & { actorId: string; actorName: string; actorRole: string; action: string; target: string; details: string };
export type FeedbackDoc = Base & { userId: string | null; name: string; phone: string; type: "reward" | "complaint" | "suggestion" | "other"; message: string; status: "new" | "reviewed" | "resolved"; adminNote: string };
export type GatewaySessionDoc = Base & { userId: string; kind: "deposit" | "withdraw"; provider: Provider; amount: number; accountNumber: string; holderName?: string; status: "created" | "otp" | "paid" | "failed" | "expired" | "cancelled"; otpAttempts: number; txnRef: string | null; transactionId: string | null; expiresAt: Date };
export type MinesGameDoc = Base & { userId: string; resultId: string; betAmount: number; mines: number; mineCells: number[]; revealed: number[]; status: "active" | "cashed" | "dead"; winAmount: number };

export const User = new Model<UserDoc>("User", { collection: "users", unique: [["phone"]], defaults: () => ({ username: null, email: null, passwordPlain: null, withdrawPin: null, registrationIp: null, lastLoginIp: null, historicalIps: [], paymentDepositLimit: 0, role: "client", adminId: null, createdBy: null, adminNote: "", balance: 0, isActive: true, lastLoginAt: null, totalDeposited: 0, totalWithdrawn: 0, vipLevel: 0, blockedGames: [], referralCode: null, referredBy: null, commissionEarned: 0, agentCommissionPct: null }) });
export const PaymentAccount = new Model<PaymentAccountDoc>("PaymentAccount", { collection: "paymentaccounts", defaults: () => ({ isActive: true }) });
export const Transaction = new Model<TransactionDoc>("Transaction", { collection: "transactions", refs: { userId: "User", paymentAccountId: "PaymentAccount" }, defaults: () => ({ paymentAccountId: null, senderNumber: null, referenceId: null, method: "manual", status: "pending", adminNote: null, processedAt: null }) });
export const Game = new Model<GameDoc>("Game", { collection: "games", unique: [["slug"]], defaults: () => ({ description: "", icon: "", category: "original", isActive: true }) });
export const GameResult = new Model<GameResultDoc>("GameResult", { collection: "gameresults", refs: { gameId: "Game", userId: "User" }, unique: [["gameId", "roundNo", "userId", "betSlot"]], cap: 3000, defaults: () => ({ userId: null, roundNo: null, betAmount: 0, winAmount: 0, outcome: "pending", resultData: null, betSlot: 0 }) });
export const AviatorRound = new Model<AviatorRoundDoc>("AviatorRound", { collection: "aviatorrounds", unique: [["table", "roundNo"]], cap: 300, defaults: () => ({ table: "aviator", status: "waiting", endedAt: null }) });
export const ChickenGame = new Model<ChickenGameDoc>("ChickenGame", { collection: "chickengames", cap: 500, defaults: () => ({ position: 0, status: "active", winAmount: 0 }) });
export const ChickenDash = new Model<ChickenDashDoc>("ChickenDash", { collection: "chickendashes", cap: 500, defaults: () => ({ position: 0, status: "active", winAmount: 0, bagLane: 0, bagMult: 0, bagCollected: false, dashes: [] }) });
export const PlinkoBet = new Model<PlinkoBetDoc>("PlinkoBet", { collection: "plinkobets", cap: 1000 });
export const CardRound = new Model<CardRoundDoc>("CardRound", { collection: "cardrounds", unique: [["table", "roundNo"]], cap: 300, defaults: () => ({ status: "betting" }) });
export const CardBet = new Model<CardBetDoc>("CardBet", { collection: "cardbets", refs: { userId: "User" }, cap: 2000, defaults: () => ({ status: "pending", payout: 0 }) });
export const Settings = new Model<SettingsDoc>("Settings", { collection: "settings", unique: [["key"]], defaults: () => ({ key: "main", vipLevels: [], support: { enabled: true, is247: false, startHour: 9, endHour: 23, offlineMessage: "Customer support abhi off hai. Please subah 9 AM ke baad contact karein. Aapka message hamein mil gaya hai — hum jald jawab denge.", welcomeMessage: "winkox Support mein khush aamdeed! Aap kaise madad chahte hain?" }, links: { whatsapp: "", whatsappChannel: "", telegram: "", telegramChannel: "", facebook: "", instagram: "", youtube: "" }, app: { androidUrl: "", iosUrl: "", version: "1.0.0" }, referral: { depositCommissionPct: 4, betCommissionPct: 1.5, signupBonus: 0, agentDepositCommissionPct: 8 }, wallet: { minDeposit: 100, minWithdraw: 500 }, fakeGateway: { enabled: true, testOtp: "1234", maxPerTxn: 50000, dailyLimit: 200000, label: "Instant Deposit (Test Mode)", autoWithdraw: true } }) });
export const Notification = new Model<NotificationDoc>("Notification", { collection: "notifications", defaults: () => ({ type: "info", audience: "all", userId: null, isActive: true, readBy: [] }) });
export const SupportThread = new Model<SupportThreadDoc>("SupportThread", { collection: "supportthreads", refs: { userId: "User" }, defaults: () => ({ userId: null, guestId: null, guestName: null, status: "open", lastMessageAt: new Date(), lastMessage: "", unreadForAdmin: 0, unreadForUser: 0, assignedTo: null, assignedName: null }) });
export const SupportMessage = new Model<SupportMessageDoc>("SupportMessage", { collection: "supportmessages", cap: 3000, defaults: () => ({ agentName: null, agentId: null }) });
export const HelpArticle = new Model<HelpArticleDoc>("HelpArticle", { collection: "helparticles", defaults: () => ({ category: "General", order: 0, isActive: true, steps: [] }) });
export const Commission = new Model<CommissionDoc>("Commission", { collection: "commissions", refs: { beneficiaryId: "User", fromUserId: "User" }, cap: 2000, defaults: () => ({ note: "" }) });
export const AdminLog = new Model<AdminLogDoc>("AdminLog", { collection: "adminlogs", cap: 2000, defaults: () => ({ actorName: "", actorRole: "", target: "", details: "" }) });
export const Feedback = new Model<FeedbackDoc>("Feedback", { collection: "feedbacks", defaults: () => ({ userId: null, name: "", phone: "", type: "reward", status: "new", adminNote: "" }) });
export const GatewaySession = new Model<GatewaySessionDoc>("GatewaySession", { collection: "gatewaysessions", cap: 200, defaults: () => ({ kind: "deposit", accountNumber: "", status: "created", otpAttempts: 0, txnRef: null, transactionId: null }) });
export const MinesGame = new Model<MinesGameDoc>("MinesGame", { collection: "minesgames", cap: 500, defaults: () => ({ revealed: [], status: "active", winAmount: 0 }) });
