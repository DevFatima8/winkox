"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, AppleIcon, AndroidIcon, LaptopIcon, TabletIcon, CheckIcon, ShareIcon } from "./Icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detect() {
  if (typeof navigator === "undefined") return { ios: false, android: false, ipad: false, mobile: false, safari: false, chrome: false, edge: false, firefox: false };
  const ua = navigator.userAgent || "";
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ios = /iPhone|iPod/.test(ua) || ipad;
  const android = /android/i.test(ua);
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  const chrome = /chrome|crios|edgios/i.test(ua) && !/opr|edg\//i.test(ua);
  const edge = /edg(e|ios)?\//i.test(ua);
  const firefox = /firefox|fxios/i.test(ua);
  return { ios, android, ipad, mobile: ios || android, safari, chrome, edge, firefox };
}

export const openInstallSheet = () => openExternal();
let openExternal: () => void = () => {};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [d, setD] = useState(detect());
  const [showBtn, setShowBtn] = useState(false);
  useEffect(() => { openExternal = () => setOpen(true); }, []);

  useEffect(() => {
    setD(detect());
    const sd = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (sd) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShowBtn(true); };
    const onInstalled = () => { setInstalled(true); setOpen(false); setShowBtn(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // browsers that never fire beforeinstallprompt (iOS Safari, Firefox): still show the button
    const t = setTimeout(() => setShowBtn(true), 1500);
    // gentle auto-suggest once after a while (does not block the page)
    const auto = setTimeout(() => {
      if (!localStorage.getItem("wx_install_dismissed")) setOpen(true);
    }, 12000);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); clearTimeout(auto); };
  }, []);

  const oneTap = async () => {
    if (deferred) {
      try { await deferred.prompt(); const { outcome } = await deferred.userChoice; setDeferred(null); if (outcome === "accepted") { setInstalled(true); setOpen(false); } }
      catch { setOpen(true); }
    } else setOpen(true);
  };
  const dismiss = () => { setOpen(false); try { localStorage.setItem("wx_install_dismissed", "1"); } catch {} };

  if (installed) return null;

  return (
    <>
      {showBtn && (
        <button onClick={() => setOpen(true)} className="keep-white fixed bottom-20 left-3 z-[45] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/40 transition hover:scale-105 md:bottom-6 md:left-6">
          <DownloadIcon size={16} /> Install App
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 sm:items-center sm:p-4" onClick={dismiss}>
          <div className="game-surface max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#3a2470] p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd45a] to-[#ff8a00] text-[#2a1500]"><DownloadIcon size={22} /></span>
                <div>
                  <div className="text-base font-black text-white">Install WinX555</div>
                  <div className="text-xs text-[#b8a7e6]">One tap away — works like a normal app</div>
                </div>
              </div>
              <button onClick={dismiss} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10"><XIcon size={18} /></button>
            </div>

            {/* TRUE one-tap install when the browser supports it */}
            {deferred && (
              <button onClick={oneTap} className="btn-gold mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black">
                <DownloadIcon size={20} /> Install Now
              </button>
            )}

            {d.android && (
              <Device n="Android phone / tablet" icon={<AndroidIcon size={20} className="text-emerald-400" />} ok={!!deferred}>
                {deferred ? (
                  <button onClick={oneTap} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white">Install on Home Screen</button>
                ) : (
                  <Steps items={["Open this site in Google Chrome (not Firefox/Opera Mini)", "Tap the <b>⋮</b> menu (top-right)", "Tap <b>Add to Home screen</b> → <b>Install</b>"]} />
                )}
              </Device>
            )}

            {d.ios && (
              <Device n={d.ipad ? "iPad" : "iPhone"} icon={<AppleIcon size={20} className="text-slate-200" />} ok={false}>
                <div className="rounded-xl bg-white/5 p-3 text-xs text-slate-300">
                  {!d.safari && <p className="mb-2 rounded-lg bg-red-500/15 px-2 py-1.5 font-bold text-red-300">iPhone only allows this from Safari — open this page in Safari.</p>}
                  <ol className="list-decimal space-y-1.5 pl-4">
                    <li>Tap the <b className="text-white">Share</b> button <ShareIcon size={14} className="inline text-[#8fd3ff]" /> (bottom center in Safari)</li>
                    <li>Choose <b className="text-white">Add to Home Screen</b></li>
                    <li>Tap <b className="text-white">Add</b> (top right) — done</li>
                  </ol>
                  <button onClick={() => { try { navigator.share?.({ title: "WinX555", url: location.href }); } catch {} }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a84ff] py-2.5 text-sm font-black text-white">
                    <ShareIcon size={15} /> Open Share menu
                  </button>
                </div>
              </Device>
            )}

            {!d.mobile && (
              <Device n="Laptop / PC / Mac" icon={<LaptopIcon size={20} className="text-sky-300" />} ok={!!deferred}>
                {deferred ? (
                  <button onClick={oneTap} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white">Install WinX555 App</button>
                ) : (
                  <Steps items={["Use <b>Google Chrome</b> or <b>Microsoft Edge</b>", "Click the install icon <span class='inline-flex h-4 w-4 items-center justify-center rounded border border-current'>⤓</span> at the right end of the address bar", "Press <b>Install</b> — shortcut appears on Desktop / Start Menu / Dock", "Mac Safari: File menu → Add to Dock"]} />
                )}
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px] text-slate-400">
                  <div className="rounded-lg bg-white/5 p-2"><AppleIcon size={20} className="mx-auto text-slate-200" />Mac</div>
                  <div className="rounded-lg bg-white/5 p-2"><LaptopIcon size={20} className="mx-auto text-sky-300" />Windows</div>
                  <div className="rounded-lg bg-white/5 p-2"><TabletIcon size={20} className="mx-auto text-violet-300" />Tablet</div>
                  <div className="rounded-lg bg-white/5 p-2"><AndroidIcon size={20} className="mx-auto text-emerald-400" />Android</div>
                </div>
              </Device>
            )}

            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300"><CheckIcon size={13} /> Installs directly from the browser — no Play Store / App Store needed. Runs online with an app icon on your home screen.</p>
            <button onClick={dismiss} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10">Maybe later</button>
          </div>
        </div>
      )}
    </>
  );
}

function Device({ n, icon, ok, children }: { n: string; icon: React.ReactNode; ok: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-2xl bg-black/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">{icon}{n}{ok && <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">1-tap ready</span>}</div>
      {children}
    </div>
  );
}
function Steps({ items }: { items: string[] }) {
  return <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-300">{items.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: s }} />)}</ol>;
}
