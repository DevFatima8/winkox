"use client";

import { useActionState, useState } from "react";
import { depositAction, withdrawAction, type ActionState } from "@/lib/actions";
import { useI18n } from "@/lib/i18n/client";

type Account = { id: string; provider: "jazzcash" | "easypaisa"; accountTitle: string; accountNumber: string };

const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white outline-none placeholder:text-slate-600 focus:border-yellow-400";

export function DepositForm({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(depositAction, undefined);
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(accounts[0]?.id ?? null);
  const acc = accounts.find((a) => a.id === selected);

  if (accounts.length === 0) return <p className="text-sm text-slate-400">{t("noAccounts")}</p>;

  return (
    <form action={action} className="space-y-4">
      <div>
        <span className="mb-2 block text-sm font-medium text-slate-300">{t("selectMethod")}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {accounts.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`rounded-xl border p-3 text-left transition ${selected === a.id ? "border-yellow-400 bg-yellow-400/10" : "border-slate-700 bg-slate-950"}`}
            >
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${a.provider === "jazzcash" ? "bg-red-600" : "bg-emerald-600"}`}>
                {a.provider === "jazzcash" ? "JazzCash" : "Easypaisa"}
              </span>
              <div className="mt-1 text-sm font-semibold text-white">{a.accountTitle}</div>
              <div className="font-mono text-slate-300">{a.accountNumber}</div>
            </button>
          ))}
        </div>
        <input type="hidden" name="paymentAccountId" value={selected ?? ""} />
      </div>
      {acc && (
        <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
          <b className="text-yellow-400">{t("sendAmount")}</b> {t("sendAmountTo", { p: acc.provider === "jazzcash" ? "JazzCash" : "Easypaisa" })}{" "}
          <span className="font-mono font-bold text-white">{acc.accountNumber}</span> ({acc.accountTitle}) — {t("thenFill")}
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("amountMin", { n: 100 })}</span>
        <input name="amount" type="number" min={100} required placeholder="1000" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("yourSenderNumber")}</span>
        <input name="senderNumber" required placeholder="03XXXXXXXXX" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("tid")}</span>
        <input name="referenceId" required placeholder="e.g. 1234567890" className={input} />
      </label>
      {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{state.success}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
        {pending ? t("submitting") : t("submitDeposit")}
      </button>
    </form>
  );
}

export function WithdrawForm({ balance, hasPin, limits }: { balance: number; hasPin: boolean; limits?: { name: string; daily: number; perMax: number; usedToday: number; min: number } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(withdrawAction, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-400">{t("availableBalance")} <b className="text-yellow-400">Rs. {Number(balance).toLocaleString()}</b></p>
      {limits && <div className="rounded-xl bg-black/30 p-3 text-xs text-[#b8a7e6] ring-1 ring-[#3a2470]"><b className="text-white">{limits.name}</b> · {t("dailyLimit")} <b className="text-[#ffb800]">Rs. {limits.daily.toLocaleString()}</b> ({t("remainingToday")} Rs. {Math.max(0, limits.daily - limits.usedToday).toLocaleString()}) · {t("maxPerWithdraw")} Rs. {limits.perMax.toLocaleString()} · {t("min")} Rs. {limits.min}. <a href="/client/profile" className="text-[#c4b5fd] underline">{t("raiseVip")}</a></div>}
      {!hasPin && <div className="rounded-xl bg-[#ffb800]/10 p-3 text-xs text-[#ffe0a3] ring-1 ring-[#ffb800]/40">{t("setPinFirst")} <a href="/client/profile" className="font-bold underline">{t("profile")}</a>.</div>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("provider")}</span>
        <select name="provider" className={input}>
          <option value="jazzcash">JazzCash</option>
          <option value="easypaisa">Easypaisa</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("yourAccountNumber")}</span>
        <input name="accountNumber" required placeholder="03XXXXXXXXX" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("amountMin", { n: limits?.min ?? 500 })}</span>
        <input name="amount" type="number" min={limits?.min ?? 500} required placeholder={String(limits?.min ?? 500)} className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">{t("withdrawPin")}</span>
        <input name="pin" inputMode="numeric" maxLength={4} required placeholder="••••" className={input} />
      </label>
      {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{state.success}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-red-500 py-3 font-bold text-white hover:bg-red-400 disabled:opacity-60">
        {pending ? t("submitting") : t("requestWithdraw")}
      </button>
    </form>
  );
}
