"use client";
import { dbConnect } from "@/lib/mongo";
import { Transaction, PaymentAccount, type TxnStatus } from "@/models";
import { Card, ProviderBadge, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { processTransactionAction } from "@/lib/actions";
import { usePage } from "@/lib/useDb";
import { getCurrentUser } from "@/lib/auth";

export default function TransactionsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const { status } = searchParams ?? {};
  await dbConnect();
  const me = await getCurrentUser();
  const isSuper = me && me.role === "admin" && me.level >= 2;
  let filter: Record<string, unknown> = status && ["pending", "approved", "rejected"].includes(status) ? { status: status as TxnStatus } : {};
  if (!isSuper) {
    // sub-admin sees only transactions against payment accounts they own
    const owned = await PaymentAccount.find({ ownerId: me!.id }).select("_id").lean();
    const ids = owned.map((a) => a._id);
    filter = { ...filter, paymentAccountId: { $in: ids } };
  }
  const rows = await Transaction.find(filter).sort({ createdAt: -1 }).limit(500)
    .populate<{ userId: { name: string; phone: string } | null }>("userId", "name phone")
    .populate<{ paymentAccountId: { accountTitle: string; accountNumber: string } | null }>("paymentAccountId", "accountTitle accountNumber")
    .lean();

  const tabs = [["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Deposits & Withdrawals</h1>
      <div className="flex gap-2">
        {tabs.map(([v, l]) => (
          <a key={v} href={v ? `/admin/transactions?status=${v}` : "/admin/transactions"} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${(status ?? "") === v ? "bg-yellow-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{l}</a>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="pb-2">User</th><th className="pb-2">Type</th><th className="pb-2">Provider</th><th className="pb-2">Amount</th><th className="pb-2">Account / Holder / TID</th><th className="pb-2">Status</th><th className="pb-2">Time</th><th className="pb-2">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((t) => {
                const id = String(t._id);
                return (
                  <tr key={id}>
                    <td className="py-2.5"><div className="font-medium text-white">{t.userId?.name}</div><div className="text-xs text-slate-500">{t.userId?.phone}</div></td>
                    <td className={`py-2.5 font-bold uppercase ${t.type === "deposit" ? "text-emerald-400" : "text-red-400"}`}>{t.type}</td>
                    <td className="py-2.5"><ProviderBadge provider={t.provider} /></td>
                    <td className="py-2.5 font-semibold text-white">{fmt(t.amount)}</td>
                    <td className="py-2.5 text-xs text-slate-300">
                      {t.type === "deposit" ? (
                        <>
                          <div>To: <b className="text-white">{t.paymentAccountId?.accountTitle ?? "-"}</b> ({t.paymentAccountId?.accountNumber ?? "-"})</div>
                          <div>From: {t.senderNumber}</div>
                          <div className="font-mono text-yellow-400">TID: {t.referenceId}</div>
                        </>
                      ) : (
                        <div>
                          Send to: <span className="font-mono text-yellow-400">{t.senderNumber}</span>
                          {t.holderName && <div className="mt-0.5 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-300">Holder: {t.holderName}</div>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5"><StatusBadge status={t.status} />{t.method === "gateway" && <span className="ml-1 rounded bg-[#ffb800]/20 px-1.5 py-0.5 text-[9px] font-black text-[#ffb800]">TEST GW</span>}{t.adminNote && <div className="mt-1 text-xs text-slate-500">{t.adminNote}</div>}</td>
                    <td className="py-2.5 text-slate-400">{fmtDate(t.createdAt)}</td>
                    <td className="py-2.5">
                      {t.status === "pending" && (
                        <div className="flex gap-1.5">
                          <form onSubmit={async(e)=>{e.preventDefault(); const r=await processTransactionAction(id, "approved"); if(r?.error) alert(r.error);}}>
                            <button className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25">Approve</button>
                          </form>
                          <form onSubmit={async(e)=>{e.preventDefault(); await processTransactionAction(id, "rejected", "Rejected by admin");}}>
                            <button className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/25">Reject</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500">Koi transaction nahi.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
