import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || null;
    return NextResponse.json({ ip });
}