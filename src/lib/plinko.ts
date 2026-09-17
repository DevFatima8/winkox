import { dbConnect } from "./mongo";
import { Game, GameResult, PlinkoBet, User, oid, type ObjectId } from "@/models";
import { checkGameAccess } from "./gameAccess";
import { payBetCommission } from "./platform";


export const MIN_BET = 10;
export const MAX_BET = 50000;
export const MAX_WIN = 10_000_000;
export const ROWS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export type Risk = "low" | "medium" | "high";
export const isRisk = (r: string): r is Risk => r === "low" || r === "medium" || r === "high";

// Official Stake Plinko payout tables (symmetric, listed left→right). RTP ≈ 99%.
export const TABLES: Record<Risk, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    9: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export function multipliersFor(risk: Risk, rows: number) {
  return TABLES[risk][rows];
}

/** Binomial probability of landing in bucket k for n rows. */
export function bucketProb(rows: number, k: number) {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (rows - k + i)) / i;
  return c / Math.pow(2, rows);
}

let cachedGameId: ObjectId | null = null;
async function gameId() {
  if (cachedGameId) return cachedGameId;
  const g = await Game.findOneAndUpdate(
    { slug: "plinko" },
    { $setOnInsert: { name: "Plinko", slug: "plinko", icon: "🔴", category: "original", description: "Ball girao, pegs se takra kar multiplier bucket mein — 1000x tak!", isActive: true } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  cachedGameId = g!._id;
  return cachedGameId;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function getState(userId: string | null) {
  await dbConnect();
  const [me, recent] = userId
    ? await Promise.all([User.findById(userId, "balance").lean(), PlinkoBet.find({ userId: oid(userId) }).sort({ createdAt: -1 }).limit(30).lean()])
    : [null, []];
  return {
    balance: me?.balance ?? 0,
    limits: { min: MIN_BET, max: MAX_BET },
    rows: ROWS,
    tables: TABLES,
    recent: recent.map((b) => ({ id: String(b._id), bet: b.betAmount, risk: b.risk, rows: b.rows, multiplier: b.multiplier, payout: b.payout, bucket: b.bucket })),
  };
}

export async function drop(userId: string, amount: number, risk: string, rows: number) {
  await dbConnect();
  if (!isRisk(risk)) return { error: "Risk select karein." };
  if (!ROWS.includes(rows as (typeof ROWS)[number])) return { error: "Rows 8 se 16 ke darmiyan hon." };
  if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) return { error: `Bet Rs. ${MIN_BET} se Rs. ${MAX_BET} ke darmiyan honi chahiye.` };
  amount = Math.floor(amount);
  const denied = await checkGameAccess(userId, "plinko");
  if (denied) return { error: denied };
  const uid = oid(userId);

  const upd = await User.updateOne({ _id: uid, balance: { $gte: amount } }, { $inc: { balance: -amount } });
  if (!upd.modifiedCount) return { error: "Insufficient balance. Pehle deposit karein." };

  // Fair RNG: each row an independent 50/50 bounce (binomial distribution = real Plinko)
  const path: number[] = [];
  let bucket = 0;
  for (let i = 0; i < rows; i++) {
    const dir = Math.random() < 0.5 ? 0 : 1;
    path.push(dir);
    bucket += dir;
  }
  const multiplier = multipliersFor(risk, rows)[bucket];
  const payout = Math.min(MAX_WIN, r2(amount * multiplier));

  if (payout > 0) await User.updateOne({ _id: uid }, { $inc: { balance: payout } });
  void payBetCommission(uid, amount);
  const bet = await PlinkoBet.create({ userId: uid, betAmount: amount, risk, rows, path, bucket, multiplier, payout });
  const gid = await gameId();
  await GameResult.create({
    gameId: gid, userId: uid, betAmount: amount, winAmount: payout,
    outcome: payout >= amount ? "win" : "lose",
    resultData: `${risk} · ${rows} rows · bucket ${bucket + 1}/${rows + 1} → ${multiplier}x`,
  });
  const me = await User.findById(uid, "balance").lean();
  return { ok: true, id: String(bet._id), path, bucket, multiplier, payout, balance: me?.balance ?? 0 };
}
