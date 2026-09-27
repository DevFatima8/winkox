import { NextResponse } from "next/server";
import { Game, GameResult, Transaction } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";

export async function GET() {
    try {
        const me = await getServerSessionUser();
        if (!me || me.role !== "client") return NextResponse.json({ error: "Login required." }, { status: 401 });
        const [transactions, results] = await Promise.all([
            Transaction.find({ userId: me.id }).sort({ createdAt: -1 }).limit(100).lean(),
            GameResult.find({ userId: me.id }).sort({ createdAt: -1 }).limit(100).lean(),
        ]);
        const gameIds = [...new Set(results.map((result) => String(result.gameId)))];
        const games = gameIds.length ? await Game.find({ _id: { $in: gameIds } }, "name icon").lean() : [];
        const gameMap = new Map(games.map((game) => [String(game._id), { name: game.name, icon: game.icon }]));
        const plays = results.map((result) => ({ ...result, gameId: gameMap.get(String(result.gameId)) ?? null }));
        return NextResponse.json({ transactions, plays }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[player history]", error);
        return NextResponse.json({ error: "History load nahi ho saki." }, { status: 503 });
    }
}