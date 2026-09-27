import { NextResponse } from "next/server";
import { Commission, User } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";

export async function GET() {
    try {
        const me = await getServerSessionUser();
        if (!me || me.role !== "client") return NextResponse.json({ error: "Login required." }, { status: 401 });
        const [team, commissions] = await Promise.all([
            User.find({ referredBy: me.id }).sort({ createdAt: -1 }).lean(),
            Commission.find({ beneficiaryId: me.id }).sort({ createdAt: -1 }).limit(100).lean(),
        ]);
        const referredIds = [...new Set(commissions.map((commission) => String(commission.fromUserId)))];
        const referred = referredIds.length ? await User.find({ _id: { $in: referredIds } }, "name").lean() : [];
        const names = new Map(referred.map((user) => [String(user._id), user.name]));
        return NextResponse.json({
            team: team.map(({ _id, name, totalDeposited, createdAt }) => ({ _id, name, totalDeposited, createdAt })),
            commission: me.commissionEarned,
            commissions: commissions.map((row) => ({ ...row, fromUserId: { name: names.get(String(row.fromUserId)) ?? "-" } })),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[player team]", error);
        return NextResponse.json({ error: "Team data load nahi ho saka." }, { status: 503 });
    }
}