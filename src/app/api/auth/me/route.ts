import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongo";
import { User } from "@/models";
import { toCurrentUser } from "@/lib/auth";

// This route always runs on the server, so it reliably reads MySQL when configured (unlike client-side model access).
export async function GET(req: Request) {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ user: null });
    try {
        await dbConnect();
        const u = await User.findById(id).lean();
        if (!u) return NextResponse.json({ user: null });
        return NextResponse.json({ user: toCurrentUser(u) });
    } catch {
        return NextResponse.json({ user: null });
    }
}
