"use client";
import { useEffect, type ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { AdminLiveSync } from "@/components/AdminLiveSync";
import { useSession } from "@/lib/useDb";
import { useI18n } from "@/lib/i18n/client";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const { t } = useI18n();
  useEffect(() => { if (!loading && (!user || user.role !== "admin")) window.location.replace("/login"); }, [user, loading]);
  if (loading || !user || user.role !== "admin") return <div className="wx-bg flex min-h-screen items-center justify-center text-sm text-[#b8a7e6]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#00e5a0] border-t-transparent" /></div>;
  const superNav = user.level >= 2;
  const nav = [
    { href: "/admin", label: t("dashboard"), icon: "📊" },
    { href: "/admin/support", label: t("liveSupportAdmin"), icon: "💬" },
    { href: "/admin/users", label: t("usersAdmin"), icon: "👥" },
    { href: "/admin/deposits", label: t("depositsAdmin"), icon: "💳" },
    { href: "/admin/withdrawals", label: t("withdrawalsAdmin"), icon: "💳" },
    { href: "/admin/feedback", label: t("feedbackAdmin"), icon: "📢" },
    { href: "/admin/games", label: superNav ? t("gamesOnOff") : t("gamesAdmin"), icon: "🎮" },
    { href: "/admin/results", label: t("gameResultsAdmin"), icon: "🎯" },
    { href: "/admin/records", label: t("recordsAdmin"), icon: "📒" },
    { href: "/admin/agents", label: t("agentsAdmin"), icon: "🤝" },
    { href: "/admin/notifications", label: t("notificationsAdmin"), icon: "🔔" },
    ...(superNav ? [
      { href: "/admin/staff", label: t("staffAdmin"), icon: "🛡️" },
      { href: "/admin/logs", label: t("activityLogs"), icon: "📜" },
      { href: "/admin/cleanup", label: t("historyCleanup"), icon: "🧹" },
      { href: "/admin/vip", label: t("vipLevelsAdmin"), icon: "👑" },
      { href: "/admin/help", label: t("helpCenterAdmin"), icon: "📘" },
      { href: "/admin/payments", label: t("paymentAccountsAdmin"), icon: "🏦" },
      { href: "/admin/settings", label: t("settingsAdmin"), icon: "⚙️" },
    ] : []),
    { href: "/admin/account", label: t("myAccountAdmin"), icon: "👤" },
  ];
  return (
    <Shell title={superNav ? t("superAdmin") : t("admin")} nav={nav} userName={`${user.name}${user.adminId ? ` · ${user.adminId}` : ""}`} support={false} showInstallPrompt={false} badge={<span className="btn-violet rounded-lg px-3 py-1 text-xs font-bold">{superNav ? t("superAdmin") : t("admin")}</span>}>
      <AdminLiveSync />
      {children}
    </Shell>
  );
}
