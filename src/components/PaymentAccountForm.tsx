"use client";

import { useActionState } from "react";
import { addPaymentAccountAction, type ActionState } from "@/lib/actions";

export function PaymentAccountForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addPaymentAccountAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <select name="provider" required className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white focus:border-yellow-400">
        <option value="jazzcash">JazzCash</option>
        <option value="easypaisa">Easypaisa</option>
      </select>
      <input name="accountTitle" required placeholder="Account Title (e.g. Ahmed Ali)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white placeholder:text-slate-600 focus:border-yellow-400" />
      <input name="accountNumber" required placeholder="03XXXXXXXXX" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white placeholder:text-slate-600 focus:border-yellow-400" />
      <button disabled={pending} className="rounded-xl bg-yellow-400 px-4 py-2.5 font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-60">
        {pending ? "Connecting..." : "+ Connect Account"}
      </button>
      {state?.error && <p className="text-sm text-red-400 sm:col-span-4">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400 sm:col-span-4">{state.success}</p>}
    </form>
  );
}
