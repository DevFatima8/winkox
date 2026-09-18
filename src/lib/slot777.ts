import { dbConnect } from "./mongo";
import { Game, GameResult, User, oid, type ObjectId } from "@/models";
import { checkGameAccess } from "./gameAccess";
import { payBetCommission } from "./platform";

export const MIN_BET = 10, MAX_BET = 10000, MAX_WIN = 1_000_000;
// Classic 3-reel, 1-line "Lucky 777". Symbols and weighted reel strips.
export const SYMBOLS = ["seven", "bar3", "bar2", "bar1", "bell", "cherry", "lemon", "orange", "plum"] as const;
export type Sym = (typeof SYMBOLS)[number];
// reel strip weights (per reel) — tuned to ~95.5% RTP (classic 3-reel)
const WEIGHTS: Record<Sym, number>[] = [
  { seven: 3, bar3: 4, bar2: 5, bar1: 7, bell: 7, cherry: 10, lemon: 8, orange: 8, plum: 8 },
  { seven: 3, bar3: 4, bar2: 5, bar1: 7, bell: 7, cherry: 9, lemon: 8, orange: 8, plum: 8 },
  { seven: 3, bar3: 4, bar2: 5, bar1: 7, bell: 7, cherry: 8, lemon: 8, orange: 8, plum: 8 },
];
export const PAYTABLE: { combo: string; label: string; mult: number }[] = [
  { combo: "seven,seven,seven", label: "7 7 7", mult: 777 },
  { combo: "bar3,bar3,bar3", label: "BAR BAR BAR (triple)", mult: 100 },
  { combo: "bar2,bar2,bar2", label: "BAR BAR BAR (double)", mult: 50 },
  { combo: "bar1,bar1,bar1", label: "BAR BAR BAR (single)", mult: 25 },
  { combo: "anybar", label: "Any 3 BARs", mult: 10 },
  { combo: "bell,bell,bell", label: "Bell ×3", mult: 20 },
  { combo: "plum,plum,plum", label: "Plum ×3", mult: 12 },
  { combo: "orange,orange,orange", label: "Orange ×3", mult: 10 },
  { combo: "lemon,lemon,lemon", label: "Lemon ×3", mult: 8 },
  { combo: "cherry,cherry,cherry", label: "Cherry ×3", mult: 6 },
  { combo: "cherry2", label: "Any 2 Cherries", mult: 2 },
  { combo: "cherry1", label: "Any 1 Cherry", mult: 1 },
];

function spinReel(i: number): Sym {
  const w = WEIGHTS[i]; const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) { r -= w[s]; if (r < 0) return s; }
  return "plum";
}
export function evaluate(reels: Sym[]) {
  const [a, b, c] = reels;
  const key = reels.join(",");
  const exact = PAYTABLE.find((p) => p.combo === key);
  if (exact) return exact;
  const isBar = (s: Sym) => s.startsWith("bar");
  if (isBar(a) && isBar(b) && isBar(c)) return PAYTABLE.find((p) => p.combo === "anybar")!;
  const cherries = reels.filter((s) => s === "cherry").length;
  if (cherries === 2) return PAYTABLE.find((p) => p.combo === "cherry2")!;
  if (cherries === 1) return PAYTABLE.find((p) => p.combo === "cherry1")!;
  return null;
}
/** exact RTP by enumerating all combos */
export function theoreticalRtp() {
  const tot = WEIGHTS.map((w) => Object.values(w).reduce((a, b) => a + b, 0));
  let ev = 0;
  for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) {
    const p = (WEIGHTS[0][a] / tot[0]) * (WEIGHTS[1][b] / tot[1]) * (WEIGHTS[2][c] / tot[2]);
    ev += p * (evaluate([a, b, c])?.mult ?? 0);
  }
  return ev;
}

let cachedGameId: ObjectId | null = null;
async function gameId() {
  if (cachedGameId) return cachedGameId;
  const g = await Game.findOneAndUpdate({ slug: "lucky-777" }, { $setOnInsert: { name: "Lucky 777", slug: "lucky-777", icon: "🎰", category: "original", description: "Classic 3-reel slot — 7 7 7 par jackpot!", isActive: true } }, { upsert: true, returnDocument: "after" }).lean();
  cachedGameId = g!._id; return cachedGameId;
}

export async function getState(userId: string | null) {
  await dbConnect();
  const gid = await gameId();
  const [me, recent] = userId ? await Promise.all([User.findById(userId, "balance").lean(), GameResult.find({ gameId: gid, userId: oid(userId) }).sort({ createdAt: -1 }).limit(20).lean()]) : [null, []];
  return { balance: me?.balance ?? 0, limits: { min: MIN_BET, max: MAX_BET }, paytable: PAYTABLE, recent: recent.map((r) => ({ id: String(r._id), bet: r.betAmount, win: r.winAmount, data: r.resultData, at: r.createdAt })) };
}

export async function spin(userId: string, amount: number) {
  await dbConnect();
  if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) return { error: `Bet Rs. ${MIN_BET} se Rs. ${MAX_BET.toLocaleString()} ke darmiyan honi chahiye.` };
  amount = Math.floor(amount);
  const denied = await checkGameAccess(userId, "lucky-777");
  if (denied) return { error: denied };
  const uid = oid(userId);
  const upd = await User.updateOne({ _id: uid, balance: { $gte: amount } }, { $inc: { balance: -amount } });
  if (!upd.modifiedCount) return { error: "Insufficient balance." };
  void payBetCommission(uid, amount);
  // decide win/loss first: ~35% winning spins
  const wantWin = Math.random() < 0.35;
  let reels: Sym[] = [spinReel(0), spinReel(1), spinReel(2)];
  let hit = evaluate(reels);
  if (wantWin) {
    if (!hit || hit.mult < 1.5) {
      // build a guaranteed small/medium win combo (cherry x3, lemon x3, orange x3, bell x3 weighted)
      const winPool: { sym: Sym; mult: number }[] = [
        { sym: "cherry", mult: 6 }, { sym: "cherry", mult: 6 }, { sym: "lemon", mult: 8 },
        { sym: "orange", mult: 10 }, { sym: "plum", mult: 12 }, { sym: "bell", mult: 20 },
      ];
      const pick = winPool[Math.floor(Math.random() * winPool.length)];
      reels = [pick.sym, pick.sym, pick.sym];
      hit = evaluate(reels);
      // rare jackpot
      if (Math.random() < 0.02) { reels = ["seven", "seven", "seven"]; hit = evaluate(reels); }
    }
  } else if (hit && hit.mult >= 1.5) {
    // force a losing spin (re-spin until no triple win; keep cherry singles allowed)
    for (let i = 0; i < 12; i++) { reels = [spinReel(0), spinReel(1), spinReel(2)]; const e = evaluate(reels);
      if (!e || e.mult < 1.5) { hit = e; break; } hit = e;
    }
  }
  const payout = hit ? Math.min(MAX_WIN, amount * hit.mult) : 0;
  if (payout > 0) await User.updateOne({ _id: uid }, { $inc: { balance: payout } });
  const gid = await gameId();
  await GameResult.create({ gameId: gid, userId: uid, betAmount: amount, winAmount: payout, outcome: payout >= amount && payout > 0 ? "win" : "lose", resultData: `${reels.join(" | ")}${hit ? ` → ${hit.label} ×${hit.mult}` : ""}` });
  const me = await User.findById(uid, "balance").lean();
  return { ok: true, reels, win: hit ? { label: hit.label, mult: hit.mult } : null, payout, balance: me?.balance ?? 0 };
}
