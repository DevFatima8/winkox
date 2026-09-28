"use client";
import Link from "next/link";
import { Card, ProviderBadge, StatusBadge, fmt, fmtDate } from "@/components/Shell";
import { processTransactionAction } from "@/lib/clientActions";
import { usePage } from "@/lib/useDb";

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
    const query = new URLSearchParams({ type });
    for (const [key, value] of Object.entries({ status, q, days, date, week, year })) if (value) query.set(key, value);
    const response = await fetch(`/api/admin/transactions?${query}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Transactions load nahi ho sake.");
    const rows = result.rows as {
      _id: string; userId: { name: string; phone: string } | null; paymentAccountId: { accountTitle: string; accountNumber: string } | null;
      provider: string; amount: number; type: TransactionType; senderNumber: string | null; referenceId: string | null; proofImage?: string | null;
      status: string; method: string; adminNote: string | null; createdAt: Date | string; holderName?: string | null;
    }[];

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
                            {t.proofImage && <a href={t.proofImage} target="_blank" rel="noreferrer" className="mt-1 inline-block text-yellow-400 underline">Open payment screenshot</a>}
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
                            <form onSubmit={async (e) => { e.preventDefault(); const r = await processTransactionAction(id, "approved"); if (r?.error) alert(r.error); else window.location.reload(); }}>
                              <button className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25">Approve</button>
                            </form>
                            <form onSubmit={async (e) => { e.preventDefault(); const r = await processTransactionAction(id, "rejected", "Rejected by admin"); if (r?.error) alert(r.error); else window.location.reload(); }}>
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
