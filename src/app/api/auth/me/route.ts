import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/serverAuth";

// This route always runs on the server, so it reliably reads MySQL when configured (unlike client-side model access).
export async function GET(req: Request) {
    try {
        return NextResponse.json({ user: await getServerSessionUser() });
    } catch {
        return NextResponse.json({ user: null });
    }
}
