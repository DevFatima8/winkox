"use client";

import { localApi } from "@/lib/client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { ChatIcon, HeadsetIcon, XIcon, SendIcon, WhatsAppIcon, TelegramIcon } from "@/components/Icons";

type M = { id: string; from: "user" | "agent" | "system"; text: string; agentName: string | null; at: string };
type S = { online: boolean; hours: string; welcome: string; offlineMessage: string; links: { whatsapp?: string; telegram?: string; whatsappChannel?: string; telegramChannel?: string }; threadId: string | null; messages: M[] };

export function SupportWidget({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [s, setS] = useState<S | null>(null);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const seen = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await localApi("/api/support", { cache: "no-store" });
    if (!r.ok) return;
    const j: S = await r.json();
    setS(j);
    const agentMsgs = j.messages.filter((m) => m.from !== "user").length;
    if (!open && agentMsgs > seen.current && seen.current > 0) setUnread(agentMsgs - seen.current);
    if (open) seen.current = agentMsgs;
    else if (seen.current === 0) seen.current = agentMsgs;
  }, [open]);

  useEffect(() => { load(); const id = setInterval(load, open ? 3000 : 15000); return () => clearInterval(id); }, [load, open]);
  useEffect(() => { if (open) { setUnread(0); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50); } }, [open, s?.messages.length]);
  useEffect(() => { const h = () => setOpen(true); window.addEventListener("wx:open-support", h); return () => window.removeEventListener("wx:open-support", h); }, []);

  const send = async () => {
    const t = text.trim(); if (!t) return;
    setText("");
    await localApi("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, name: userName }) });
    load();
  };

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="fixed bottom-24 left-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-xl shadow-[0_8px_24px_rgba(139,92,246,.5)] md:bottom-6 md:left-auto md:right-20" aria-label="Live support">
        {open ? <XIcon size={22} /> : <ChatIcon size={22} />}
        {!open && <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-[#0b0716] ${s?.online ? "bg-emerald-400" : "bg-red-400"}`} />}
        {!open && unread > 0 && <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff3b5c] text-[10px] font-black text-white">{unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-2 bottom-[9.5rem] z-50 mx-auto flex h-[70vh] max-h-[560px] w-auto max-w-sm flex-col overflow-hidden rounded-2xl border border-[#3a2470] bg-[#140c2a] shadow-2xl md:bottom-20 md:left-auto md:right-6 md:inset-x-auto md:w-96">
          <div className="on-image flex items-center justify-between bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"><HeadsetIcon size={18} /></span>
              <div><div className="text-sm font-black text-white">{t("supportTitle")}</div><div className="flex items-center gap-1 text-[11px] text-white/85"><span className={`h-2 w-2 rounded-full ${s?.online ? "bg-emerald-300" : "bg-red-300"}`} />{s?.online ? t("onlineAgent") : t("offlineHours", { h: s?.hours ?? "" })}</div></div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><XIcon size={18} /></button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {(!s || s.messages.length === 0) && (
              <div className="rounded-2xl rounded-bl-sm bg-black/40 px-3 py-2 text-sm text-white ring-1 ring-[#3a2470]">
                {s?.welcome || t("defaultWelcome")}
                {s && !s.online && <div className="mt-2 text-xs text-[#ffe0a3]">{s.offlineMessage}</div>}
              </div>
            )}
            {s?.messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "btn-violet rounded-br-sm" : m.from === "system" ? "bg-[#ffb800]/15 text-[#ffe0a3] ring-1 ring-[#ffb800]/30" : "bg-black/40 text-white rounded-bl-sm ring-1 ring-[#3a2470]"}`}>
                  {m.from === "agent" && <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-[#c4b5fd]"><HeadsetIcon size={10} /> {m.agentName ?? "Agent"}</div>}
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {(s?.links?.whatsapp || s?.links?.telegram) && (
            <div className="flex gap-2 px-3 pb-1 text-[11px]">
              {s.links.whatsapp && <a href={s.links.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#25d366]/20 px-2.5 py-1 font-bold text-[#7ee2a0]"><WhatsAppIcon size={12} /> WhatsApp</a>}
              {s.links.telegram && <a href={s.links.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#29a9ea]/20 px-2.5 py-1 font-bold text-[#8fd3ff]"><TelegramIcon size={12} /> Telegram</a>}
            </div>
          )}
          <div className="flex gap-2 border-t border-[#3a2470] p-2.5">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t("typeMessage")} className="flex-1 rounded-xl border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#d946ef]" />
            <button onClick={send} className="btn-gold flex items-center justify-center rounded-xl px-4 py-2" aria-label="Send"><SendIcon size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
