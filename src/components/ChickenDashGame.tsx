"use client";

import { localApi } from "@/lib/client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------- types ---------------- */
type Level = "easy" | "normal" | "hard";
type G = {
  id: string; level: Level; bet: number; lanes: number; position: number; status: "active" | "cashed" | "dead"; win: number;
  multiplier: number; nextMultiplier: number | null; potential: number; bagLane: number | null; bagMult: number; bagCollected: boolean;
  crashLane: number | null; dashes: { from: number; to: number }[];
};
type Recent = { id: string; level: string; bet: number; win: number; status: string; position: number; multiplier: number };
type State = {
  game: G | null; balance: number; ladders: Record<Level, number[]>;
  levels: Record<Level, { label: string; steps: number; max: number }>; limits: { min: number; max: number }; recent: Recent[];
};
const LEVELS: Level[] = ["easy", "normal", "hard"];

/* ---------------- scene constants ---------------- */
const H = 440, LANE_W = 84, SIDE_W = 150, ROW_Y = 250, TILE = 60;
type CarType = "sedan" | "taxi" | "pickup" | "bus" | "truck";
const CAR_TYPES: CarType[] = ["sedan", "taxi", "pickup", "bus", "truck", "sedan", "sedan"];
const CAR_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#e11d48", "#0ea5e9"];
type Car = { type: CarType; color: string; y: number; speed: number; dir: 1 | -1 };
type Fx = { x: number; y: number; vx: number; vy: number; life: number; kind: "feather" | "coin" | "spark"; rot: number };
type Van = { lane: number; y: number; dropped: boolean } | null;
type View = { w: number; h: number; scale: number; dpr: number };
type Vis = {
  lanes: number; ladder: number[]; pos: number; cx: number;
  hop: { fromX: number; toX: number; start: number; dur: number; dash?: boolean; done?: () => void } | null;
  passed: boolean[]; traffic: Car[][]; nextSpawn: number[]; dir: (1 | -1)[];
  killer: { lane: number; y: number; type: CarType; color: string; hit: boolean; done?: () => void } | null;
  dead: boolean; ghostT: number; fx: Fx[]; camX: number; camInit: boolean; lastT: number;
  status: "idle" | "active" | "cashed" | "dead" | "finished";
  bagLane: number; bagMult: number; bagVisible: boolean; bagCollected: boolean; van: Van;
  floats: { x: number; y: number; text: string; color: string; life: number }[];
  dashUntil: number;
};

const laneX = (l: number) => SIDE_W + (l - 0.5) * LANE_W;
const posX = (p: number, lanes: number) => (p <= 0 ? SIDE_W - 46 : p > lanes ? SIDE_W + lanes * LANE_W + 46 : laneX(p));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const trim = (n: number, d: number) => String(parseFloat(n.toFixed(d)));
const fmtMult = (m: number) => "x" + (m >= 10000 ? trim(m / 1000, 1) + "K" : m >= 1000 ? m.toLocaleString("en-US", { maximumFractionDigits: 0 }) : m >= 100 ? trim(m, 1) : trim(m, 2));
const money = (n: number) => "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 2 });

function newVis(ladder: number[], prev?: Vis | null): Vis {
  const lanes = ladder.length;
  const traffic: Car[][] = Array.from({ length: lanes + 2 }, () => []);
  const dir: (1 | -1)[] = Array.from({ length: lanes + 2 }, (_, i) => (i % 3 === 2 ? -1 : 1));
  for (let l = 1; l <= lanes; l++) if (Math.random() < 0.5) traffic[l].push({ type: pick(CAR_TYPES), color: pick(CAR_COLORS), y: rnd(-40, H + 40), speed: rnd(120, 210), dir: dir[l] });
  return {
    lanes, ladder, pos: 0, cx: posX(0, lanes), hop: null, passed: Array(lanes + 2).fill(false), traffic,
    nextSpawn: Array.from({ length: lanes + 2 }, () => performance.now() + rnd(300, 3000)), dir,
    killer: null, dead: false, ghostT: 0, fx: [], camX: prev?.camX ?? 0, camInit: prev?.camInit ?? false, lastT: 0, status: "idle",
    bagLane: 0, bagMult: 0, bagVisible: false, bagCollected: false, van: null, floats: [], dashUntil: 0,
  };
}
function applyGame(v: Vis, g: G) {
  v.status = "active"; v.pos = g.position; v.cx = posX(g.position, v.lanes); v.dead = false; v.killer = null; v.hop = null;
  for (let l = 1; l <= v.lanes; l++) v.passed[l] = l <= g.position;
  v.bagLane = g.bagLane ?? 0; v.bagMult = g.bagMult; v.bagCollected = g.bagCollected; v.bagVisible = !!g.bagLane && !g.bagCollected && g.bagLane > g.position;
}
function hopTo(v: Vis, p: number, dash: boolean, done?: () => void) {
  v.hop = { fromX: v.cx, toX: posX(p, v.lanes), start: performance.now(), dur: dash ? 260 + 120 * Math.abs(p - v.pos) : 330, dash, done: () => { v.pos = p; done?.(); } };
}
function burst(v: Vis, x: number, y: number, kind: Fx["kind"], n: number) {
  for (let i = 0; i < n; i++) v.fx.push({ x, y, vx: rnd(-190, 190), vy: kind === "feather" ? rnd(-260, -40) : rnd(-430, -150), life: 1, kind, rot: rnd(0, 6.28) });
}
function float(v: Vis, x: number, y: number, text: string, color: string) { v.floats.push({ x, y, text, color, life: 1 }); }

