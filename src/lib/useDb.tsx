"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onDbChange } from "./localdb";
import { getCurrentUser, type CurrentUser } from "./auth";

/** Run an async loader on mount and whenever the local database changes (any tab). */
export function useDb<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const ref = useRef(loader); ref.current = loader;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let alive = true;
    ref.current().then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  useEffect(() => onDbChange(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setTick((t) => t + 1), 250); }), []);
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("wx:admin-refresh", refresh);
    return () => window.removeEventListener("wx:admin-refresh", refresh);
  }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

/** Current logged-in user (undefined = loading, null = guest). Re-reads on db/session changes. */
export function useSession() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => { let alive = true; getCurrentUser().then((u) => alive && setUser(u)).catch(() => alive && setUser(null)); return () => { alive = false; }; }, [tick]);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const off = onDbChange(bump);
    window.addEventListener("wx:session", bump);
    return () => { off(); window.removeEventListener("wx:session", bump); };
  }, []);
  return { user, loading: user === undefined, refresh: () => setTick((t) => t + 1) };
}

/* ---------- page loader helper (client pages that used to be async server components) ---------- */
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
export const NOT_FOUND = "__NOT_FOUND__" as const;
export const REDIRECT = (to: string) => ({ __redirect: to });
export type PageResult = ReactNode | typeof NOT_FOUND | { __redirect: string };
export function usePage(loader: () => Promise<PageResult>, deps: unknown[] = []): ReactNode {
  const { data, error } = useDb(loader, deps);
  const redirectTo = data && typeof data === "object" && "__redirect" in (data as object) ? (data as { __redirect: string }).__redirect : null;
  useEffect(() => { if (redirectTo) window.location.replace(redirectTo); }, [redirectTo]);
  if (error) return <div className="rounded-xl bg-red-500/15 p-4 text-sm text-red-300">Error: {error}</div>;
  if (data === NOT_FOUND) notFound();
  if (data === null || redirectTo) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#b8a7e6]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#00e5a0] border-t-transparent" /></div>;
  return <>{data as ReactNode}</>;
}
