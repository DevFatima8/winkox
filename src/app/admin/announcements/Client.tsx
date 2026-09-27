"use client";

import { useEffect, useState } from "react";

const input = "w-full rounded-lg border border-[#3a2470] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#d946ef]";

function AnnouncementEditor() {
  const [announcement, setAnnouncement] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    fetch("/api/announcements", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Announcement load nahi hui.");
      setAnnouncement(data.announcement);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "Announcement load nahi hui."));
  }, []);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ announcement }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Announcement save nahi hui.");
      setMessage("Announcement save ho gayi. Open pages par chand seconds mein update hogi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Announcement save nahi hui.");
    } finally {
      setPending(false);
    }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-white">Scrolling announcement</span>
        <textarea name="announcement" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} maxLength={500} required rows={4} className={input} />
      </label>
      <p className="text-xs text-[#b8a7e6]">Save ke baad har open page par announcement kuch seconds mein update hogi.</p>
      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.includes("save ho gayi") ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{message}</p>}
      <button disabled={pending} className="btn-gold rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">{pending ? "Saving..." : "Save announcement"}</button>
    </form>
  );
}

export default function AnnouncementsClient() {
  return (
    <section className="wx-card max-w-3xl rounded-xl p-4 sm:p-6">
      <h1 className="text-xl font-bold text-white">Announcements</h1>
      <p className="mb-5 mt-1 text-sm text-[#b8a7e6]">Yeh text public, player aur admin pages ke scrolling banner par dikhega.</p>
      <AnnouncementEditor />
    </section>
  );
}