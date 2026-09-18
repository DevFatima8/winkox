"use client";
import { getCurrentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/mongo";
import { PaymentAccount, Transaction } from "@/models";
import { Card, ProviderBadge, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { PaymentAccountForm } from "@/components/PaymentAccountForm";
import { deletePaymentAccountAction, togglePaymentAccountAction } from "@/lib/actions";
import { usePage, REDIRECT } from "@/lib/useDb";

export default function PaymentsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const _me = await getCurrentUser();
  if (!_me) return REDIRECT("/admin/login");
  await dbConnect();
  // super admin/owner see everything; a sub-admin sees only their own payment accounts
  const accFilter = _me.level >= 2 ? {} : { ownerId: _me.id };
  const myAccounts = await PaymentAccount.find(accFilter).select("_id").lean();
  const myIds = myAccounts.map((a) => a._id);
  const [accounts, stats] = await Promise.all([
    PaymentAccount.find(accFilter).sort({ createdAt: -1 }).lean(),
    Transaction.aggregate<{ _id: string | null; total: number; c: number }>([
      { $match: { type: "deposit", status: "approved", ...(_me.level >= 2 ? {} : { paymentAccountId: { $in: myIds } }) } },
      { $group: { _id: "$paymentAccountId", total: { $sum: "$amount" }, c: { $sum: 1 } } },
    ]),
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payment Accounts</h1>
        <p className="text-sm text-slate-400">{_me.level >= 2 ? "Saare payment accounts (saare admins ke)." : "Aapke JazzCash / Easypaisa accounts — in par payments receive hongi."} Active accounts clients ko random assign hote hain.</p>
      </div>
      <Card title="Connect New Account"><PaymentAccountForm /></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const id = String(a._id);
          const s = statMap.get(id);
          return (
            <div key={id} className={`rounded-2xl border border-slate-800 p-5 ${a.isActive ? "bg-slate-900" : "bg-slate-900/40 opacity-70"}`}>
              <div className="flex items-center justify-between"><ProviderBadge provider={a.provider} /><StatusBadge status={a.isActive ? "active" : "blocked"} /></div>
              <div className="mt-3 text-lg font-bold text-white">{a.accountTitle}</div>
              <div className="font-mono text-xl tracking-wider text-yellow-400">{a.accountNumber}</div>
              <div className="mt-3 text-sm text-slate-400">Received: <b className="text-emerald-400">{fmt(s?.total ?? 0)}</b> · {s?.c ?? 0} deposits</div>
              <div className="text-xs text-slate-500">Added {fmtDate(a.createdAt)}</div>
              <div className="mt-4 flex gap-2">
                <form onSubmit={async (e)=>{e.preventDefault(); await togglePaymentAccountAction(id, !a.isActive);}}>
                  <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">{a.isActive ? "Disable" : "Enable"}</button>
                </form>
                <form onSubmit={async (e)=>{e.preventDefault(); await deletePaymentAccountAction(id);}}>
                  <button className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25">Remove</button>
                </form>
              </div>
            </div>
          );
        })}
        {accounts.length === 0 && <p className="col-span-full py-8 text-center text-slate-500">Abhi koi account connected nahi. Upar se add karein.</p>}
      </div>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
