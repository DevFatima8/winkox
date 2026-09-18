import { dbConnect } from "./mongo";
import { AviatorRound, Game, GameResult, User, oid, type AviatorRoundDoc, type ObjectId } from "@/models";
import { checkGameAccess } from "./gameAccess";
import { payBetCommission } from "./platform";

/** browser/node-safe random hex (provably-fair style seed) */
function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr); else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const TABLES = {
  aviator: { name: "Aviator", waitMs: 6000, pauseMs: 3500, growth: 0.06, houseEdge: 0.03, maxMult: 10000, slots: 2, minBet: 10, maxBet: 50000, maxWin: 1_000_000 },
  "aviator-x": { name: "Aviator X", waitMs: 6000, pauseMs: 3500, growth: 0.075, houseEdge: 0.03, maxMult: 10000, slots: 3, minBet: 10, maxBet: 50000, maxWin: 2_000_000 },
} as const;
export type Table = keyof typeof TABLES;
export const isTable = (t: string): t is Table => t in TABLES;

export function multiplierAt(table: Table, startsAt: Date, now: Date = new Date()) {
  const t = Math.max(0, (now.getTime() - startsAt.getTime()) / 1000);
  return Math.floor(Math.exp(TABLES[table].growth * t) * 100) / 100;
}

/**
 * Crash point generator.
 * Rules:
 *  • the round always starts at 1.01 (a crash before 1.01 never happens — 1.01 is the loss line)
 *  • long-term win/loss ratio: ~35% rounds are “win rounds” (≥2.00), ~65% are low rounds (1.01–1.99)
 *  • house edge inside win rounds keeps the RTP at ~97%
 * Server-side only — clients never choose the result.
 */
export function generateCrashPoint(table: Table) {
  const seed = randomHex(32);
  const h = randomHex(32);
  const n = parseInt(h.slice(0, 13), 16); // 52 bits
  const r = n / 2 ** 52; // uniform 0..1
  const cfg = TABLES[table];

  let cp: number;
  if (r < 0.65) {
    // LOSS ROUND (65%): low crash between 1.01 and 1.99. Most of these sit at 1.01.
    if (r < 0.30) cp = 1.01;
    else {
      // 0.30..0.65 → 1.01 .. 1.99, weighted toward the low end
      const k = (r - 0.30) / 0.35;
      cp = Math.floor((1.01 + Math.pow(k, 1.6) * 0.98) * 100) / 100;
    }
  } else {
    // WIN ROUND (35%): multiplier ≥ 2.00; 1/(1-u) distribution with the house edge.
    const u = (r - 0.65) / 0.35; // 0..1 uniform inside the win band
    const edge = cfg.houseEdge;
    cp = Math.min(cfg.maxMult, Math.max(2.0, Math.floor(((1 - edge) / (1 - u * (1 - edge))) * 100) / 100));
  }
  return { crashPoint: cp, seed, hash: h };
}

// ---- in-process mutex per table ----
const g = globalThis as typeof globalThis & { __aviatorLocks?: Record<string, Promise<void>> };
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  g.__aviatorLocks ??= {};
  const prev = g.__aviatorLocks[key] ?? Promise.resolve();
  let release!: () => void;
  g.__aviatorLocks[key] = new Promise<void>((res) => (release = res));
  await prev;
  try { return await fn(); } finally { release(); }
}

