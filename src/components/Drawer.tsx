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
  open, onClose, children, side = "left", widthClass = "w-[84vw] max-w-sm",
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
        className={`absolute inset-0 h-[100dvh] wx-drawer-overlay transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        aria-label="Close menu"
      />
      {/* panel */}
      <aside
        className={`absolute inset-y-0 top-0 ${sidePos} flex h-[100dvh] w-full ${widthClass} max-w-[90vw] flex-col border shadow-2xl transition-transform duration-200 ease-out ${side === "right" ? "border-l" : "border-r"} wx-drawer-panel ${open ? "translate-x-0" : translateClosed}`}
      >
        {showClose && (
          <button onClick={onClose} aria-label="Close menu" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10">
            <XIcon size={18} />
          </button>
        )}
        <div className="wx-scroll h-full overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    </div>
  );
}

/** Hook + trigger button for convenience. */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, openDrawer: () => setOpen(true), closeDrawer: () => setOpen(false) };
}
