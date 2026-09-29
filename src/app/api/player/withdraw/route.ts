import { NextResponse } from "next/server";
import { PaymentAccount, Transaction, User, oid } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";
import { getSettings, vipInfo, withdrawnToday } from "@/lib/platform";
import { notifyAdmins, notifyUser } from "@/lib/notifications";

export async function POST(request: Request) {
    try {
        const me = await getServerSessionUser();
        if (!me || me.role !== "client") return NextResponse.json({ error: "Login required." }, { status: 401 });
        const form = await request.formData();
        const amount = Math.floor(Number(form.get("amount")));
        const provider = String(form.get("provider") ?? "");
        const accountNumber = String(form.get("accountNumber") ?? "").trim();
        const holderName = String(form.get("holderName") ?? form.get("accountName") ?? "").trim();
        const pin = String(form.get("pin") ?? "");
        if (holderName.length < 3) return NextResponse.json({ error: "Apne JazzCash/Easypaisa account holder ka naam likhein." }, { status: 400 });
        if (provider !== "jazzcash" && provider !== "easypaisa") return NextResponse.json({ error: "Provider select karein." }, { status: 400 });
        if (!/^03\d{9}$/.test(accountNumber)) return NextResponse.json({ error: "Account number 03XXXXXXXXX format mein ho." }, { status: 400 });

        const user = await User.findById(me.id, "withdrawPin vipLevel assignedAccounts").lean();
        if (!user?.withdrawPin) return NextResponse.json({ error: "Pehle Profile se Withdrawal PIN set karein." }, { status: 400 });
        if (pin !== user.withdrawPin) return NextResponse.json({ error: "Withdrawal PIN ghalat hai." }, { status: 400 });
        const settings = await getSettings();
        const { cur } = vipInfo(user.vipLevel ?? 0, settings.vipLevels);
        const min = cur?.minWithdraw ?? settings.wallet?.minWithdraw ?? 1000;
        if (!Number.isFinite(amount) || amount < min) return NextResponse.json({ error: `Minimum withdraw Rs. ${min} hai.` }, { status: 400 });
        if (cur?.perWithdrawMax && amount > cur.perWithdrawMax) return NextResponse.json({ error: `Aapki VIP level (${cur.name}) par ek withdraw max Rs. ${cur.perWithdrawMax.toLocaleString()} hai.` }, { status: 400 });
        const today = await withdrawnToday(me.id);
        if (cur?.dailyWithdrawLimit && today + amount > cur.dailyWithdrawLimit) return NextResponse.json({ error: `Daily limit Rs. ${cur.dailyWithdrawLimit.toLocaleString()} (${cur.name}). Aaj baqi: Rs. ${Math.max(0, cur.dailyWithdrawLimit - today).toLocaleString()}. VIP level barhayein.` }, { status: 400 });

        const assignedId = (user.assignedAccounts?.[provider] as string) ?? null;
        const account = assignedId ? await PaymentAccount.findById(assignedId).lean() : null;
        const update = await User.updateOne({ _id: oid(me.id), balance: { $gte: amount } }, { $inc: { balance: -amount } });
        if (!update.modifiedCount) return NextResponse.json({ error: "Insufficient balance." }, { status: 400 });
        await Transaction.create({
            userId: oid(me.id), type: "withdraw", provider, amount, senderNumber: accountNumber, holderName,
            assignedAccountId: account?._id ? String(account._id) : null,
            paymentAccountId: account?._id ? account._id : null,
            accountName: account?.accountTitle ?? null, method: "manual",
        });
        await notifyUser(me.id, "Withdrawal request received", `Your withdrawal request of Rs. ${amount.toLocaleString()} is pending admin approval.`, "info", { href: "/player/wallet" });
        await notifyAdmins("New withdrawal request", `${me.name} requested a withdrawal of Rs. ${amount.toLocaleString()} via ${provider}.`, "warning", { href: "/admin/withdrawals?status=pending" });
        return NextResponse.json({ success: "Withdraw request submit ho gayi. Amount 24 ghanton mein aapke account mein aa jayegi." });
    } catch (error) {
        console.error("[player withdraw]", error);
        return NextResponse.json({ error: "Withdrawal request submit nahi ho saki." }, { status: 500 });
    }
}