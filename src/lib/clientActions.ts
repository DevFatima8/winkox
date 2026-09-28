"use client";

import type { ActionState } from "@/lib/actions";
import { createSession, destroySession } from "@/lib/auth";

const readCookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1] ?? "";

export async function signupAction(_: ActionState, form: FormData): Promise<any> {
    if (!String(form.get("ref") ?? "").trim()) {
        const code = readCookie("ref").toUpperCase();
        if (code) form.set("ref", code);
    }
    const response = await fetch("/api/auth/signup", { method: "POST", body: form });
    const data = await response.json().catch(() => ({ error: "Signup failed. Server se connect nahi ho saka." }));
    if (!response.ok || data.error) return { error: data.error ?? "Signup failed." };
    await createSession({ id: data.id, role: data.role, name: data.name });
    return { success: "Account created successfully! Redirecting...", redirect: "/player" };
}

export async function loginAction(_: ActionState, form: FormData): Promise<any> {
    const response = await fetch("/api/auth/login", { method: "POST", body: form });
    const data = await response.json().catch(() => ({ error: "Login failed. Server se connect nahi ho saka." }));
    if (!response.ok || data.error) return { error: data.error ?? "Login failed." };
    await createSession({ id: data.id, role: data.role, name: data.name });
    return { success: "Login successful! Redirecting...", redirect: data.role === "admin" ? "/admin" : "/player" };
}

export async function logoutAction() {
    await fetch("/api/auth/logout", { method: "POST" });
    await destroySession();
    window.location.assign("/login");
}

async function submitWalletRequest(endpoint: string, form: FormData, fallback: string): Promise<ActionState> {
    const response = await fetch(endpoint, { method: "POST", body: form });
    const data = await response.json().catch(() => ({ error: fallback }));
    return response.ok ? { success: data.success } : { error: data.error ?? fallback };
}

export const depositAction = (_: ActionState, form: FormData) => submitWalletRequest("/api/player/deposit", form, "Deposit request submit nahi ho saki.");
export const withdrawAction = (_: ActionState, form: FormData) => submitWalletRequest("/api/player/withdraw", form, "Withdrawal request submit nahi ho saki.");

export async function processTransactionAction(id: string, decision: "approved" | "rejected", note?: string) {
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
    });
    const data = await response.json().catch(() => ({ error: "Transaction process nahi ho saki." }));
    return response.ok ? { success: data.success } : { error: data.error ?? "Transaction process nahi ho saki." };
}