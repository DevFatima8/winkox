"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/Shell";
import { saveLeaderboardAction, type ActionState } from "@/lib/actions";
import { usePage, REDIRECT } from "@/lib/useDb";

type Entry = { name: string; amount: number };

function LeaderboardEditor({ initial }: { initial: Entry[] }) {
    const [entries, setEntries] = useState(initial);
    const [state, action, pending] = useActionState<ActionState, FormData>(saveLeaderboardAction, undefined);
    const update = (index: number, change: Partial<Entry>) => setEntries((current) => current.map((entry, i) => i === index ? { ...entry, ...change } : entry));
    const move = (index: number, offset: number) => setEntries((current) => {
        const next = [...current];
        const target = index + offset;
        if (target < 0 || target >= next.length) return current;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
    });
    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="entries" value={JSON.stringify(entries)} />
            <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="text-xs uppercase text-[#6f5fa3]"><tr><th className="pb-3">Rank</th><th className="pb-3">Winner name</th><th className="pb-3">Winning amount (Rs.)</th><th className="pb-3">Order</th><th className="pb-3">Remove</th></tr></thead>
                    <tbody className="divide-y divide-[#3a2470]/50">{entries.map((entry, index) => (
                        <tr key={index}>
                            <td className="py-2 font-black text-[#ffb800]">{index + 1}</td>
                            <td className="py-2 pr-3"><input value={entry.name} maxLength={50} required onChange={(event) => update(index, { name: event.target.value })} placeholder="Winner name" className="w-full rounded-lg border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white" /></td>
                            <td className="py-2 pr-3"><input value={entry.amount} type="number" min="0" step="1" onChange={(event) => update(index, { amount: Number(event.target.value) })} className="w-full rounded-lg border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white" /></td>
                            <td className="py-2"><div className="flex gap-1"><button type="button" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md bg-white/10 px-2 py-1 text-white disabled:opacity-30">↑</button><button type="button" title="Move down" aria-label="Move down" disabled={index === entries.length - 1} onClick={() => move(index, 1)} className="rounded-md bg-white/10 px-2 py-1 text-white disabled:opacity-30">↓</button></div></td>
                            <td className="py-2"><button type="button" title="Remove winner" aria-label={`Remove ${entry.name || `rank ${index + 1}`}`} onClick={() => setEntries((current) => current.filter((_, i) => i !== index))} className="rounded-md bg-red-500/15 px-3 py-1 text-red-300">Remove</button></td>
                        </tr>
                    ))}{entries.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[#6f5fa3]">Leaderboard empty hai. Winner add karein.</td></tr>}</tbody>
                </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={entries.length >= 100} onClick={() => setEntries((current) => [...current, { name: "", amount: 0 }])} className="btn-outline rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40">+ Add winner</button>
                <button disabled={pending} className="btn-gold rounded-xl px-6 py-2 text-sm font-black disabled:opacity-50">{pending ? "Saving..." : "Save leaderboard"}</button>
                {state?.error && <span className="text-sm text-red-300">{state.error}</span>}
                {state?.success && <span className="text-sm text-emerald-300">{state.success}</span>}
            </div>
        </form>
    );
}

export default function LeaderboardAdminClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
    return usePage(async () => {
        const response = await fetch("/api/admin/data?view=leaderboard", { cache: "no-store" });
        const data = await response.json();
        if (response.status === 403) return REDIRECT("/admin");
        if (!response.ok) throw new Error(data.error ?? "Leaderboard load nahi ho saka.");
        return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">Home Leaderboard</h1><p className="text-sm text-[#b8a7e6]">Winner names, winning amounts aur display order manage karein. Yeh values home page par manually show hoti hain.</p></div><Card><LeaderboardEditor initial={data.entries as Entry[]} /></Card></div>;
    }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}