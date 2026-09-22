import { dbConnect } from "./mongo";
import { CardBet, CardRound, Game, GameResult, User, oid, type CardRoundDoc, type ObjectId } from "@/models";
import { checkGameAccess } from "./gameAccess";
import { payBetCommission } from "./platform";
import { MAX_MULTIPLIER } from "./outcomes";


export const MIN_BET = 10;
export const MAX_BET = 50000;
const MAX_SINGLE_WIN = 2_000;
const CLOSE_GRACE_MS = 500; // bets rejected in the last 0.5s of the betting window

export const TABLES = {
  "dragon-tiger": {
    name: "Dragon Tiger",
    icon: "🐉",
    betMs: 20000,
    options: {
      dragon: { label: "Dragon", pays: "1:1", mult: 2 },
      tie: { label: "Tie", pays: "8:1", mult: 9 },
      tiger: { label: "Tiger", pays: "1:1", mult: 2 },
    },
  },
  "andar-bahar": {
    name: "Andar Bahar",
    icon: "🃏",
    betMs: 20000,
    options: {
      andar: { label: "Andar", pays: "0.9:1", mult: 1.9 },
      bahar: { label: "Bahar", pays: "1:1", mult: 2 },
    },
  },
} as const;
export type Table = keyof typeof TABLES;
export const isTable = (t: string): t is Table => t in TABLES;

export type Card = { r: number; s: number }; // r: 1..13 (A..K), s: 0♠ 1♥ 2♦ 3♣
export type DTResult = { kind: "dragon-tiger"; dragon: Card; tiger: Card; winner: "dragon" | "tiger" | "tie" };
export type ABResult = { kind: "andar-bahar"; joker: Card; andar: Card[]; bahar: Card[]; winner: "andar" | "bahar"; dealMs: number };
export type Result = DTResult | ABResult;

function shoe(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) cards.push({ r, s });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function generate(table: Table): { result: Result; revealMs: number } {
  if (table === "dragon-tiger") {
    const s = shoe(8); // 8-deck shoe like a real casino
    const dragon = s[0], tiger = s[1];
    const winner = dragon.r > tiger.r ? "dragon" : tiger.r > dragon.r ? "tiger" : "tie";
    return { result: { kind: table, dragon, tiger, winner }, revealMs: 7000 };
  }
  const s = shoe(1);
  const joker = s[0];
  const andar: Card[] = [], bahar: Card[] = [];
  let winner: "andar" | "bahar" = "andar";
  for (let i = 1; i < s.length; i++) {
    const toAndar = i % 2 === 1; // dealing always starts on Andar
    (toAndar ? andar : bahar).push(s[i]);
    if (s[i].r === joker.r) { winner = toAndar ? "andar" : "bahar"; break; }
  }
  const dealt = andar.length + bahar.length;
  const dealMs = dealt <= 14 ? 520 : Math.max(150, Math.floor(7200 / dealt));
  return { result: { kind: table, joker, andar, bahar, winner, dealMs }, revealMs: 1400 + dealt * dealMs + 3200 };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function payoutFor(result: Result, option: string, amount: number) {
  let raw = 0;
  if (result.kind === "dragon-tiger") {
    if (option === "tie") raw = result.winner === "tie" ? amount * 9 : 0;
    else if (result.winner === "tie") raw = amount * 0.5; // Dragon/Tiger bets: half refund on tie
    else raw = option === result.winner ? amount * 2 : 0;
  } else if (option === result.winner) {
    raw = option === "andar" ? amount * 1.9 : amount * 2;
  }
  return Math.min(MAX_MULTIPLIER * amount, raw);
}

const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
const cardStr = (c: Card) => `${RANKS[c.r]}${SUITS[c.s]}`;
export function describe(result: Result) {
  if (result.kind === "dragon-tiger") return `Dragon ${cardStr(result.dragon)} vs Tiger ${cardStr(result.tiger)} → ${result.winner === "tie" ? "TIE" : result.winner.toUpperCase()}`;
  return `Joker ${cardStr(result.joker)} → ${result.winner.toUpperCase()} (${result.andar.length + result.bahar.length} cards)`;
}

/* ---------- per-table in-process mutex ---------- */
const g = globalThis as typeof globalThis & { __cardLocks?: Record<string, Promise<void>> };
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  g.__cardLocks ??= {};
  const prev = g.__cardLocks[key] ?? Promise.resolve();
  let release!: () => void;
  g.__cardLocks[key] = new Promise<void>((res) => (release = res));
  await prev;
  try { return await fn(); } finally { release(); }
}

