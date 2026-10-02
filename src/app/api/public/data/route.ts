import { NextResponse } from "next/server";
import { Game, HelpArticle } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";
import { ensureHelp, getSettings, supportOnline } from "@/lib/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const params = new URL(request.url).searchParams;
        const view = params.get("view");
        if (view === "game") {
            const slug = params.get("slug") ?? "";
            const game = await Game.findOne({ slug }, "slug isActive").lean();
            return game?.isActive ? NextResponse.json({ active: true }) : NextResponse.json({ active: false }, { status: 404 });
        }
        if (view === "help") {
            await ensureHelp();
            const [articles, settings, me] = await Promise.all([
                HelpArticle.find({ isActive: true }).sort({ category: 1, order: 1 }).lean(),
                getSettings(),
                getServerSessionUser(),
            ]);
            return NextResponse.json({ articles, links: settings.links, me }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "invite") {
            const [settings, me] = await Promise.all([getSettings(), getServerSessionUser()]);
            return NextResponse.json({ referralCode: me?.referralCode ?? null, depositCommissionPct: settings.referral?.depositCommissionPct ?? 1.5 });
        }
        const settings = await getSettings();
        if (view === "info") {
            const me = await getServerSessionUser();
            return NextResponse.json({ settings, me, supportOnline: supportOnline(settings.support) });
        }
        if (view === "lobby") return NextResponse.json({ links: { ...settings.links, androidUrl: settings.app?.androidUrl, iosUrl: settings.app?.iosUrl }, leaderboard: settings.leaderboard ?? [] });
        return NextResponse.json({ error: "Unknown public data view." }, { status: 404 });
    } catch (error) {
        console.error("[public data]", error);
        return NextResponse.json({ error: "Data load nahi ho saka." }, { status: 503 });
    }
}