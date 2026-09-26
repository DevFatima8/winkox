import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongo";
import { User, LoginEvent, AdminLog, oid } from "@/models";
import { verifyPassword, isStaff } from "@/lib/auth";
import { assignPaymentAccounts, genReferralCode, genUsername } from "@/lib/platform";

// This route always runs on the server, so it reliably uses MySQL when configured (unlike client-side actions).
export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const rawLogin = String(form.get("phone") ?? "").trim();
        const password = String(form.get("password") ?? "");
        const loginIp = String(form.get("loginIp") ?? "").trim() || null;

        await dbConnect();

        const idLike = /^WX[-\s]?(ADM|SYS)/i.test(rawLogin);
        const login = idLike
            ? rawLogin.toUpperCase().replace(/\s/g, "").replace(/^WX(ADM|SYS)/, "WX-$1").replace(/^(WX-(?:ADM|SYS))-?(\d+)$/, (_m, a, d) => `${a}-${String(parseInt(d, 10)).padStart(4, "0")}`)
            : rawLogin.replace(/\s|-/g, "");
        const u = await User.findOne(idLike ? { adminId: login } : /^03\d{9}$/.test(login) ? { phone: login } : { username: login.toLowerCase() });
        if (!u || !(await verifyPassword(password, u.passwordHash))) return NextResponse.json({ error: "Phone/username/ID ya password ghalat hai." });
        if (!u.isActive) return NextResponse.json({ error: "Aapka account block hai. Support se rabta karein." });

        u.lastLoginAt = new Date();
        if (loginIp) { u.lastLoginIp = loginIp; u.historicalIps = [...new Set([...(u.historicalIps ?? []), loginIp])].slice(-20); }
        if (!u.referralCode) u.referralCode = genReferralCode(u.name);
        if (!u.username) u.username = genUsername(u.name, u.phone);
        void u.save().catch(() => { });

        const role = isStaff(u.role) ? "admin" : "client";
        if (role === "admin") {
            if (u.role !== "owner") void AdminLog.create({ actorId: oid(u._id), actorName: u.name, actorRole: u.role, action: "login", target: "", details: "" }).catch(() => { });
        } else {
            void assignPaymentAccounts(String(u._id)).catch(() => { });
        }
        void LoginEvent.create({ userId: String(u._id), ip: loginIp, role: u.role }).catch(() => { });
        return NextResponse.json({ id: String(u._id), role, name: u.name });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Login failed." }, { status: 500 });
    }
}
