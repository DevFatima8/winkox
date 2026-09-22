import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const raw = request.headers.get("cf-connecting-ip") || forwarded || request.headers.get("x-real-ip") || null;
    const ip = raw?.replace(/^::ffff:/i, "").trim() || null;
    return NextResponse.json({ ip });
}