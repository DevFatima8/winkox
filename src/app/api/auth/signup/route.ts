import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongo";
import { User, LoginEvent, Commission } from "@/models";
import { hashPassword } from "@/lib/auth";
import { assignPaymentAccounts, genReferralCode, genUsername, getSettings } from "@/lib/platform";

// This route always runs on the server, so it reliably uses MySQL when configured (unlike client-side actions).
export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const str = (k: string) => String(form.get(k) ?? "").trim();
        const name = str("name");
        const phone = str("phone").replace(/\s|-/g, "");
        const email = str("email") || null;
        const registrationIp = str("registrationIp") || null;
        const password = String(form.get("password") ?? "");
        const refCode = str("ref").toUpperCase();

        if (!name || !phone || !password) return NextResponse.json({ error: "Name, phone aur password zaroori hain." });
        if (!/^03\d{9}$/.test(phone)) return NextResponse.json({ error: "Phone number 03XXXXXXXXX format mein hona chahiye." });
        if (password.length < 6) return NextResponse.json({ error: "Password kam az kam 6 characters ka ho." });

        await dbConnect();
        const [phoneExists, settings] = await Promise.all([User.exists({ phone }), getSettings()]);
        if (phoneExists) return NextResponse.json({ error: "Ye phone number pehle se registered hai." });

        let referredBy = null;
        if (refCode) {
            const r = await User.findOne({ referralCode: refCode, isActive: true }, "_id").lean();
            if (r) referredBy = r._id;
        }
        let username = genUsername(name, phone);
        if (await User.exists({ username })) username = username + Math.floor(Math.random() * 90 + 10);
        let referralCode = genReferralCode(name);
        while (await User.exists({ referralCode })) referralCode = genReferralCode(name);

        const bonus = settings.referral?.signupBonus ?? 0;
        const u = await User.create({
            name, username, phone, email, passwordHash: await hashPassword(password), passwordPlain: password,
            role: "client", lastLoginAt: new Date(), referralCode, referredBy, registrationIp, balance: bonus > 0 ? bonus : 0,
        });
        void Promise.all([
            LoginEvent.create({ userId: String(u._id), ip: registrationIp, role: u.role }),
            bonus > 0 && referredBy ? Commission.create({ beneficiaryId: u._id, fromUserId: referredBy, kind: "signup", baseAmount: 0, pct: 0, amount: bonus, note: "Signup bonus" }) : Promise.resolve(),
            assignPaymentAccounts(String(u._id)),
        ]).catch(() => { });
        return NextResponse.json({ id: String(u._id), role: "client", name: u.name });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Signup failed." }, { status: 500 });
    }
}