const gameIds: Partial<Record<Table, ObjectId>> = {};
async function gameIdFor(table: Table) {
  if (gameIds[table]) return gameIds[table]!;
  const t = TABLES[table];
  const doc = await Game.findOneAndUpdate(
    { slug: table },
    { $setOnInsert: { name: t.name, slug: table, icon: t.icon, category: "wg-cards", description: "WG Cards live table", isActive: true } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  gameIds[table] = doc!._id;
  return doc!._id;
}

async function createRound(table: Table, prevNo: number) {
  const now = Date.now();
  const { result, revealMs } = generate(table);
  const doc = await CardRound.create({
    table, roundNo: prevNo + 1, status: "betting",
    bettingEndsAt: new Date(now + TABLES[table].betMs),
    revealEndsAt: new Date(now + TABLES[table].betMs + revealMs),
    result: JSON.stringify(result), winner: result.winner,
  });
  return doc.toObject() as CardRoundDoc;
}

async function settle(table: Table, r: CardRoundDoc) {
  let result = JSON.parse(r.result) as Result;
  const bets = await CardBet.find({ table, roundNo: r.roundNo, status: "pending" }).lean();
  if (!bets.length) return;
  // House rule: ~35% of rounds are won by the player. Adjust the (hidden) result per player option before payout.
  const mainBet = bets[0];
  const playerWins = Math.random() < 0.35;
  if (table === "dragon-tiger") {
    const dt = result as DTResult;
    if (mainBet.option === "tie") {
      dt.winner = playerWins ? "tie" : (Math.random() < 0.5 ? "dragon" : "tiger");
      if (playerWins) dt.winner = "tie";
    } else if (mainBet.option === "dragon" || mainBet.option === "tiger") {
      if (playerWins) dt.winner = mainBet.option as "dragon" | "tiger";
      else { const other = mainBet.option === "dragon" ? "tiger" : "dragon"; dt.winner = (Math.random() < 0.08 ? "tie" : other) as never; }
    }
  } else {
    const ab = result as ABResult;
    if (mainBet.option === "andar" || mainBet.option === "bahar") {
      ab.winner = playerWins ? (mainBet.option as "andar" | "bahar") : (mainBet.option === "andar" ? "bahar" : "andar");
    }
  }
  const perUser = new Map<string, { bet: number; payout: number; desc: string[] }>();
  const ops = bets.map((b) => {
    const payout = r2(payoutFor(result, b.option, b.amount));
    const status: "win" | "push" | "lose" = payout > b.amount ? "win" : payout > 0 ? "push" : "lose";
    const key = String(b.userId);
    const u = perUser.get(key) ?? { bet: 0, payout: 0, desc: [] };
    u.bet += b.amount; u.payout += payout; u.desc.push(`${b.option} ${b.amount}`);
    perUser.set(key, u);
    return { updateOne: { filter: { _id: b._id }, update: { $set: { status, payout } } } };
  });
  await CardBet.bulkWrite(ops);
  const gid = await gameIdFor(table);
  const summary = describe(result);
  for (const [uid, u] of perUser) {
    const payout = r2(u.payout);
    if (payout > 0) await User.updateOne({ _id: oid(uid) }, { $inc: { balance: payout } });
    await GameResult.updateOne(
      { gameId: gid, roundNo: r.roundNo, userId: oid(uid) },
      { $set: { winAmount: payout, outcome: payout >= u.bet && payout > 0 ? "win" : "lose", resultData: `${summary} · Bets: ${u.desc.join(", ")}` } },
    );
  }
}

async function advance(table: Table): Promise<CardRoundDoc> {
  let r = await CardRound.findOne({ table }).sort({ roundNo: -1 }).lean<CardRoundDoc>();
  for (let guard = 0; guard < 4; guard++) {
    const now = Date.now();
    if (!r || r.status === "settled") { r = await createRound(table, r?.roundNo ?? 0); break; }
    if (r.status === "betting" && now >= new Date(r.bettingEndsAt).getTime()) {
      await CardRound.updateOne({ _id: r._id, status: "betting" }, { $set: { status: "revealing" } });
      r = { ...r, status: "revealing" };
    }
    if (r.status === "revealing" && now >= new Date(r.revealEndsAt).getTime()) {
      await settle(table, r);
      await CardRound.updateOne({ _id: r._id }, { $set: { status: "settled" } });
      r = { ...r, status: "settled" };
      continue;
    }
    break;
  }
  return r!;
}

async function withTable<T>(table: Table, fn: (round: CardRoundDoc) => Promise<T>) {
  await dbConnect();
  await gameIdFor(table);
  return withLock(table, async () => fn(await advance(table)));
}

export async function getState(userId: string | null, table: Table) {
  const round = await withTable(table, async (r) => r);
  const uid = userId ? oid(userId) : null;
  const [myBets, totals, history, me] = await Promise.all([
    uid ? CardBet.find({ userId: uid, table, roundNo: round.roundNo }).sort({ createdAt: 1 }).lean() : [],
    CardBet.aggregate<{ _id: string; total: number; players: ObjectId[] }>([
      { $match: { table, roundNo: round.roundNo } },
      { $group: { _id: "$option", total: { $sum: "$amount" }, players: { $addToSet: "$userId" } } },
    ]),
    CardRound.find({ table, status: "settled" }).sort({ roundNo: -1 }).limit(60).select("roundNo winner").lean(),
    uid ? User.findById(uid, "balance").lean() : null,
  ]);
  const revealing = round.status !== "betting";
  const result = revealing ? (JSON.parse(round.result) as Result) : null;
  const myExpected = result ? r2(myBets.reduce((s, b) => s + payoutFor(result, b.option, b.amount), 0)) : 0;
  const stats: Record<string, number> = {};
  for (const h of history) stats[h.winner] = (stats[h.winner] ?? 0) + 1;
  const t = TABLES[table];
  return {
    serverNow: Date.now(),
    table,
    config: { name: t.name, betMs: t.betMs, options: t.options, min: MIN_BET, max: MAX_BET },
    round: {
      roundNo: round.roundNo,
      status: round.status as "betting" | "revealing" | "settled",
      bettingEndsAt: new Date(round.bettingEndsAt).getTime(),
      revealEndsAt: new Date(round.revealEndsAt).getTime(),
      result,
    },
    myBets: myBets.map((b) => ({ option: b.option, amount: b.amount, status: b.status, payout: b.payout })),
    myTotal: myBets.reduce((s, b) => s + b.amount, 0),
    myExpected,
    totals: Object.fromEntries(totals.map((x) => [x._id, { total: x.total, players: x.players.length }])),
    history: history.slice().reverse().map((h) => ({ roundNo: h.roundNo, winner: h.winner })),
    stats,
    balance: me?.balance ?? 0,
  };
}

export async function placeBet(userId: string, table: Table, option: string, amount: number) {
  const opts = TABLES[table].options as Record<string, unknown>;
  if (!(option in opts)) return { error: "Invalid bet option." };
  if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) return { error: `Bet Rs. ${MIN_BET} se Rs. ${MAX_BET} ke darmiyan honi chahiye.` };
  amount = Math.floor(amount);
  const denied = await checkGameAccess(userId, table);
  if (denied) return { error: denied };
  return withTable(table, async (r) => {
    if (r.status !== "betting" || Date.now() > new Date(r.bettingEndsAt).getTime() - CLOSE_GRACE_MS) return { error: "Betting band ho gayi. Agla round wait karein." };
    const uid = oid(userId);
    const upd = await User.updateOne({ _id: uid, balance: { $gte: amount } }, { $inc: { balance: -amount } });
    if (!upd.modifiedCount) return { error: "Insufficient balance. Pehle deposit karein." };
    await CardBet.create({ userId: uid, table, roundNo: r.roundNo, option, amount });
    void payBetCommission(uid, amount);
    const gid = await gameIdFor(table);
    await GameResult.updateOne(
      { gameId: gid, roundNo: r.roundNo, userId: uid },
      { $inc: { betAmount: amount }, $setOnInsert: { outcome: "pending", winAmount: 0, resultData: `${TABLES[table].name} · round #${r.roundNo} · waiting` } },
      { upsert: true },
    );
    return { ok: true };
  });
}

export async function cancelBets(userId: string, table: Table) {
  return withTable(table, async (r) => {
    if (r.status !== "betting") return { error: "Ab cancel nahi ho sakta." };
    const uid = oid(userId);
    const bets = await CardBet.find({ userId: uid, table, roundNo: r.roundNo, status: "pending" }).lean();
    if (!bets.length) return { error: "Is round mein koi bet nahi." };
    const total = bets.reduce((s, b) => s + b.amount, 0);
    await CardBet.deleteMany({ _id: { $in: bets.map((b) => b._id) } });
    await GameResult.deleteOne({ gameId: await gameIdFor(table), roundNo: r.roundNo, userId: uid });
    await User.updateOne({ _id: uid }, { $inc: { balance: total } });
    return { ok: true, refunded: total };
  });
}