/* ---------------- update ---------------- */
function update(v: Vis, dt: number, now: number, view: View) {
  const s = dt / 1000;
  if (v.hop) {
    const t = Math.min(1, (now - v.hop.start) / v.hop.dur);
    const e = v.hop.dash ? t : 1 - Math.pow(1 - t, 3);
    v.cx = v.hop.fromX + (v.hop.toX - v.hop.fromX) * e;
    if (t >= 1) { const d = v.hop.done; v.hop = null; d?.(); }
  }
  const chickenLane = v.hop ? -1 : v.pos;
  for (let l = 1; l <= v.lanes; l++) {
    const cars = v.traffic[l];
    const dashing = now < v.dashUntil && l > chickenLane && l <= chickenLane + 3;
    if (now >= v.nextSpawn[l]) {
      v.nextSpawn[l] = now + rnd(1500, 4800);
      const blocked = (v.passed[l] && l !== v.lanes + 1) || dashing || l === v.pos;
      if (!blocked && !cars.some((c) => (v.dir[l] === 1 ? c.y < 120 : c.y > H - 120)))
        cars.push({ type: pick(CAR_TYPES), color: pick(CAR_COLORS), y: v.dir[l] === 1 ? -120 : H + 120, speed: rnd(120, 210), dir: v.dir[l] });
    }
    for (const c of cars) {
      // cars in the chicken's lane (or passed lanes) stop before the tile row like at a crossing
      const stopY = c.dir === 1 ? ROW_Y - 78 : ROW_Y + 78;
      const mustStop = (v.passed[l] || l === v.pos) && (c.dir === 1 ? c.y < stopY : c.y > stopY);
      if (mustStop) {
        const gap = c.dir === 1 ? stopY - c.y : c.y - stopY;
        const sp = Math.min(c.speed, Math.max(0, gap * 3));
        c.y += sp * s * c.dir;
      } else c.y += c.speed * s * c.dir;
    }
    v.traffic[l] = cars.filter((c) => c.y > -160 && c.y < H + 160);
  }
  if (v.killer) {
    const k = v.killer;
    k.y += 760 * s;
    if (!k.hit && k.y + 36 >= ROW_Y) { k.hit = true; v.dead = true; burst(v, v.cx, ROW_Y, "feather", 16); }
    if (k.y > H + 140) { const d = k.done; v.killer = null; d?.(); }
  }
  if (v.dead) v.ghostT += s;
  if (v.van) {
    v.van.y += 300 * s;
    if (!v.van.dropped && v.van.y >= ROW_Y - 6) { v.van.dropped = true; v.bagVisible = true; float(v, laneX(v.van.lane), ROW_Y - 50, "BONUS BAG!", "#fbbf24"); }
    if (v.van.y > H + 140) v.van = null;
  }
  for (const f of v.fx) { f.vy += (f.kind === "feather" ? 260 : 980) * s; f.x += f.vx * s; f.y += f.vy * s; f.rot += s * 4; f.life -= s / (f.kind === "feather" ? 1.6 : 1.1); }
  v.fx = v.fx.filter((f) => f.life > 0);
  for (const f of v.floats) { f.y -= 40 * s; f.life -= s / 1.4; }
  v.floats = v.floats.filter((f) => f.life > 0);
  const worldW = SIDE_W * 2 + v.lanes * LANE_W;
  const maxCam = worldW - view.w;
  const target = maxCam <= 0 ? maxCam / 2 : Math.max(0, Math.min(maxCam, v.cx - view.w * 0.4));
  if (!v.camInit) { v.camX = target; v.camInit = true; } else v.camX += (target - v.camX) * Math.min(1, s * 6);
}

