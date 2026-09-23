"use client";

import { useEffect, useState } from "react";

type Result = { game: string; win: number; bet: number; won: boolean };

export function GameResultPopup() {
    const [result, setResult] = useState<Result | null>(null);
    useEffect(() => {
        const handle = (event: Event) => setResult((event as CustomEvent<Result>).detail);
        window.addEventListener("wx:game-result", handle);
        return () => window.removeEventListener("wx:game-result", handle);
    }, []);
    if (!result) return null;
    return (
        <div className="fixed inset-x-4 top-1/2 z-[105] mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-[#00e5a0]/40 bg-[#0d1b22] p-5 text-center text-white shadow-2xl shadow-[#00e5a0]/20">
            <div className="text-3xl">{result.won ? "🎉" : "🎮"}</div>
            <h2 className="mt-2 text-xl font-black">{result.won ? "Congratulations!" : "Round complete"}</h2>
            <p className="mt-1 text-sm text-[#8fb3bd]">Bet Rs. {result.bet.toLocaleString()} · {result.won ? `You won Rs. ${result.win.toLocaleString()}` : "No win this round"}</p>
            <div className="mt-4 flex gap-2"><button type="button" onClick={() => window.location.reload()} className="btn-gold flex-1 rounded-xl py-2.5 font-black">Play Again</button><button type="button" onClick={() => setResult(null)} className="btn-outline flex-1 rounded-xl py-2.5 font-bold">Close</button></div>
        </div>
    );
}