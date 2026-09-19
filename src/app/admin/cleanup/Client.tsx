"use client";

import { useActionState } from "react";
import { cleanupHistoryAction, type ActionState } from "@/lib/actions";
import { Card } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { usePage, REDIRECT } from "@/lib/useDb";

const input = "w-full rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d946ef]";

function CleanupForm() {
    const [state, action, pending] = useActionState<ActionState, FormData>(cleanupHistoryAction, undefined);
    return (
        <form action={action} onSubmit={(e) => { if (!window.confirm("Selected history permanently delete karni hai? Ye action undo nahi ho sakta.")) e.preventDefault(); }} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">History category</span>
                    <select name="kind" required className={input} defaultValue="">
                        <option value="" disabled>Select history</option>
                        <option value="transactions">Deposits & withdrawals</option>
                        <option value="game-results">Mini-game results and bets</option>
                        <option value="aviator">Aviator rounds</option>
                        <option value="card-games">Dragon Tiger / Andar Bahar rounds and bets</option>
                        <option value="notifications">Notifications and announcements</option>
                        <option value="support">Support chats</option>
                        <option value="gateway">Payment gateway sessions</option>
                        <option value="commissions">Referral commissions</option>
                        <option value="admin-logs">Admin activity logs</option>
                    </select>
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Delete records older than (days)</span>
                    <input name="olderThanDays" type="number" min="0" placeholder="0 = all records in selected category" className={input} />
                </label>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3 text-xs text-red-200 ring-1 ring-red-500/20">
                This removes history only. Users, balances, staff accounts, payment accounts, games and settings are never deleted here. Leave days as 0 to delete the complete selected category.
            </div>
            {state?.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
            {state?.success && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300">{state.success}</p>}
            <button disabled={pending} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{pending ? "Deleting..." : "Delete selected history"}</button>
        </form>
    );
}

export default function CleanupPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
    void params; void searchParams;
    return usePage(async () => {
        const me = await getCurrentUser();
        if (!me || me.level < 2) return REDIRECT("/admin");
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">History Cleanup</h1>
                    <p className="mt-1 text-sm text-[#b8a7e6]">Super Admin future mein local data ko control kar sakta hai taake history collections unnecessary na barhein.</p>
                </div>
                <Card title="Delete old history">
                    <CleanupForm />
                </Card>
            </div>
        );
    }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