/* ---------------- drawing helpers ---------------- */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, r = 24) {
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(x + 5, y + 6, r, r * .85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2f8f3a"; circle(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = "#4db056"; circle(ctx, x - r * .3, y - r * .3, r * .5); ctx.fill();
  ctx.fillStyle = "#227a2e"; circle(ctx, x + r * .35, y + r * .3, r * .28); ctx.fill();
}
function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#3c9a46"; rr(ctx, x - 18, y - 10, 36, 22, 11); ctx.fill();
  ctx.fillStyle = "#5cb86a"; rr(ctx, x - 12, y - 8, 14, 9, 5); ctx.fill();
}
function drawFence(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  ctx.fillStyle = "#c98a4b";
  for (let y = y0; y < y1; y += 22) { rr(ctx, x - 3, y, 6, 16, 2); ctx.fill(); }
  ctx.fillStyle = "#b8783c"; ctx.fillRect(x - 4, y0 + 4, 8, y1 - y0 - 4);
}
function drawCoop(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.2)"; rr(ctx, x - 30, y - 10, 66, 52, 6); ctx.fill();
  ctx.fillStyle = "#d9534f"; ctx.beginPath(); ctx.moveTo(x - 36, y); ctx.lineTo(x, y - 32); ctx.lineTo(x + 36, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2c66d"; rr(ctx, x - 30, y, 60, 42, 4); ctx.fill();
  ctx.fillStyle = "#6b3e1e"; rr(ctx, x - 9, y + 14, 18, 28, 3); ctx.fill();
  ctx.fillStyle = "#fff7d6"; circle(ctx, x + 18, y + 14, 6); ctx.fill();
}
function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6b7280"; rr(ctx, x - 2, y - 44, 4, 60, 2); ctx.fill();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? "#111" : "#fff"; ctx.fillRect(x + 2 + i * 8, y - 44 + j * 8, 8, 8); }
}
function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, passed: boolean, next: boolean, now: number, isBag: boolean) {
  ctx.fillStyle = "rgba(0,0,0,.22)"; rr(ctx, x - TILE / 2 + 3, y - TILE / 2 + 4, TILE, TILE, 12); ctx.fill();
  ctx.fillStyle = passed ? "#22c55e" : "#3f4650"; rr(ctx, x - TILE / 2, y - TILE / 2, TILE, TILE, 12); ctx.fill();
  ctx.strokeStyle = passed ? "#86efac" : "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = passed ? "#16a34a" : "#2b3038"; rr(ctx, x - TILE / 2 + 6, y - TILE / 2 + 6, TILE - 12, TILE - 12, 8); ctx.fill();
  if (next) { const a = .5 + .5 * Math.sin(now / 160); ctx.strokeStyle = `rgba(250,204,21,${a})`; ctx.lineWidth = 4; rr(ctx, x - TILE / 2 - 4, y - TILE / 2 - 4, TILE + 8, TILE + 8, 15); ctx.stroke(); }
  ctx.font = `900 ${label.length > 6 ? 11 : 13}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = passed ? "#ecfdf5" : "#fde68a"; ctx.fillText(label, x, y + (isBag ? 12 : 0));
  if (passed) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "bold 11px system-ui"; ctx.fillText("", x, y - 18); }
}
function drawBag(ctx: CanvasRenderingContext2D, x: number, y: number, bob: number) {
  const yy = y + Math.sin(bob) * 3;
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x, yy + 14, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#b07a3b"; ctx.beginPath(); ctx.ellipse(x, yy + 2, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8f5f2a"; rr(ctx, x - 7, yy - 15, 14, 8, 3); ctx.fill();
  ctx.fillStyle = "#d9a15e"; ctx.beginPath(); ctx.ellipse(x - 4, yy - 1, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fef3c7"; ctx.font = "900 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", x, yy + 3);
}
const CAR_DIMS: Record<CarType, [number, number]> = { sedan: [42, 70], taxi: [42, 70], pickup: [44, 82], bus: [46, 118], truck: [46, 128] };
function drawCar(ctx: CanvasRenderingContext2D, c: { type: CarType; color: string; dir: 1 | -1 }, cx: number, cy: number) {
  const [w, h] = CAR_DIMS[c.type];
  ctx.save(); ctx.translate(cx, cy); if (c.dir === -1) ctx.rotate(Math.PI);
  const x = -w / 2, y = -h / 2;
  ctx.fillStyle = "rgba(0,0,0,.28)"; rr(ctx, x + 3, y + 5, w, h, 9); ctx.fill();
  ctx.fillStyle = "#151515"; for (const [wx, wy] of [[x - 3, y + 10], [x + w - 4, y + 10], [x - 3, y + h - 26], [x + w - 4, y + h - 26]]) { rr(ctx, wx, wy, 7, 16, 2); ctx.fill(); }
  const body = c.type === "taxi" ? "#facc15" : c.type === "bus" ? "#2563eb" : c.type === "truck" ? "#e5e7eb" : c.color;
  ctx.fillStyle = body; rr(ctx, x, y, w, h, 9); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  if (c.type === "truck") {
    ctx.fillStyle = c.color; rr(ctx, x + 2, y + 34, w - 4, h - 38, 5); ctx.fill();
    ctx.fillStyle = "#93c5fd"; rr(ctx, x + 6, y + 8, w - 12, 12, 3); ctx.fill();
  } else if (c.type === "bus") {
    ctx.fillStyle = "#bfdbfe"; for (let yy = y + 16; yy < y + h - 20; yy += 16) { rr(ctx, x + 5, yy, 8, 10, 2); ctx.fill(); rr(ctx, x + w - 13, yy, 8, 10, 2); ctx.fill(); }
    ctx.fillStyle = "#93c5fd"; rr(ctx, x + 6, y + 4, w - 12, 10, 3); ctx.fill();
  } else if (c.type === "pickup") {
    ctx.fillStyle = "rgba(0,0,0,.35)"; rr(ctx, x + 5, y + 40, w - 10, h - 46, 4); ctx.fill();
    ctx.fillStyle = "#cfe9ff"; rr(ctx, x + 6, y + 12, w - 12, 9, 3); ctx.fill(); rr(ctx, x + 6, y + 30, w - 12, 6, 2); ctx.fill();
  } else {
    ctx.fillStyle = "#cfe9ff"; rr(ctx, x + 6, y + 12, w - 12, 12, 3); ctx.fill(); rr(ctx, x + 6, y + h - 24, w - 12, 9, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)"; rr(ctx, x + 7, y + 26, w - 14, h - 52, 5); ctx.fill();
    if (c.type === "taxi") { ctx.fillStyle = "#111"; rr(ctx, -10, -4, 20, 8, 2); ctx.fill(); ctx.fillStyle = "#facc15"; for (let i = 0; i < 4; i++) ctx.fillRect(-9 + i * 5, -3 + (i % 2) * 3, 2.5, 2.5); }
  }
  ctx.fillStyle = "#fff9c4"; rr(ctx, x + 4, y + 1, 9, 4, 1); ctx.fill(); rr(ctx, x + w - 13, y + 1, 9, 4, 1); ctx.fill();
  ctx.fillStyle = "#ff5252"; rr(ctx, x + 4, y + h - 5, 9, 4, 1); ctx.fill(); rr(ctx, x + w - 13, y + h - 5, 9, 4, 1); ctx.fill();
  ctx.restore();
}
function drawVan(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const w = 46, h = 84, x = cx - w / 2, y = cy - h / 2;
  ctx.fillStyle = "rgba(0,0,0,.28)"; rr(ctx, x + 3, y + 5, w, h, 9); ctx.fill();
  ctx.fillStyle = "#151515"; for (const [wx, wy] of [[x - 3, y + 12], [x + w - 4, y + 12], [x - 3, y + h - 28], [x + w - 4, y + h - 28]]) { rr(ctx, wx, wy, 7, 16, 2); ctx.fill(); }
  ctx.fillStyle = "#f8fafc"; rr(ctx, x, y, w, h, 9); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#93c5fd"; rr(ctx, x + 6, y + 8, w - 12, 12, 3); ctx.fill();
  ctx.fillStyle = "#16a34a"; rr(ctx, x + 5, y + 28, w - 10, h - 36, 6); ctx.fill();
  ctx.fillStyle = "#fef3c7"; ctx.font = "900 22px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", cx, cy + 12);
}
function drawChick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dead: boolean, ghostT: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (dead) {
    // flattened chick + rising ghost
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(0, 16, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(0, 12, 30, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e0a800"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#ff8a00"; ctx.beginPath(); ctx.moveTo(24, 8); ctx.lineTo(36, 12); ctx.lineTo(24, 15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#222"; ctx.lineWidth = 2; for (const ex of [6, 16]) { ctx.beginPath(); ctx.moveTo(ex - 3, 6); ctx.lineTo(ex + 3, 12); ctx.moveTo(ex + 3, 6); ctx.lineTo(ex - 3, 12); ctx.stroke(); }
    const gy = -20 - ghostT * 45, ga = Math.max(0, 1 - ghostT / 2.2);
    ctx.globalAlpha = ga * .85;
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, gy, 16, Math.PI, 0); ctx.lineTo(16, gy + 18); ctx.lineTo(10, gy + 12); ctx.lineTo(4, gy + 18); ctx.lineTo(-2, gy + 12); ctx.lineTo(-8, gy + 18); ctx.lineTo(-16, gy + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#222"; circle(ctx, -5, gy - 2, 2); ctx.fill(); circle(ctx, 5, gy - 2, 2); ctx.fill();
    ctx.fillStyle = "#ff8a00"; ctx.beginPath(); ctx.moveTo(-3, gy + 4); ctx.lineTo(3, gy + 4); ctx.lineTo(0, gy + 8); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore(); return;
  }
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 22, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ff8a00"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
  ctx.moveTo(-6, 14); ctx.lineTo(-7, 22); ctx.moveTo(-11, 24); ctx.lineTo(-7, 22); ctx.lineTo(-3, 24); ctx.moveTo(6, 14); ctx.lineTo(5, 22); ctx.moveTo(1, 24); ctx.lineTo(5, 22); ctx.lineTo(9, 24); ctx.stroke();
  ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(0, 4, 20, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e0a800"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#ffe98a"; ctx.beginPath(); ctx.ellipse(2, 9, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f5c518"; ctx.beginPath(); ctx.ellipse(-12, 4, 8, 5, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffd23f"; circle(ctx, 9, -12, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e53935"; for (const [cx2, cy2] of [[4, -25], [9, -28], [14, -25]]) { circle(ctx, cx2, cy2, 3.5); ctx.fill(); }
  ctx.fillStyle = "#ff8a00"; ctx.beginPath(); ctx.moveTo(21, -14); ctx.lineTo(34, -10); ctx.lineTo(21, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; circle(ctx, 14, -14, 5); ctx.fill(); ctx.fillStyle = "#1a1a1a"; circle(ctx, 15, -14, 3); ctx.fill(); ctx.fillStyle = "#fff"; circle(ctx, 16, -15, 1); ctx.fill();
  ctx.fillStyle = "#ffb3b3"; circle(ctx, 20, -7, 2.5); ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, v: Vis, view: View, now: number) {
  const { w, h } = view;
  ctx.clearRect(0, 0, w, h);
  ctx.save(); ctx.translate(-v.camX, 0);
  const road0 = SIDE_W, road1 = SIDE_W + v.lanes * LANE_W;
  // grass
  ctx.fillStyle = "#6fb84a"; ctx.fillRect(v.camX - 10, 0, w + 20, h);
  ctx.fillStyle = "rgba(255,255,255,.05)"; for (let y = 0; y < h; y += 28) ctx.fillRect(v.camX - 10, y, w + 20, 14);
  // curbs
  ctx.fillStyle = "#d1d5db"; ctx.fillRect(road0 - 18, 0, 18, h); ctx.fillRect(road1, 0, 18, h);
  ctx.fillStyle = "#9ca3af"; ctx.fillRect(road0 - 18, 0, 3, h); ctx.fillRect(road1 + 15, 0, 3, h);
  // road
  ctx.fillStyle = "#555b66"; ctx.fillRect(road0, 0, road1 - road0, h);
  ctx.fillStyle = "#f5c518"; ctx.fillRect(road0, 0, 4, h); ctx.fillRect(road1 - 4, 0, 4, h);
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 3; ctx.setLineDash([22, 18]); ctx.beginPath();
  for (let l = 1; l < v.lanes; l++) { const x = road0 + l * LANE_W; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  ctx.stroke(); ctx.setLineDash([]);
  // crossing row shading
  ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(road0, ROW_Y - 44, road1 - road0, 88);
  // scenery
  drawTree(ctx, road0 - 105, 70, 26); drawBush(ctx, road0 - 60, 140); drawCoop(ctx, road0 - 90, 300); drawFence(ctx, road0 - 40, 40, 200); drawTree(ctx, road0 - 110, 400, 22);
  drawTree(ctx, road1 + 100, 60, 24); drawBush(ctx, road1 + 60, 150); drawFlag(ctx, road1 + 70, ROW_Y + 10); drawBush(ctx, road1 + 110, 320); drawTree(ctx, road1 + 95, 400, 26);
  ctx.fillStyle = "rgba(0,0,0,.35)"; rr(ctx, road1 + 30, ROW_Y + 40, 100, 26, 8); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FINISH", road1 + 80, ROW_Y + 53);
  // tiles
  const next = v.status === "active" && !v.hop ? v.pos + 1 : -1;
  for (let l = 1; l <= v.lanes; l++) drawTile(ctx, laneX(l), ROW_Y, fmtMult(v.ladder[l - 1]), v.passed[l], l === next, now, v.bagVisible && v.bagLane === l);
  if (v.bagVisible && v.bagLane) drawBag(ctx, laneX(v.bagLane), ROW_Y - 16, now / 300);
  // traffic
  for (let l = 1; l <= v.lanes; l++) for (const c of v.traffic[l]) drawCar(ctx, c, laneX(l), c.y);
  if (v.van) drawVan(ctx, laneX(v.van.lane), v.van.y);
  // dash streaks
  if (v.hop?.dash) { ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const yy = ROW_Y - 20 + i * 10; ctx.beginPath(); ctx.moveTo(v.cx - 30 - i * 12, yy); ctx.lineTo(v.cx - 70 - i * 18, yy); ctx.stroke(); } }
  // chick
  const t = v.hop ? Math.min(1, (now - v.hop.start) / v.hop.dur) : 0;
  const lift = v.hop && !v.hop.dash ? Math.sin(Math.PI * t) * 24 : 0;
  drawChick(ctx, v.cx, ROW_Y - lift, v.hop ? 1 + 0.12 * Math.sin(Math.PI * t) : 1, v.dead, v.ghostT);
  // multiplier under chicken
  if (v.status === "active" || v.status === "cashed" || v.status === "finished") {
    const lbl = fmtMult(v.pos > 0 ? v.ladder[v.pos - 1] : 1);
    ctx.font = "900 13px system-ui"; const tw = ctx.measureText(lbl).width + 16;
    ctx.fillStyle = "rgba(17,24,39,.9)"; rr(ctx, v.cx - tw / 2, ROW_Y + 30, tw, 22, 11); ctx.fill();
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#fde68a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(lbl, v.cx, ROW_Y + 41);
  }
  if (v.killer) drawCar(ctx, { type: v.killer.type, color: v.killer.color, dir: 1 }, laneX(v.killer.lane), v.killer.y);
  // fx
  for (const f of v.fx) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4)); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    if (f.kind === "feather") { ctx.fillStyle = "#fff4b8"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (f.kind === "coin") { ctx.fillStyle = "#fbbf24"; circle(ctx, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#d97706"; ctx.lineWidth = 2; ctx.stroke(); }
    else { ctx.fillStyle = "#fff"; ctx.fillRect(-2, -2, 4, 4); }
    ctx.restore();
  }
  for (const f of v.floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.font = "900 20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1; }
  ctx.restore();
}

/* ---------------- component ---------------- */
export function ChickenDashGame() {
  const [st, setSt] = useState<State | null>(null);
  const [game, setGame] = useState<G | null>(null);
  const [phase, setPhase] = useState<"idle" | "active">("idle");
  const [amount, setAmount] = useState(100);
  const [level, setLevel] = useState<Level>("easy");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const [showRules, setShowRules] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visRef = useRef<Vis | null>(null);
  const viewRef = useRef<View>({ w: 900, h: H, scale: 1, dpr: 1 });
  const busyRef = useRef(false);
  const loadedRef = useRef(false);
  const stRef = useRef<State | null>(null);
  const setBusyBoth = (b: boolean) => { busyRef.current = b; setBusy(b); };

  const refresh = useCallback(async () => {
    const r = await localApi("/api/chickendash/state", { cache: "no-store" });
    if (!r.ok) return;
    const s: State = await r.json();
    stRef.current = s; setSt(s);
    if (!loadedRef.current) {
      loadedRef.current = true;
      if (s.game) {
        const v = newVis(s.ladders[s.game.level]); applyGame(v, s.game); visRef.current = v;
        setGame(s.game); setLevel(s.game.level); setAmount(s.game.bet); setPhase("active");
      } else visRef.current = newVis(s.ladders.easy);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const cssW = wrap.clientWidth || 900;
      const scale = Math.min(1, Math.max(0.6, cssW / 900));
      const cssH = Math.round(H * scale);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); canvas.style.height = cssH + "px";
      viewRef.current = { w: cssW / scale, h: H, scale, dpr };
    });
    if (typeof requestAnimationFrame!=="undefined") requestAnimationFrame(()=>{ try{(window as unknown as Window).dispatchEvent(new Event("resize"));}catch{} }); ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const v = visRef.current, view = viewRef.current; if (!v) return;
      const dt = Math.min(50, v.lastT ? now - v.lastT : 16); v.lastT = now;
      update(v, dt, now, view);
      ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
      draw(ctx, v, view, now);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const post = async (url: string, body?: unknown) => (await localApi(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json();

  const start = async () => {
    const s = stRef.current; if (!s || busyRef.current) return;
    setBusyBoth(true); setMsg(null);
    const j = await post("/api/chickendash/start", { amount, level });
    if (j.error) { setMsg({ t: "err", m: j.error }); setBusyBoth(false); return; }
    const g: G = j.game;
    const v = newVis(s.ladders[level], visRef.current); v.status = "active";
    if (g.bagLane) { v.bagLane = g.bagLane; v.bagMult = g.bagMult; v.van = { lane: g.bagLane, y: -140, dropped: false }; v.traffic[g.bagLane] = []; }
    visRef.current = v; setGame(g); setPhase("active"); setBusyBoth(false); refresh();
  };

  const step = useCallback(async () => {
    const v = visRef.current;
    if (!v || busyRef.current || v.status !== "active" || v.hop) return;
    setBusyBoth(true); setMsg(null);
    const j = await post("/api/chickendash/step");
    if (j.error) { setMsg({ t: "err", m: j.error }); setBusyBoth(false); return; }
    const g: G = j.game; setGame(g);
    const target = g.position;
    if (j.event === "dead") {
      v.traffic[target] = v.traffic[target].filter((c) => c.y >= ROW_Y + 60);
      hopTo(v, target, false, () => {
        v.passed[target] = false;
        v.killer = { lane: target, y: -140, type: pick(CAR_TYPES), color: pick(CAR_COLORS), hit: false, done: () => {
          v.status = "dead"; setPhase("idle"); setBusyBoth(false);
          setMsg({ t: "err", m: `Gaari se takra gayi! ${money(g.bet)} haar gaye.${v.bagCollected ? " Bonus bag bhi gaya." : ""}` }); refresh();
        } };
      });
      return;
    }
    const dash = j.event === "dash" || (j.dash && j.event === "finished");
    if (dash) { v.dashUntil = performance.now() + 900; for (let l = v.pos + 1; l <= target; l++) v.traffic[l] = v.traffic[l].filter((c) => Math.abs(c.y - ROW_Y) > 90); float(v, v.cx + 60, ROW_Y - 70, "DASH!", "#7dd3fc"); }
    for (let l = v.pos + 1; l <= target; l++) v.passed[l] = true;
    hopTo(v, target, dash, () => {
      if (j.bagNow) { v.bagVisible = false; v.bagCollected = true; burst(v, v.cx, ROW_Y - 10, "coin", 12); float(v, v.cx, ROW_Y - 60, `+${g.bagMult}x BONUS`, "#fbbf24"); }
      if (j.event === "finished") {
        hopTo(v, target + 1, false, () => {
          v.status = "finished"; burst(v, v.cx, ROW_Y, "coin", 22); setPhase("idle"); setBusyBoth(false);
          setMsg({ t: "ok", m: `Highway cross! ${money(g.win)} jeete!` }); refresh();
        });
      } else setBusyBoth(false);
    });
  }, [refresh]);
  const stepRef = useRef(step); stepRef.current = step;

  const cashout = async () => {
    const v = visRef.current;
    if (!v || busyRef.current || v.status !== "active" || v.hop) return;
    setBusyBoth(true);
    const j = await post("/api/chickendash/cashout");
    if (j.error) setMsg({ t: "err", m: j.error });
    else { v.status = "cashed"; burst(v, v.cx, ROW_Y, "coin", 18); setGame(j.game); setPhase("idle"); setMsg({ t: "ok", m: `Cashed out @ ${fmtMult(j.multiplier)} — ${money(j.win)} jeete!` }); }
    setBusyBoth(false); refresh();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ([" ", "ArrowRight", "d", "D", "w", "W"].includes(e.key)) { e.preventDefault(); stepRef.current(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const changeLevel = (l: Level) => {
    if (phase === "active" || !stRef.current) return;
    setLevel(l); visRef.current = newVis(stRef.current.ladders[l], visRef.current); setMsg(null);
  };

  const balance = st?.balance ?? 0;
  const min = st?.limits.min ?? 10, max = st?.limits.max ?? 50000;
  const potential = game && phase === "active" ? game.potential : 0;
  const nextWin = game && phase === "active" && game.nextMultiplier ? Math.floor(game.bet * game.nextMultiplier * 100) / 100 : 0;
  const lvlColor: Record<Level, string> = { easy: "bg-[#22c55e] text-slate-950", normal: "bg-[#f59e0b] text-slate-950", hard: "bg-[#ef4444] text-white" };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-[#2b3140] bg-[#171b26] shadow-2xl">
        {/* top bar */}
        <div className="flex items-center justify-between bg-[#10131b] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl"></span>
            <span className="text-lg font-black tracking-tight"><span className="text-[#fbbf24]">CHICKEN</span> <span className="text-white">DASH</span></span>
          </div>
          <div className="flex items-center gap-2">
            {game && phase === "active" && <div className="hidden rounded-lg bg-[#1f2533] px-3 py-1 text-xs text-slate-300 sm:block">Tile <b className="text-white">{game.position}</b>/{game.lanes}{game.bagCollected ? <> · <b className="text-yellow-400">+{game.bagMult}x</b></> : null}</div>}
            <div className="flex items-center gap-2 rounded-lg bg-[#1f2533] px-3 py-1 text-sm font-bold text-white"><span className="inline-block h-4 w-4 rounded-full border-2 border-yellow-600 bg-yellow-400" />{balance.toLocaleString()}</div>
            <button onClick={() => setShowRules((s) => !s)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f2533] text-xs font-bold text-slate-300 hover:text-white">i</button>
            <Link href="/client" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f2533] text-xs text-slate-300 hover:text-white"></Link>
          </div>
        </div>

        {/* canvas */}
        <div ref={wrapRef} className="relative bg-[#6fb84a]">
          <canvas ref={canvasRef} onClick={() => step()} className={`block w-full ${phase === "active" && !busy ? "cursor-pointer" : ""}`} />
          {!st && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">Loading…</div>}
          {msg && <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3"><div className={`rounded-xl px-4 py-2 text-center text-sm font-bold shadow-lg ${msg.t === "ok" ? "bg-emerald-500 text-slate-950" : "bg-red-600 text-white"}`}>{msg.m}</div></div>}
          {phase === "active" && !busy && <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">Tap road ya <kbd className="rounded bg-white/20 px-1">SPACE</kbd> = aage barho</div>}
          {showRules && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowRules(false)}>
              <div className="max-w-md rounded-2xl bg-[#171b26] p-5 text-sm text-slate-300" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-2 text-lg font-black text-white">Chicken Dash — Rules</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Bet aur level select karke <b className="text-emerald-400">START</b> dabayein. Chicken curb se pehli tile par jump karti hai.</li>
                  <li>Har tile par multiplier barhta hai. Kisi bhi waqt <b className="text-yellow-400">CASH OUT</b> karein. Gaari se takraye to sab khatam.</li>
                  <li><b className="text-sky-300">Dash:</b> kabhi kabhi chicken 2–3 safe tiles ek saath sprint karti hai — un lanes mein koi gaari nahi aati.</li>
                  <li><b className="text-yellow-300">Bonus Bag:</b> ek van road par money bag girati hai. Us tile tak pahunch kar cash out karein to bonus bhi milta hai; agar aage jaate hue takra gaye to bag bhi gaya.</li>
                  <li>Easy 28 tiles (max x14.54) · Normal 24 (max x43.15) · Hard 20 (max x19,659.10). RTP 96.85%.</li>
                </ul>
                <button onClick={() => setShowRules(false)} className="mt-4 w-full rounded-xl bg-emerald-500 py-2 font-bold text-slate-950">OK</button>
              </div>
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex flex-col gap-3 bg-[#10131b] px-4 py-3 lg:flex-row lg:items-center">
          <div className={`rounded-xl bg-[#1f2533] p-2 lg:w-64 ${phase === "active" ? "pointer-events-none opacity-50" : ""}`}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bet</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAmount((a) => Math.max(min, a - 10))} className="h-9 w-9 rounded-lg bg-[#2b3140] text-lg font-bold text-white">−</button>
              <input type="number" value={amount} min={min} max={max} onChange={(e) => setAmount(Number(e.target.value))} className="w-full min-w-0 flex-1 bg-transparent text-center text-lg font-bold text-white outline-none" />
              <button onClick={() => setAmount((a) => Math.min(max, a + 10))} className="h-9 w-9 rounded-lg bg-[#2b3140] text-lg font-bold text-white">+</button>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {[["Min", min], ["100", 100], ["500", 500], ["1K", 1000], ["Max", Math.max(min, Math.min(max, Math.floor(balance)))]].map(([l, v]) => (
                <button key={String(l)} onClick={() => setAmount(Number(v))} className="rounded-md bg-[#2b3140] py-1 text-[11px] font-bold text-slate-200 hover:bg-[#364054]">{l}</button>
              ))}
            </div>
          </div>

          <div className={`grid grid-cols-3 gap-1.5 lg:w-72 ${phase === "active" ? "pointer-events-none opacity-50" : ""}`}>
            {LEVELS.map((l) => (
              <button key={l} onClick={() => changeLevel(l)} className={`rounded-xl px-2 py-2 text-sm font-black capitalize transition ${level === l ? lvlColor[l] : "bg-[#1f2533] text-slate-300 hover:bg-[#2b3140]"}`}>
                {l}
                {st && <div className="text-[9px] font-semibold opacity-80">{st.levels[l].steps} tiles · max {fmtMult(st.levels[l].max)}</div>}
              </button>
            ))}
          </div>

          <div className="flex flex-1 gap-2">
            {phase === "idle" ? (
              <button disabled={busy || !st} onClick={start} className="h-16 flex-1 rounded-2xl bg-gradient-to-b from-[#4ade80] to-[#16a34a] text-2xl font-black text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:opacity-60">
                START
                <div className="text-[11px] font-semibold opacity-90">{money(amount)} · {st?.levels[level].label}</div>
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={() => step()} className="h-16 flex-1 rounded-2xl bg-gradient-to-b from-[#4ade80] to-[#16a34a] text-xl font-black text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:opacity-60">
                  GO →
                  <div className="text-[11px] font-semibold opacity-90">{game?.nextMultiplier ? `next ${fmtMult(game.nextMultiplier)} = ${money(nextWin)}` : ""}</div>
                </button>
                <button disabled={busy || (game?.position ?? 0) < 1} onClick={cashout} className="h-16 flex-1 rounded-2xl bg-gradient-to-b from-[#fde047] to-[#f59e0b] text-lg font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:brightness-110 disabled:opacity-40">
                  CASH OUT
                  <div className="text-sm font-black">{money(potential)}{game?.bagCollected ? " " : ""}</div>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {st && st.recent.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 text-sm font-bold text-white">My Recent Runs</div>
          <div className="flex flex-wrap gap-2">
            {st.recent.map((r) => (
              <span key={r.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${r.status === "cashed" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {r.status === "cashed" ? `${fmtMult(r.multiplier)} · +${money(r.win)}` : `tile ${r.position} · −${money(r.bet)}`}<span className="ml-1 capitalize opacity-60">({r.level})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
