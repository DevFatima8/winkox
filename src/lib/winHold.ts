import { dbConnect } from "./mongo";
import { User, WinHold, oid } from "@/models";

/** The 2% withheld from a gross win (matches outcomes.ts payoutAfterHouseShare). */
export const heldPortion = (grossPayout: number) => Math.round(Math.max(0, grossPayout) * 0.02 * 100) / 100;

/** Midnight (00:00) of the day after `from`. */
function nextMidnight(from = new Date()) {
    const d = new Date(from);
    d.setHours(24, 0, 0, 0);
    return d;
}

/** Record the 2% held from a win — claimable only after the next midnight. */
export async function holdWinShare(userId: string, grossPayout: number) {
    const amount = heldPortion(grossPayout);
    if (amount <= 0) return;
    await dbConnect();
    await WinHold.create({ userId: oid(userId), amount, unlockAt: nextMidnight() });
}

/** Locked (not yet claimable) and claimable (past unlockAt, not yet claimed) held-win totals for a user. */
export async function getWinHoldSummary(userId: string) {
    await dbConnect();
    const now = new Date();
    const rows = await WinHold.find({ userId: oid(userId), claimed: false }).lean();
    let locked = 0, claimable = 0;
    for (const r of rows) { if (new Date(r.unlockAt) <= now) claimable += r.amount; else locked += r.amount; }
    return { locked: Math.round(locked * 100) / 100, claimable: Math.round(claimable * 100) / 100 };
}

/** Credit every unlocked held-win amount to the user's balance and mark it claimed. */
export async function claimWinHolds(userId: string) {
    await dbConnect();
    const now = new Date();
    const rows = await WinHold.find({ userId: oid(userId), claimed: false }).lean();
    const due = rows.filter((r) => new Date(r.unlockAt) <= now);
    const total = Math.round(due.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    if (total <= 0) return { claimed: 0 };
    await WinHold.updateMany({ _id: { $in: due.map((r) => r._id) } }, { $set: { claimed: true, claimedAt: now } });
    await User.updateOne({ _id: oid(userId) }, { $inc: { balance: total } });
    return { claimed: total };
}