const gameIds: Partial<Record<Table, ObjectId>> = {};
export async function getGameId(table: Table) {
  if (gameIds[table]) return gameIds[table]!;
  await dbConnect();
  const gme = await Game.findOneAndUpdate(
    { slug: table },
    { $setOnInsert: { name: TABLES[table].name, slug: table, icon: table === "aviator" ? "✈️" : "🚀", category: "original", description: table === "aviator" ? "Plane udne se pehle cash out karein aur multiplier jeetein!" : "Aviator ka X edition — 3 bets, neon sky, 10,000x tak!", isActive: true } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  gameIds[table] = gme!._id;
  return gameIds[table]!;
}

type Round = AviatorRoundDoc;

async function advance(table: Table, gameId: ObjectId): Promise<Round> {
  const cfg = TABLES[table];
  const now = new Date();
  let r = await AviatorRound.findOne({ table }).sort({ roundNo: -1 }).lean<Round>();

  if (!r || (r.status === "crashed" && r.endedAt && now.getTime() - new Date(r.endedAt).getTime() >= cfg.pauseMs)) {
    const { crashPoint } = generateCrashPoint(table);
    let nextNo = (r?.roundNo ?? 0) + 1;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await AviatorRound.create({ table, roundNo: nextNo, crashPoint, status: "waiting", startsAt: new Date(now.getTime() + cfg.waitMs) });
        r = created.toObject() as Round;
        break;
      } catch (e) {
        const dup = (e as { code?: number })?.code === 11000;
        if (!dup) throw e;
        // someone else created it (or legacy index collision) → re-read latest and retry with next number
        const latest = await AviatorRound.findOne({ table }).sort({ roundNo: -1 }).lean<Round>();
        if (latest && latest.roundNo >= nextNo && latest.status !== "crashed") { r = latest; break; }
        nextNo = Math.max(nextNo, (latest?.roundNo ?? 0)) + 1;
        if (attempt === 4) throw e;
      }
    }
  }
  if (!r) throw new Error("Could not create round");
  if (r.status === "waiting" && now >= new Date(r.startsAt)) {
    await AviatorRound.updateOne({ _id: r._id, status: "waiting" }, { $set: { status: "running" } });
    r = { ...r, status: "running" };
  }
  if (r.status === "running" && multiplierAt(table, new Date(r.startsAt), now) >= r.crashPoint) {
    await AviatorRound.updateOne({ _id: r._id, status: "running" }, { $set: { status: "crashed", endedAt: now } });
    await GameResult.updateMany({ gameId, roundNo: r.roundNo, outcome: "pending" }, { $set: { outcome: "lose", resultData: `Flew away @ ${r.crashPoint.toFixed(2)}x` } });
    r = { ...r, status: "crashed", endedAt: now };
  }
  return r;
}

export async function withRound<T>(table: Table, fn: (round: Round, gameId: ObjectId) => Promise<T>) {
  await dbConnect();
  const gameId = await getGameId(table);
  return withLock(table, async () => fn(await advance(table, gameId), gameId));
}

const mask = (n?: string | null) => (n ? n.slice(0, 1) + "***" + n.slice(-1) : "P***r");

export async function getState(userId: string | null, table: Table) {
  const cfg = TABLES[table];
  const { round, gameId } = await withRound(table, async (round, gameId) => ({ round, gameId }));
  const [history, bets, me, topAgg, myHist] = await Promise.all([
    AviatorRound.find({ table, status: "crashed" }).sort({ roundNo: -1 }).limit(40).lean(),
    GameResult.find({ gameId, roundNo: round.roundNo }).sort({ betAmount: -1 }).limit(200).populate<{ userId: { _id: ObjectId; name: string } | null }>("userId", "name").lean(),
    userId ? User.findById(userId, "balance").lean() : null,
    GameResult.find({ gameId, outcome: "win" }).sort({ winAmount: -1 }).limit(20).populate<{ userId: { name: string } | null }>("userId", "name").lean(),
    userId ? GameResult.find({ gameId, userId: oid(userId), outcome: { $ne: "pending" } }).sort({ createdAt: -1 }).limit(30).lean() : [],
  ]);
  const myBets = userId ? bets.filter((b) => b.userId && String(b.userId._id) === userId) : [];
  const queued = userId ? await GameResult.find({ gameId, roundNo: round.roundNo + 1, userId: oid(userId), outcome: "pending" }).lean() : [];
  return {
    serverNow: Date.now(),
    table,
    config: { name: cfg.name, slots: cfg.slots, minBet: cfg.minBet, maxBet: cfg.maxBet, waitMs: cfg.waitMs, growth: cfg.growth, maxWin: cfg.maxWin },
    round: {
      id: round.roundNo,
      status: round.status as "waiting" | "running" | "crashed",
      startsAt: new Date(round.startsAt).getTime(),
      endedAt: round.endedAt ? new Date(round.endedAt).getTime() : null,
      crashPoint: round.status === "crashed" ? round.crashPoint : null,
    },
    history: history.map((h) => ({ id: h.roundNo, crashPoint: h.crashPoint })),
    bets: bets.map((b) => ({ id: String(b._id), name: mask(b.userId?.name), bet: b.betAmount, win: b.winAmount, outcome: b.outcome, data: b.resultData ?? null, mult: b.outcome === "win" ? Math.round((b.winAmount / b.betAmount) * 100) / 100 : null })),
    totals: { count: bets.length, amount: bets.reduce((s, b) => s + b.betAmount, 0), cashed: bets.filter((b) => b.outcome === "win").length },
    myBets: myBets.map((b) => ({ id: String(b._id), slot: b.betSlot ?? 0, bet: b.betAmount, win: b.winAmount, outcome: b.outcome, data: b.resultData ?? null })),
    queued: queued.map((b) => ({ slot: b.betSlot ?? 0, bet: b.betAmount })),
    myHistory: myHist.map((b) => ({ id: String(b._id), round: b.roundNo, bet: b.betAmount, win: b.winAmount, outcome: b.outcome, at: b.createdAt })),
    top: topAgg.map((b) => ({ name: mask(b.userId?.name), bet: b.betAmount, win: b.winAmount, mult: Math.round((b.winAmount / b.betAmount) * 100) / 100, round: b.roundNo })),
    balance: me?.balance ?? 0,
  };
}

