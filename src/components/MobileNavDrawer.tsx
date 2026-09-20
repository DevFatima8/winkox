"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, HomeIcon } from "./Icons";
import { Drawer as Panel } from "./Drawer";

export type MobileNavItem = { href: string; label: string; icon: ReactNode };

export function MobileNavDrawer({ items, title, footer }: { items: MobileNavItem[]; title: string; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Menu" className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/30 text-white ring-1 ring-[#3a2470]"><MenuIcon size={20} /></button>
      <Panel open={open} onClose={() => setOpen(false)} side="left" showClose={false}>
        <div className="flex items-center justify-between border-b wx-drawer-border px-4 py-3">
          <span className="font-black text-gold-grad">winkox · {title}</span>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10">✕</button>
        </div>
        <nav className="space-y-0.5 p-2">
          {items.map((n) => {
            const active = path === n.href || (n.href !== "/admin" && n.href !== "/client" && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-[#8b5cf6]/15 wx-rowtext ring-1 ring-[#8b5cf6]/40" : "wx-rowtext hover:wx-row"}`}>
                <span className="wx-rowicon">{n.icon}</span>{n.label}
              </Link>
            );
          })}
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold wx-rowtext hover:wx-row"><span className="wx-rowicon"><HomeIcon size={20} /></span>Home</Link>
        </nav>
        {footer && <div className="border-t wx-drawer-border p-3">{footer}</div>}
      </Panel>
    </>
  );
}

export function ActiveLink({ href, className, activeClassName, children, exact }: { href: string; className: string; activeClassName: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return <Link href={href} className={`${className} ${active ? activeClassName : ""}`}>{children}</Link>;
}
