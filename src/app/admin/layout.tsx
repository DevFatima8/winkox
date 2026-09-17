"use client";
import { useEffect, type ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { useSession } from "@/lib/useDb";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && (!user || user.role !== "admin")) window.location.replace("/login"); }, [user, loading]);
  if (loading || !user || user.role !== "admin") return <div className="wx-bg flex min-h-screen items-center justify-center text-sm text-[#b8a7e6]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#00e5a0] border-t-transparent" /></div>;
  const superNav = user.level >= 2;
  const nav = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/support", label: "Live Support", icon: "💬" },
    { href: "/admin/users", label: "Users", icon: "👥" },
    { href: "/admin/transactions", label: "Deposits & Withdraws", icon: "💳" },
    { href: "/admin/feedback", label: "Feedback", icon: "📢" },
    { href: "/admin/games", label: superNav ? "Games On/Off" : "Games", icon: "🎮" },
    { href: "/admin/results", label: "Game Results", icon: "🎯" },
    { href: "/admin/records", label: "Records", icon: "📒" },
    { href: "/admin/agents", label: "Agents & Referrals", icon: "🤝" },
    { href: "/admin/notifications", label: "Notifications", icon: "🔔" },
    ...(superNav ? [
      { href: "/admin/staff", label: "Admins / Staff", icon: "🛡️" },
      { href: "/admin/logs", label: "Activity Logs", icon: "📜" },
      { href: "/admin/vip", label: "VIP Levels", icon: "👑" },
      { href: "/admin/help", label: "Help Center", icon: "📘" },
      { href: "/admin/payments", label: "Payment Accounts", icon: "🏦" },
      { href: "/admin/settings", label: "Settings", icon: "⚙️" },
    ] : []),
    { href: "/admin/account", label: "My Account", icon: "👤" },
  ];
  return (
    <Shell title={superNav ? "Super Admin" : "Admin"} nav={nav} userName={`${user.name}${user.adminId ? ` · ${user.adminId}` : ""}`} support={false} badge={<span className="btn-violet rounded-lg px-3 py-1 text-xs font-bold">{superNav ? "SUPER ADMIN" : "ADMIN"}</span>}>
      {children}
    </Shell>
  );
}