export async function placeBet(userId: string, table: Table, amount: number, slot = 0) {
  const cfg = TABLES[table];
  if (!Number.isFinite(amount) || amount < cfg.minBet || amount > cfg.maxBet) return { error: `Bet Rs. ${cfg.minBet} se Rs. ${cfg.maxBet.toLocaleString()} ke darmiyan honi chahiye.` };
  if (slot < 0 || slot >= cfg.slots) return { error: "Invalid bet panel." };
  amount = Math.floor(amount);
  const denied = await checkGameAccess(userId, table);
  if (denied) return { error: denied };
  return withRound(table, async (round, gameId) => {
    const uid = oid(userId);
    // if betting is closed, the bet goes to the NEXT round (like real Aviator "waiting for next round")
    const targetRound = round.status === "waiting" ? round.roundNo : round.roundNo + 1;
    if (await GameResult.exists({ gameId, roundNo: targetRound, userId: uid, betSlot: slot })) return { error: "Bet already placed." };
    const r = await User.updateOne({ _id: uid, balance: { $gte: amount } }, { $inc: { balance: -amount } });
    if (r.modifiedCount === 0) return { error: "Insufficient balance." };
    try {
      await GameResult.create({ gameId, userId: uid, roundNo: targetRound, betAmount: amount, outcome: "pending", betSlot: slot });
      void payBetCommission(uid, amount);
    } catch {
      await User.updateOne({ _id: uid }, { $inc: { balance: amount } });
      return { error: "Could not place bet. Try again." };
    }
    return { ok: true, round: targetRound, queued: targetRound !== round.roundNo };
  });
}

export async function cancelBet(userId: string, table: Table, slot = 0) {
  return withRound(table, async (round, gameId) => {
    const rounds = round.status === "waiting" ? [round.roundNo, round.roundNo + 1] : [round.roundNo + 1];
    const b = await GameResult.findOneAndDelete({ gameId, roundNo: { $in: rounds }, userId: oid(userId), betSlot: slot, outcome: "pending" });
    if (!b) return { error: "No bet found." };
    await User.updateOne({ _id: oid(userId) }, { $inc: { balance: b.betAmount } });
    return { ok: true };
  });
}

export async function cashOut(userId: string, table: Table, slot = 0) {
  const cfg = TABLES[table];
  return withRound(table, async (round, gameId) => {
    if (round.status !== "running") return { error: round.status === "crashed" ? "Flew away!" : "Round not started." };
    const m = multiplierAt(table, new Date(round.startsAt));
    if (m >= round.crashPoint) return { error: "Flew away!" };
    const b = await GameResult.findOne({ gameId, roundNo: round.roundNo, userId: oid(userId), betSlot: slot, outcome: "pending" });
    if (!b) return { error: "No active bet." };
    const win = Math.min(cfg.maxWin, Math.floor(b.betAmount * m * 100) / 100);
    const upd = await GameResult.updateOne({ _id: b._id, outcome: "pending" }, { $set: { outcome: "win", winAmount: win, resultData: `Cashed out @ ${m.toFixed(2)}x` } });
    if (upd.modifiedCount === 0) return { error: "Already processed." };
    await User.updateOne({ _id: oid(userId) }, { $inc: { balance: win } });
    return { ok: true, multiplier: m, win };
  });
}
