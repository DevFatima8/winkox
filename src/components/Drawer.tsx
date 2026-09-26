"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { XIcon } from "./Icons";

type Side = "left" | "right";

/**
 * Professional mobile drawer:
 *  - fully opaque dark backdrop — page content behind is never visible
 *  - backdrop tap and ✕ close it
 *  - slides in from the side; closes on route change / Escape
 *  - body scroll is locked while open
 */
export function Drawer({
  open, onClose, children, side = "left", widthClass = "w-1/2 max-w-none",
  z = 70, showClose = true,
}: { open: boolean; onClose: () => void; children: ReactNode; side?: Side; widthClass?: string; z?: number; showClose?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const sidePos = side === "right" ? "right-0" : "left-0";
  const translateClosed = side === "right" ? "translate-x-full rtl:-translate-x-full" : "-translate-x-full rtl:translate-x-full";

  // mount with the panel off-screen, then transition in
  useEffect(() => { if (open) setMounted(true); const t = setTimeout(() => setMounted(open), open ? 0 : 220); return () => clearTimeout(t); }, [open]);
  // close on route change
  useEffect(() => { if (open) onClose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);
  // lock body scroll + escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open && !mounted) return null;
  return (
    <div className="fixed inset-0" style={{ zIndex: z }} aria-hidden={!open}>
      {/* opaque overlay: completely hides page content */}
      <div
        onClick={onClose}
        className={`absolute inset-0 h-[100dvh] wx-drawer-overlay backdrop-blur-md transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        aria-label="Close menu"
      />
      {/* panel */}
      <aside
        className={`absolute inset-y-0 top-0 ${sidePos} flex h-[100dvh] ${widthClass} min-w-0 flex-col border shadow-[12px_0_40px_rgba(0,0,0,.4)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform ${side === "right" ? "rounded-l-[2rem] border-l" : "rounded-r-[2rem] border-r rtl:rounded-l-[2rem] rtl:rounded-r-none"} wx-drawer-panel ${open ? "translate-x-0" : translateClosed}`}
      >
        <div className="pointer-events-none absolute inset-y-5 right-0 z-20 w-px bg-gradient-to-b from-transparent via-[#00e5c0]/70 to-transparent opacity-80" />
        <div className="pointer-events-none absolute inset-x-8 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#ffb800]/80 to-transparent" />
        {showClose && (
          <button onClick={onClose} aria-label="Close menu" className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10 transition duration-200 hover:scale-105 hover:bg-white/10 active:scale-95">
            <XIcon size={18} />
          </button>
        )}
        <div className={`wx-scroll h-full overflow-y-auto overscroll-contain transition-[opacity,transform] duration-300 ease-out ${open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>{children}</div>
      </aside>
    </div>
  );
}

/** Hook + trigger button for convenience. */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, openDrawer: () => setOpen(true), closeDrawer: () => setOpen(false) };
}
