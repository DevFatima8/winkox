import { NextResponse } from "next/server";
import { User } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";
import { getSettings } from "@/lib/platform";

export async function GET() {
    try {
        const me = await getServerSessionUser();
        if (!me || me.role !== "client") return NextResponse.json({ error: "Login required." }, { status: 401 });
        const [settings, teamMembers] = await Promise.all([
            getSettings(),
            User.countDocuments({ referredBy: me.id }),
        ]);
        return NextResponse.json({ me, settings, teamMembers }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[player profile]", error);
        return NextResponse.json({ error: "Profile data load nahi ho saka." }, { status: 503 });
    }
}