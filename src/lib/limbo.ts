import { dbConnect } from "./mongo";
import { Game, GameResult, User, oid, type ObjectId } from "@/models";
import { checkGameAccess } from "./gameAccess";
import { payBetCommission } from "./platform";

/** browser/node-safe random hex (provably-fair style seed) */
function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr); else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const MIN_BET = 10, MAX_BET = 50000, MAX_WIN = 2_000_000;
export const RTP = 0.99; // Stake Limbo: 99% RTP (1% house edge)
export const MIN_TARGET = 1.01, MAX_TARGET = 1_000_000;

let cachedGameId: ObjectId | null = null;
async function gameId() {
  if (cachedGameId) return cachedGameId;
  const g = await Game.findOneAndUpdate({ slug: "limbo" }, { $setOnInsert: { name: "Limbo", slug: "limbo", icon: "🎯", category: "original", description: "Target multiplier set karein — 1,000,000x tak instant result!", isActive: true } }, { upsert: true, returnDocument: "after" }).lean();
  cachedGameId = g!._id; return cachedGameId;
}

/** Stake-style: result = floor((2^52 * RTP) / (h+1) * 100)/100, min 1.00 */
export function roll() {
  const hex = randomHex(32);
  const h = parseInt(hex.slice(0, 13), 16);
  const raw = (2 ** 52 * RTP) / (h + 1);
  const result = Math.max(1, Math.floor(Math.min(raw, MAX_TARGET) * 100) / 100);
  return { result, hash: hex };
}

export const winChance = (target: number) => Math.min(99, Math.max(0, (RTP / target) * 100));

export async function getState(userId: string | null) {
  await dbConnect();
  const gid = await gameId();
  const [me, recent] = userId ? await Promise.all([User.findById(userId, "balance").lean(), GameResult.find({ gameId: gid, userId: oid(userId) }).sort({ createdAt: -1 }).limit(30).lean()]) : [null, []];
  return {
    balance: me?.balance ?? 0,
    limits: { min: MIN_BET, max: MAX_BET, minTarget: MIN_TARGET, maxTarget: MAX_TARGET, rtp: RTP },
    recent: recent.map((r) => { const m = r.resultData?.match(/result ([\d.]+)x.*target ([\d.]+)x/); return { id: String(r._id), bet: r.betAmount, win: r.winAmount, outcome: r.outcome, result: m ? Number(m[1]) : 0, target: m ? Number(m[2]) : 0, at: r.createdAt }; }),
  };
}

export async function play(userId: string, amount: number, target: number) {
  await dbConnect();
  if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) return { error: `Bet Rs. ${MIN_BET} se Rs. ${MAX_BET.toLocaleString()} ke darmiyan honi chahiye.` };
  target = Math.floor(Number(target) * 100) / 100;
  if (!Number.isFinite(target) || target < MIN_TARGET || target > MAX_TARGET) return { error: `Target ${MIN_TARGET}x se ${MAX_TARGET.toLocaleString()}x ke darmiyan ho.` };
  amount = Math.floor(amount);
  const denied = await checkGameAccess(userId, "limbo");
  if (denied) return { error: denied };
  const uid = oid(userId);
  const upd = await User.updateOne({ _id: uid, balance: { $gte: amount } }, { $inc: { balance: -amount } });
  if (!upd.modifiedCount) return { error: "Insufficient balance." };
  void payBetCommission(uid, amount);
  const { result, hash } = roll();
  const won = result >= target;
  const payout = won ? Math.min(MAX_WIN, Math.floor(amount * target * 100) / 100) : 0;
  if (payout > 0) await User.updateOne({ _id: uid }, { $inc: { balance: payout } });
  const gid = await gameId();
  await GameResult.create({ gameId: gid, userId: uid, betAmount: amount, winAmount: payout, outcome: won ? "win" : "lose", resultData: `result ${result}x · target ${target}x · ${hash.slice(0, 10)}` });
  const me = await User.findById(uid, "balance").lean();
  return { ok: true, result, target, won, payout, balance: me?.balance ?? 0, hash: hash.slice(0, 16) };
}
