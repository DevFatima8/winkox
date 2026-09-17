"use client";
import { useEffect, type ReactNode } from "react";
import { Shell, fmt } from "@/components/Shell";
import { useSession } from "@/lib/useDb";
import { useI18n } from "@/lib/i18n/client";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const { t } = useI18n();
  useEffect(() => {
    if (loading) return;
    if (!user) window.location.replace("/login");
    else if (user.role === "admin") window.location.replace("/admin");
  }, [user, loading]);
  if (loading || !user || user.role !== "client") return <div className="wx-bg flex min-h-screen items-center justify-center text-sm text-[#b8a7e6]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#00e5a0] border-t-transparent" /></div>;
  const nav = [
    { href: "/client", label: t("games"), icon: "🎮" },
    { href: "/client/wallet", label: t("wallet"), icon: "💰" },
    { href: "/client/team", label: t("invite"), icon: "🤝" },
    { href: "/client/history", label: t("history"), icon: "🧾" },
    { href: "/client/profile", label: t("profile"), icon: "👤" },
    { href: "/client/notifications", label: t("notifications"), icon: "🔔" },
    { href: "/help", label: t("helpCenter"), icon: "📘" },
  ];
  return (
    <Shell title="Player" nav={nav} userName={user.name} badge={<div className="btn-gold rounded-xl px-3 py-2"><div className="text-[10px] font-semibold uppercase">{t("balance")}</div><div className="text-lg font-black">{fmt(user.balance)}</div></div>}>
      {children}
    </Shell>
  );
}
