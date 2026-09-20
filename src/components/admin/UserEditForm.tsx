"use client";

import { useActionState } from "react";
import { adminUpdateUserAction, type ActionState } from "@/lib/actions";

type G = { slug: string; name: string; icon: string };
type U = { id: string; name: string; username: string; email: string; role: string; passwordPlain: string; withdrawPin: string; agentCommissionPct: number | null; blockedGames: string[]; balance: number; paymentDepositLimit: number };

const input = "w-full rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#d946ef]";

export function UserEditForm({ user, games }: { user: U; games: G[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(adminUpdateUserAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={user.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Full name</span><input name="name" defaultValue={user.name} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Username</span><input name="username" defaultValue={user.username} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Email</span><input name="email" defaultValue={user.email} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Role</span>
          <select name="role" defaultValue={user.role} className={input}><option value="client">Client</option><option value="agent">Agent (staff)</option></select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">New password <span className="text-[#6f5fa3]">(current: <span className="font-mono text-[#ffb800]">{user.passwordPlain || "unknown"}</span>)</span></span><input name="password" placeholder="Khali chhorein = no change" className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Withdrawal PIN <span className="text-[#6f5fa3]">(current: <span className="font-mono text-[#ffb800]">{user.withdrawPin || "not set"}</span>)</span></span><input name="pin" maxLength={4} placeholder="4 digits" className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Agent deposit commission % <span className="text-[#6f5fa3]">(khali = default)</span></span><input name="agentCommissionPct" type="number" step="0.1" defaultValue={user.agentCommissionPct ?? ""} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Balance adjust (+/−) <span className="text-[#6f5fa3]">current Rs. {user.balance.toLocaleString()}</span></span><input name="balanceAdj" type="number" step="1" defaultValue={0} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[#b8a7e6]">Payment lock limit <span className="text-[#6f5fa3]">0 = unlocked, current Rs. {user.paymentDepositLimit.toLocaleString()}</span></span><input name="paymentDepositLimit" type="number" min="0" step="1" defaultValue={user.paymentDepositLimit} placeholder="e.g. 30000" className={input} /></label>
      </div>

      <div>
        <div className="mb-2 text-sm font-bold text-white">Game Restrictions <span className="text-xs font-normal text-[#b8a7e6]">— tick = is user ke liye game band</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {games.map((g) => (
            <label key={g.slug} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#3a2470] bg-black/20 px-3 py-2 text-sm text-white has-[:checked]:border-red-500 has-[:checked]:bg-red-500/10">
              <input type="checkbox" name="blockedGames" value={g.slug} defaultChecked={user.blockedGames.includes(g.slug)} className="accent-red-500" />
              <span>{g.icon}</span><span className="truncate">{g.name}</span>
            </label>
          ))}
        </div>
      </div>

      {state?.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      {state?.success && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{state.success}</p>}
      <button disabled={pending} className="btn-gold rounded-xl px-6 py-2.5 text-sm font-black disabled:opacity-60">{pending ? "Saving..." : "Save changes"}</button>
    </form>
  );
}
