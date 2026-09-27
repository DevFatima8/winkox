import { NextResponse } from "next/server";
import { AdminLog, PaymentAccount, Transaction, User, oid } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";
import { isStaff } from "@/lib/auth";
import { notifyUser } from "@/lib/notifications";
import { payDepositCommission, recomputeVip } from "@/lib/platform";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getServerSessionUser();
    if (!me || !isStaff(me.dbRole) || me.level < 1) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const decision = body.decision;
    if (decision !== "approved" && decision !== "rejected") return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note : null;
    const pending = await Transaction.findOne({ _id: oid(id), status: "pending" }).lean();
    if (!pending) return NextResponse.json({ error: "Pending request nahi mili." }, { status: 404 });
    const account = pending.paymentAccountId ? await PaymentAccount.findById(oid(pending.paymentAccountId)).lean() : null;
    if (me.level < 2 && account && String(account.ownerId ?? "") !== me.id) {
      return NextResponse.json({ error: "Ye payment kisi aur admin ke account par hai." }, { status: 403 });
    }
    const transaction = await Transaction.findOneAndUpdate(
      { _id: oid(id), status: "pending" },
      { $set: { status: decision, adminNote: note, processedAt: new Date(), processedById: me.id, processedByName: me.name, accountName: account?.accountTitle ?? null } },
      { returnDocument: "after" },
    );
    if (!transaction) return NextResponse.json({ error: "Pending request nahi mili." }, { status: 409 });

    if (transaction.type === "deposit" && decision === "approved") {
      await User.updateOne({ _id: transaction.userId }, { $inc: { balance: transaction.amount } });
      await recomputeVip(transaction.userId);
      await payDepositCommission(transaction.userId, transaction.amount);
    }
    if (transaction.type === "withdraw" && decision === "rejected") {
      await User.updateOne({ _id: transaction.userId }, { $inc: { balance: transaction.amount } });
    }
    if (transaction.type === "withdraw" && decision === "approved") await recomputeVip(transaction.userId);

    const actionLabel = decision === "approved" ? "approved" : "rejected";
    const transactionLabel = transaction.type === "deposit" ? "Purchase/deposit" : "Withdrawal";
    await notifyUser(String(transaction.userId), `${transactionLabel} ${actionLabel}`, `Your ${transactionLabel.toLowerCase()} of Rs. ${transaction.amount.toLocaleString()} has been ${actionLabel} by admin.${note ? ` Note: ${note}` : ""}`, decision === "approved" ? "success" : "warning");
    await AdminLog.create({ actorId: me.id, actorName: me.name, actorRole: me.dbRole, action: `${decision}_${transaction.type}`, target: String(transaction.userId), details: `Rs. ${transaction.amount}` });
    return NextResponse.json({ success: `${transactionLabel} ${actionLabel}.` });
  } catch (error) {
    console.error("[admin transaction]", error);
    return NextResponse.json({ error: "Transaction process nahi ho saki." }, { status: 500 });
  }
}