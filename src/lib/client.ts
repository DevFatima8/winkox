"use client";
/**
 * LocalDB mode: in-browser replacement for the old `/api/*` routes. Components call `localApi(url, init)`
 * exactly like `fetch()` and get a Response-like object back — but everything runs against localStorage.
 * (When a real database is connected again, swap `localApi` back to `fetch`.)
 */
import { getSessionSync } from "./auth";
import * as aviator from "./aviator";
import * as chicken from "./chicken";
import * as dash from "./chickendash";
import * as plinko from "./plinko";
import * as limbo from "./limbo";
import * as mines from "./mines";
import * as slot from "./slot777";
import * as cards from "./cards";
import * as gateway from "./gateway";
import * as support from "./support";
import * as notif from "./notifications";
import * as feedback from "./feedback";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Res = { ok: boolean; status: number; json: () => Promise<any> };
const res = (body: unknown, status = 200): Res => ({ ok: status < 400, status, json: async () => body });
const err = (message: string, status = 400) => res({ error: message }, status);
const LOGIN_MSG = "Khelne ke liye Login / Register karein.";

export async function localApi(url: string, init?: RequestInit): Promise<Res> {
  const u = new URL(url, "http://local");
  const path = u.pathname.replace(/\/$/, "");
  const q = u.searchParams;
  const method = (init?.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  if (init?.body) { try { body = JSON.parse(String(init.body)); } catch { body = {}; } }
  const sess = getSessionSync();
  const sid = sess?.id ?? null;
  const roleOk = () => !!sess && sess.role === "client";
  const out = (r: unknown) => res(r, r && typeof r === "object" && "error" in (r as object) && !("failed" in (r as object)) ? 400 : 200);
  try {
    switch (true) {
      // ---- Aviator / Aviator X
      case path === "/api/aviator/state": { const t = q.get("table") ?? "aviator"; if (!aviator.isTable(t)) return err("Invalid table"); return res(await aviator.getState(sid, t)); }
      case path === "/api/aviator/bet" && method === "POST": { if (!roleOk()) return err(LOGIN_MSG, 401); const t = String(body.table ?? "aviator"); if (!aviator.isTable(t)) return err("Invalid table"); return out(await aviator.placeBet(sid!, t, Number(body.amount), Number(body.slot ?? 0))); }
      case path === "/api/aviator/bet" && method === "DELETE": { if (!roleOk()) return err(LOGIN_MSG, 401); const t = q.get("table") ?? "aviator"; if (!aviator.isTable(t)) return err("Invalid table"); return out(await aviator.cancelBet(sid!, t, Number(q.get("slot") ?? 0))); }
      case path === "/api/aviator/cashout": { if (!roleOk()) return err(LOGIN_MSG, 401); const t = String(body.table ?? "aviator"); if (!aviator.isTable(t)) return err("Invalid table"); return out(await aviator.cashOut(sid!, t, Number(body.slot ?? 0))); }
      // ---- Chicken Road 2
      case path === "/api/chicken/state": return res(await chicken.getState(sid));
      case path === "/api/chicken/start": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await chicken.startGame(sid!, Number(body.amount), String(body.difficulty)));
      case path === "/api/chicken/step": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await chicken.step(sid!));
      case path === "/api/chicken/cashout": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await chicken.cashOut(sid!));
      // ---- Chicken Dash
      case path === "/api/chickendash/state": return res(await dash.getState(sid));
      case path === "/api/chickendash/start": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await dash.startGame(sid!, Number(body.amount), String(body.level ?? "")));
      case path === "/api/chickendash/step": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await dash.step(sid!));
      case path === "/api/chickendash/cashout": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await dash.cashOut(sid!));
      // ---- Plinko
      case path === "/api/plinko/state": return res(await plinko.getState(sid));
      case path === "/api/plinko/drop": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await plinko.drop(sid!, Number(body.amount), String(body.risk ?? ""), Number(body.rows)));
      // ---- Limbo / Mines / Slot
      case path === "/api/limbo" && method === "GET": return res(await limbo.getState(sid));
      case path === "/api/limbo": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await limbo.play(sid!, Number(body.amount), Number(body.target)));
      case path === "/api/mines" && method === "GET": return res(await mines.getState(sid));
      case path === "/api/mines": { if (!roleOk()) return err(LOGIN_MSG, 401); const a = String(body.action ?? ""); return out(a === "start" ? await mines.start(sid!, Number(body.amount), Number(body.mines)) : a === "reveal" ? await mines.reveal(sid!, Number(body.cell)) : a === "cashout" ? await mines.cashOut(sid!) : { error: "Invalid action" }); }
      case path === "/api/slot777" && method === "GET": return res(await slot.getState(sid));
      case path === "/api/slot777": if (!roleOk()) return err(LOGIN_MSG, 401); return out(await slot.spin(sid!, Number(body.amount)));
      // ---- WG Cards
      case path === "/api/cards/state": { const t = q.get("table") ?? ""; if (!cards.isTable(t)) return err("Invalid table"); return res(await cards.getState(sid, t)); }
      case path === "/api/cards/bet" && method === "POST": { if (!roleOk()) return err(LOGIN_MSG, 401); const t = String(body.table ?? ""); if (!cards.isTable(t)) return err("Invalid table"); return out(await cards.placeBet(sid!, t, String(body.option ?? ""), Number(body.amount))); }
      case path === "/api/cards/bet" && method === "DELETE": { if (!roleOk()) return err(LOGIN_MSG, 401); const t = q.get("table") ?? ""; if (!cards.isTable(t)) return err("Invalid table"); return out(await cards.cancelBets(sid!, t)); }
      // ---- Test gateway
      case path === "/api/gateway" && method === "GET": {
        if (!roleOk()) return err("Login required.", 401);
        const id = q.get("id");
        if (!id) { const c = await gateway.gatewayConfig(); return res({ enabled: c.enabled, autoWithdraw: c.autoWithdraw, label: c.label, maxPerTxn: c.maxPerTxn, dailyLimit: c.dailyLimit, minDeposit: c.minDeposit, minWithdraw: c.minWithdraw }); }
        const s = await gateway.getSession(sid!, id); return s ? res(s) : err("Not found", 404);
      }
      case path === "/api/gateway": {
        if (!roleOk()) return err("Login required.", 401);
        const a = String(body.action ?? "");
        const r = a === "create" ? await gateway.createSession(sid!, body.kind === "withdraw" ? "withdraw" : "deposit", String(body.provider) as "jazzcash" | "easypaisa", Number(body.amount), String(body.accountNumber ?? "").replace(/\s|-/g, ""), body.pin ? String(body.pin) : undefined)
          : a === "sendOtp" ? await gateway.sendOtp(sid!, String(body.id)) : a === "verify" ? await gateway.verifyOtp(sid!, String(body.id), String(body.otp ?? "")) : a === "cancel" ? await gateway.cancelSession(sid!, String(body.id)) : { error: "Invalid action" };
        return out(r);
      }
      // ---- Support / notifications / feedback
      case path === "/api/support" && method === "GET": return res(await support.getSupportState());
      case path === "/api/support": return out(await support.sendSupportMessage(String(body.text ?? ""), body.name ? String(body.name) : undefined));
      case path === "/api/notifications" && method === "GET": return res(await notif.getNotifications());
      case path === "/api/notifications": return sess ? res(await notif.markAllNotificationsRead()) : err("Unauthorized", 401);
      case path === "/api/admin/support" && method === "GET": {
        const t = q.get("thread");
        if (t) { const r = await support.adminThreadMessages(t); return "error" in r ? err(String(r.error), r.status ?? 400) : res(r); }
        const r = await support.adminListThreads(); return "error" in r ? err(String(r.error), 401) : res(r);
      }
      case path === "/api/admin/support" && method === "POST": return out(await support.adminReply(String(body.threadId ?? ""), String(body.text ?? "")));
      case path === "/api/admin/support" && method === "PATCH": return out(await support.adminReleaseThread(String(body.threadId ?? "")));
      case path === "/api/feedback": return out(await feedback.submitFeedback(body as { name?: string; phone?: string; type?: string; message?: string }));
      default: return err("Not found: " + path, 404);
    }
  } catch (e) {
    return err(String((e as Error)?.message ?? e), 500);
  }
}
