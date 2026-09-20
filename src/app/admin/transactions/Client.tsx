"use client";
import Link from "next/link";
import { dbConnect } from "@/lib/mongo";
import { Transaction, PaymentAccount, type TxnStatus } from "@/models";
import { Card, ProviderBadge, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { processTransactionAction } from "@/lib/actions";
import { usePage } from "@/lib/useDb";
import { getCurrentUser } from "@/lib/auth";

type TransactionType = "deposit" | "withdraw";

const startOfDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getWeekRange = (value: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  return { start: monday, end: next };
};

export default function TransactionsPageClient({ type, params, searchParams }: { type: TransactionType; params?: Record<string, string>; searchParams?: Record<string, string> }) {
  return usePage(async () => {
    const { status, q, days, date, week, year } = searchParams ?? {};
    await dbConnect();
    const me = await getCurrentUser();
    const isSuper = me && me.role === "admin" && me.level >= 2;
    let filter: Record<string, unknown> = { type };
    if (status && ["pending", "approved", "rejected"].includes(status)) filter.status = status as TxnStatus;
    const selectedDate = date ? startOfDate(date) : null;
    const selectedWeek = week ? getWeekRange(week) : null;
    const selectedYear = year && /^\d{4}$/.test(year) ? Number(year) : null;
    let range: { start: Date; end: Date } | null = null;
    if (selectedDate) {
      const end = new Date(selectedDate); end.setDate(end.getDate() + 1);
      range = { start: selectedDate, end };
    } else if (selectedWeek) range = selectedWeek;
    else if (selectedYear) range = { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear + 1, 0, 1) };
    else if (days && /^\d+$/.test(days) && Number(days) > 0) {
      const end = new Date();
      const start = new Date(end); start.setDate(start.getDate() - Number(days));
      range = { start, end };
    }
    if (range) filter.createdAt = { $gte: range.start, $lt: range.end };
    if (!isSuper) {
      // sub-admin sees only transactions against payment accounts they own
      const owned = await PaymentAccount.find({ ownerId: me!.id }).select("_id").lean();
      const ids = owned.map((a) => a._id);
      filter = { ...filter, paymentAccountId: { $in: ids } };
    }
    if (q?.trim()) {
      const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const { User } = await import("@/models");
      const matchingUsers = await User.find({ $or: [{ name: new RegExp(term, "i") }, { phone: new RegExp(term, "i") }] }).select("_id").lean();
      filter.$or = [{ senderNumber: new RegExp(term, "i") }, { referenceId: new RegExp(term, "i") }, { provider: new RegExp(term, "i") }, { userId: { $in: matchingUsers.map((u) => u._id) } }];
    }
    const rows = await Transaction.find(filter).sort({ createdAt: -1 }).limit(500)
      .populate<{ userId: { name: string; phone: string } | null }>("userId", "name phone")
      .populate<{ paymentAccountId: { accountTitle: string; accountNumber: string } | null }>("paymentAccountId", "accountTitle accountNumber")
      .lean();

    const tabs = [["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]];
    const basePath = type === "deposit" ? "/admin/deposits" : "/admin/withdrawals";
    const makeHref = (nextStatus = status ?? "") => {
      const values = new URLSearchParams();
      if (nextStatus) values.set("status", nextStatus);
      if (q) values.set("q", q); if (days) values.set("days", days); if (date) values.set("date", date); if (week) values.set("week", week); if (year) values.set("year", year);
      const query = values.toString();
      return query ? `${basePath}?${query}` : basePath;
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">{type === "deposit" ? "Deposits" : "Withdrawals"}</h1><p className="mt-1 text-sm text-slate-400">{type === "deposit" ? "Deposit requests ki history aur approval." : "Withdrawal requests ki history aur approval."}</p></div><div className="flex gap-2"><Link href="/admin/deposits" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${type === "deposit" ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>Deposits</Link><Link href="/admin/withdrawals" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${type === "withdraw" ? "bg-red-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>Withdrawals</Link></div></div>
        <form className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <input name="q" defaultValue={q ?? ""} placeholder="Search user, phone, TID..." className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 lg:col-span-2" />
          <input name="days" type="number" min="1" defaultValue={days ?? ""} placeholder="Last N days" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400" />
          <input name="date" type="date" defaultValue={date ?? ""} title="Specific day" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400" />
          <input name="week" type="week" defaultValue={week ?? ""} title="Specific week" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400" />
          <div className="flex gap-2"><input name="year" type="number" min="2000" max="2100" defaultValue={year ?? ""} placeholder="Year" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400" /><button className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950">Search</button></div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400 sm:col-span-2 lg:col-span-6">Specific day, week, year ya last N days mein se ek filter select karein. <a href={basePath} className="text-yellow-400">Clear filters</a></div>
        </form>
        <div className="flex gap-2">
          {tabs.map(([v, l]) => (
            <a key={v} href={makeHref(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${(status ?? "") === v ? "bg-yellow-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{l}</a>
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
                      <td className={`py-2.5 font-bold uppercase ${type === "deposit" ? "text-emerald-400" : "text-red-400"}`}>{type}</td>
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
                            <form onSubmit={async (e) => { e.preventDefault(); const r = await processTransactionAction(id, "approved"); if (r?.error) alert(r.error); }}>
                              <button className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25">Approve</button>
                            </form>
                            <form onSubmit={async (e) => { e.preventDefault(); await processTransactionAction(id, "rejected", "Rejected by admin"); }}>
                              <button className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/25">Reject</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500">Is filter ke liye koi {type} nahi.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }, [type, JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
