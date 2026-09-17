"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "./Icons";

export type MobileNavItem = { href: string; label: string; icon: ReactNode };

export function MobileNavDrawer({ items, title, footer }: { items: MobileNavItem[]; title: string; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Menu" className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/30 text-white ring-1 ring-[#3a2470]"><MenuIcon size={20} /></button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-[82vw] max-w-xs flex-col bg-[#140c2a] shadow-2xl rtl:ml-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#3a2470] px-4 py-3">
              <span className="font-black text-white">{title}</span>
              <button onClick={() => setOpen(false)} className="text-[#b8a7e6]"><XIcon size={20} /></button>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
              {items.map((n) => {
                const active = path === n.href || (n.href !== "/" && n.href !== "/admin" && n.href !== "/client" && path.startsWith(n.href));
                return (
                  <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-[#8b5cf6]/20 text-white" : "text-[#e9ddff] hover:bg-[#8b5cf6]/10"}`}>
                    <span className="text-[#c4b5fd]">{n.icon}</span>{n.label}
                  </Link>
                );
              })}
            </nav>
            {footer && <div className="border-t border-[#3a2470] p-3">{footer}</div>}
          </aside>
        </div>
      )}
    </>
  );
}

export function ActiveLink({ href, className, activeClassName, children, exact }: { href: string; className: string; activeClassName: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return <Link href={href} className={`${className} ${active ? activeClassName : ""}`}>{children}</Link>;
}
