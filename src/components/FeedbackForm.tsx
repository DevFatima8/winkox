"use client";

import { localApi } from "@/lib/client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

const input = "w-full rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2.5 text-white outline-none focus:border-[#d946ef]";

export function FeedbackForm({ loggedIn, name, phone }: { loggedIn: boolean; name?: string; phone?: string }) {
  const { isUr } = useI18n();
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await localApi("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd)) });
    const j = await r.json();
    setBusy(false);
    if (j.error) setState({ error: j.error }); else { setState({ ok: true }); (e.target as HTMLFormElement).reset(); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {!loggedIn && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder={isUr ? "آپ کا نام" : "Your name"} className={input} />
          <input name="phone" required placeholder="03XXXXXXXXX" className={input} />
        </div>
      )}
      {loggedIn && <p className="text-xs text-[#b8a7e6]">{isUr ? "بھیجنے والا:" : "Sending as:"} <b className="text-white">{name}</b> · {phone}</p>}
      <select name="type" className={input}>
        <option value="reward">{isUr ? "انعام / بونس کلیم" : "Reward / bonus claim"}</option>
        <option value="complaint">{isUr ? "شکایت" : "Complaint"}</option>
        <option value="suggestion">{isUr ? "تجویز" : "Suggestion"}</option>
        <option value="other">{isUr ? "دیگر" : "Other"}</option>
      </select>
      <textarea name="message" required rows={5} placeholder={isUr ? "تفصیل لکھیں — مثلاً مشن/ریبیٹ/ریسکیو فنڈ کلیم، یا کوئی مسئلہ..." : "Write details — e.g. mission / rebate / rescue fund claim, or any issue..."} className={input} />
      {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{isUr ? "شکریہ! آپ کا پیغام مل گیا — ٹیم 24 گھنٹوں میں جواب دے گی۔" : "Thank you! We received your message — our team will respond within 24 hours."}</p>}
      <button disabled={busy} className="btn-gold rounded-xl px-6 py-2.5 text-sm font-black disabled:opacity-60">{busy ? "..." : isUr ? "بھیجیں" : "Submit"}</button>
    </form>
  );
}
