import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { User } from "@/models";
import { dbConnect } from "./mongo";
import { toCurrentUser, type CurrentUser } from "./auth";

const COOKIE_NAME = "wx_auth";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("NEXTAUTH_SECRET must be configured before users can log in.");
    return secret;
}

function signature(payload: string) {
    return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function setAuthCookie(response: NextResponse, userId: string) {
    const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_TTL_SECONDS * 1000 })).toString("base64url");
    response.cookies.set(COOKIE_NAME, `${payload}.${signature(payload)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    });
    return response;
}

export function clearAuthCookie(response: NextResponse) {
    response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
}

function readUserId(token: string | undefined) {
    if (!token) return null;
    const [payload, suppliedSignature] = token.split(".");
    if (!payload || !suppliedSignature) return null;
    try {
        const expected = Buffer.from(signature(payload));
        const supplied = Buffer.from(suppliedSignature);
        if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
        return typeof session.sub === "string" && typeof session.exp === "number" && session.exp > Date.now() ? session.sub : null;
    } catch {
        return null;
    }
}

export async function getServerSessionUser(): Promise<CurrentUser | null> {
    const userId = readUserId((await cookies()).get(COOKIE_NAME)?.value);
    if (!userId) return null;
    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.isActive === false) return null;
    return toCurrentUser(user);
}