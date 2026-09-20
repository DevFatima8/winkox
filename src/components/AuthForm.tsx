"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { loginAction, signupAction, type ActionState } from "@/lib/actions";
import { useI18n } from "@/lib/i18n/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { BrandLogo } from "@/components/BrandLogo";

const DEMO_LOGINS = [
  { role: "Super Admin", name: "full control", id: "WX-ADM-0001", pw: "admin123" },
  { role: "Sub Admin", name: "Ahmed Support", id: "WX-ADM-0002", pw: "subadmin123" },
  { role: "Client", name: "Demo Client · Rs. 50,000", id: "demo", pw: "client123" },
  { role: "Client", name: "Ali Khan · Rs. 12,000", id: "ali", pw: "ali123" },
  { role: "Agent", name: "Bilal Agent", id: "agent", pw: "agent123" },
];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const { t } = useI18n();
  const [ref, setRef] = useState("");
  const [login, setLogin] = useState("");
  const [pw, setPw] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [registrationIp, setRegistrationIp] = useState("");
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) { setRef(r.toUpperCase()); document.cookie = `ref=${r.toUpperCase()}; path=/; max-age=${60 * 60 * 24 * 30}`; }
    else { const m = document.cookie.match(/(?:^|; )ref=([^;]+)/); if (m) setRef(m[1]); }
  }, []);
  useEffect(() => {
    if (mode !== "signup") return;
    fetch("/api/ip").then((r) => r.ok ? r.json() : null).then((data) => { if (data?.ip) setRegistrationIp(String(data.ip)); }).catch(() => { });
  }, [mode]);

  return (
    <main className="wx-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="wx-card w-full max-w-md rounded-3xl p-8 shadow-[0_20px_60px_rgba(139,92,246,.35)]">
        <div className="mb-4 flex items-center justify-between"><Link href="/" className="inline-flex items-center gap-1 text-xs text-[#b8a7e6] hover:text-white">{t("backHome")}</Link><div className="flex items-center gap-2"><LanguageSwitch compact /><ThemeToggle compact /></div></div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex items-center justify-center gap-2"><BrandLogo className="h-14 w-14 drop-shadow-[0_0_14px_rgba(255,184,0,.6)]" /><span className="text-3xl font-black"><span className="text-gold-grad">Win</span><span className="text-white">X</span><span className="text-violet-grad">555</span></span></div>
          <h1 className="text-2xl font-black text-white">{mode === "login" ? t("loginTitle") : t("signupTitle")}</h1>
          <p className="text-sm text-[#b8a7e6]">
            {mode === "login" ? t("loginSub") : t("signupSub")}
          </p>
        </div>
        <form action={formAction} className="space-y-4">
          {mode === "signup" && <input type="hidden" name="registrationIp" value={registrationIp} />}
          {mode === "signup" && (
            <Field label={t("fullName")} name="name" placeholder="Ali Khan" required />
          )}
          <Field label={mode === "login" ? t("phoneOrUsername") : t("phoneNumber")} name="phone" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={mode === "login" ? "03XXXXXXXXX / username / WX-ADM-0001" : "03XXXXXXXXX"} required />
          {mode === "signup" && <Field label={t("emailOptional")} name="email" type="email" placeholder="you@email.com" />}
          {mode === "signup" && <Field label={t("refOptional")} name="ref" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="e.g. ALIK7X2P" />}
          <Field label={t("password")} name="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
          {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>}
          <button
            disabled={pending}
            className="btn-gold w-full rounded-full py-3 font-black transition disabled:opacity-60"
          >
            {pending ? t("pleaseWait") : mode === "login" ? t("login") : t("register")}
          </button>
        </form>
        {mode === "login" && (
          <div className="mt-4 rounded-xl border border-dashed border-[#ffb800]/50 bg-[#ffb800]/10 p-3 text-xs">
            <button type="button" onClick={() => setShowDemo((v) => !v)} className="flex w-full items-center justify-between font-bold text-[#ffe0a3]"><span>Demo accounts (tap to fill)</span><span>{showDemo ? "▴" : "▾"}</span></button>
            {showDemo && (
              <ul className="mt-2 space-y-1.5">
                {DEMO_LOGINS.map((d) => (
                  <li key={d.id}><button type="button" onClick={() => { setLogin(d.id); setPw(d.pw); }} className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/30 px-2.5 py-1.5 text-left hover:bg-black/40">
                    <span><b className="text-white">{d.role}</b> <span className="text-[#b8a7e6]">— {d.name}</span></span>
                    <span className="shrink-0 font-mono text-[11px] text-[#ffb800]">{d.id} / {d.pw}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="mt-5 text-center text-sm text-slate-400">
          {mode === "login" ? (
            <>
              {t("noAccount")}{" "}
              <Link href="/signup" className="font-bold text-[#ffb800]">{t("register")}</Link>
            </>
          ) : (
            <>
              {t("haveAccount")}{" "}
              <Link href="/login" className="font-bold text-[#ffb800]">{t("login")}</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#e9ddff]">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-[#3a2470] bg-black/40 px-4 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-[#d946ef]"
      />
    </label>
  );
}
