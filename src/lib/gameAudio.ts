"use client";

let audioContext: AudioContext | null = null;

function getContext() {
    if (typeof window === "undefined") return null;
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
}

function tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    const ctx = getContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
}

export type GameSound = "jump" | "coin" | "danger" | "crash" | "launch" | "cashout" | "click";

export function playGameSound(sound: GameSound) {
    switch (sound) {
        case "jump":
            tone(260, 0.12, "sine", 0.05);
            tone(520, 0.16, "sine", 0.035, 0.07);
            break;
        case "coin":
            tone(880, 0.08, "square", 0.035);
            tone(1320, 0.14, "square", 0.025, 0.07);
            break;
        case "danger":
            tone(180, 0.18, "sawtooth", 0.045);
            tone(130, 0.22, "sawtooth", 0.035, 0.12);
            break;
        case "crash":
            tone(190, 0.3, "sawtooth", 0.06);
            tone(75, 0.42, "triangle", 0.05, 0.12);
            break;
        case "launch":
            tone(220, 0.16, "sine", 0.04);
            tone(440, 0.24, "sine", 0.045, 0.1);
            tone(660, 0.3, "sine", 0.04, 0.2);
            break;
        case "cashout":
            tone(520, 0.1, "sine", 0.04);
            tone(780, 0.12, "sine", 0.04, 0.08);
            tone(1040, 0.2, "sine", 0.035, 0.16);
            break;
        case "click":
            tone(340, 0.05, "square", 0.018);
            break;
    }
}