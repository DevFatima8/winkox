"use client";

import { localApi } from "@/lib/client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------- types ---------------- */
type Difficulty = "easy" | "medium" | "hard" | "hardcore";
type G = {
  id: string; difficulty: Difficulty; bet: number; lanes: number; position: number;
  status: "active" | "cashed" | "dead"; win: number; currentMultiplier: number; nextMultiplier: number | null; crashLane: number | null;
};
type Recent = { id: string; difficulty: string; bet: number; win: number; status: string; position: number; multiplier: number };
type State = {
  game: G | null; balance: number; tables: Record<Difficulty, number[]>;
  difficulties: Record<Difficulty, { cars: number; label: string; lanes: number }>;
  limits: { min: number; max: number }; recent: Recent[];
};
const DIFFS: Difficulty[] = ["easy", "medium", "hard", "hardcore"];

/* ---------------- scene constants ---------------- */
const H = 430, LANE_W = 92, SIDE_W = 130, WALK_W = 64;
const MANHOLE_Y = 262, MANHOLE_R = 27, BARRIER_Y = MANHOLE_Y - 72, PARK_Y = BARRIER_Y - 54;

type CarType = "taxi" | "fire" | "ice" | "van" | "police";
const CAR_TYPES: CarType[] = ["taxi", "fire", "ice", "van", "police"];
type Car = { type: CarType; y: number; speed: number };
type Parked = { type: CarType; y: number; target: number };
type Coin = { x: number; y: number; vx: number; vy: number; life: number };
type View = { w: number; h: number; scale: number; dpr: number };
type Vis = {
  lanes: number; table: number[]; pos: number; cx: number;
  hop: { fromX: number; toX: number; start: number; dur: number; done?: () => void } | null;
  passed: boolean[]; parked: (Parked | null)[]; moving: Car[][]; nextSpawn: number[];
  killer: { lane: number; y: number; type: CarType; hit: boolean; done?: () => void } | null;
  dead: boolean; coins: Coin[]; camX: number; camInit: boolean;
  status: "idle" | "active" | "cashed" | "dead" | "finished"; lastT: number;
};

const laneX = (l: number) => SIDE_W + (l - 0.5) * LANE_W;
const posX = (p: number, lanes: number) => (p <= 0 ? SIDE_W - 32 : p > lanes ? SIDE_W + lanes * LANE_W + 32 : laneX(p));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const trim = (n: number, d: number) => String(parseFloat(n.toFixed(d)));
export const fmtMult = (m: number) =>
  (m >= 1e6 ? trim(m / 1e6, 1) + "M" : m >= 1e4 ? trim(m / 1e3, 0) + "K" : m >= 1000 ? trim(m / 1e3, 1) + "K" : m >= 100 ? trim(m, 0) : m >= 10 ? trim(m, 1) : trim(m, 2)) + "x";
const money = (n: number) => "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 2 });

function newVis(table: number[], prev?: Vis | null): Vis {
  const lanes = table.length;
  const moving: Car[][] = Array.from({ length: lanes + 2 }, () => []);
  for (let l = 1; l <= lanes; l++) if (Math.random() < 0.45) moving[l].push({ type: pick(CAR_TYPES), y: rnd(-60, H), speed: rnd(140, 230) });
  return {
    lanes, table, pos: 0, cx: posX(0, lanes), hop: null,
    passed: Array(lanes + 2).fill(false), parked: Array(lanes + 2).fill(null), moving,
    nextSpawn: Array.from({ length: lanes + 2 }, () => performance.now() + rnd(400, 3500)),
    killer: null, dead: false, coins: [], camX: prev?.camX ?? 0, camInit: prev?.camInit ?? false, status: "idle", lastT: 0,
  };
}
function applyGame(v: Vis, g: G) {
  v.status = "active"; v.pos = g.position; v.cx = posX(g.position, v.lanes); v.dead = false; v.killer = null; v.hop = null;
  for (let l = 1; l <= v.lanes; l++) {
    const p = l <= g.position;
    v.passed[l] = p;
    v.parked[l] = p ? { type: CAR_TYPES[(l * 3 + 1) % CAR_TYPES.length], y: PARK_Y, target: PARK_Y } : null;
    if (p) v.moving[l] = [];
  }
}
function blockLane(v: Vis, l: number) {
  v.passed[l] = true;
  const cars = v.moving[l];
  const above = cars.filter((c) => c.y <= BARRIER_Y - 40);
  v.moving[l] = cars.filter((c) => c.y >= MANHOLE_Y + 50);
  const lead = above.length ? above.reduce((a, b) => (a.y > b.y ? a : b)) : null;
  v.parked[l] = { type: lead?.type ?? pick(CAR_TYPES), y: lead ? lead.y : -100, target: PARK_Y };
}
function hopTo(v: Vis, p: number, done?: () => void) {
  v.hop = { fromX: v.cx, toX: posX(p, v.lanes), start: performance.now(), dur: 330, done: () => { v.pos = p; done?.(); } };
}
function burst(v: Vis, x: number, y: number) {
  for (let i = 0; i < 18; i++) v.coins.push({ x, y, vx: rnd(-170, 170), vy: rnd(-420, -160), life: 1 });
}

/* ---------------- update / draw ---------------- */
function update(v: Vis, dt: number, now: number, view: View) {
  const s = dt / 1000;
  if (v.hop) {
    const t = Math.min(1, (now - v.hop.start) / v.hop.dur);
    const e = 1 - Math.pow(1 - t, 3);
    v.cx = v.hop.fromX + (v.hop.toX - v.hop.fromX) * e;
    if (t >= 1) { const d = v.hop.done; v.hop = null; d?.(); }
  }
  for (let l = 1; l <= v.lanes; l++) {
    if (v.passed[l]) continue;
    const cars = v.moving[l];
    if (now >= v.nextSpawn[l]) {
      v.nextSpawn[l] = now + rnd(1800, 5200);
      if (!cars.some((c) => c.y < 140)) cars.push({ type: pick(CAR_TYPES), y: -110, speed: rnd(140, 230) });
    }
    for (const c of cars) c.y += c.speed * s;
    v.moving[l] = cars.filter((c) => c.y < H + 120);
  }
  for (const p of v.parked) if (p && p.y < p.target) p.y = Math.min(p.target, p.y + 560 * s);
  if (v.killer) {
    const k = v.killer;
    k.y += 700 * s;
    if (!k.hit && k.y + 32 >= MANHOLE_Y) { k.hit = true; v.dead = true; }
    if (k.y > H + 130) { const d = k.done; v.killer = null; d?.(); }
  }
  for (const c of v.coins) { c.vy += 950 * s; c.x += c.vx * s; c.y += c.vy * s; c.life -= s / 1.1; }
  v.coins = v.coins.filter((c) => c.life > 0);
  const worldW = SIDE_W * 2 + v.lanes * LANE_W;
  const maxCam = worldW - view.w;
  const target = maxCam <= 0 ? maxCam / 2 : Math.max(0, Math.min(maxCam, v.cx - view.w * 0.42));
  if (!v.camInit) { v.camX = target; v.camInit = true; } else v.camX += (target - v.camX) * Math.min(1, s * 7);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };

function drawSidewalk(ctx: CanvasRenderingContext2D, x: number, w: number, h: number) {
  ctx.fillStyle = "#c9c9c9"; ctx.fillRect(x, 0, w, h);
  ctx.strokeStyle = "#b4b4b4"; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let y = 0; y <= h; y += 32) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); }
  ctx.moveTo(x + w / 2, 0); ctx.lineTo(x + w / 2, h); ctx.stroke();
}
function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(x + 5, y + 7, 26, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3c8a36"; circle(ctx, x, y, 27); ctx.fill();
  ctx.fillStyle = "#58a94c"; circle(ctx, x - 7, y - 7, 14); ctx.fill();
  ctx.fillStyle = "#2f7a2b"; circle(ctx, x + 9, y + 9, 7); ctx.fill();
}
function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.15)"; rr(ctx, x - 16, y - 8, 36, 24, 11); ctx.fill();
  ctx.fillStyle = "#4d9a43"; rr(ctx, x - 18, y - 12, 36, 24, 11); ctx.fill();
  ctx.fillStyle = "#68b65b"; rr(ctx, x - 12, y - 9, 14, 9, 5); ctx.fill();
}
function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.2)"; rr(ctx, x - 1, y + 4, 6, 76, 3); ctx.fill();
  ctx.fillStyle = "#8d939a"; rr(ctx, x - 3, y, 6, 76, 3); ctx.fill(); rr(ctx, x, y, 28, 5, 2); ctx.fill();
  const g = ctx.createRadialGradient(x + 30, y + 3, 2, x + 30, y + 3, 24);
  g.addColorStop(0, "rgba(255,240,150,.55)"); g.addColorStop(1, "rgba(255,240,150,0)");
  ctx.fillStyle = g; circle(ctx, x + 30, y + 3, 24); ctx.fill();
  ctx.fillStyle = "#fff3b0"; circle(ctx, x + 30, y + 3, 7); ctx.fill();
}
function drawTrafficLight(ctx: CanvasRenderingContext2D, x: number, y: number, now: number) {
  ctx.fillStyle = "#d8a521"; rr(ctx, x - 3, y - 26, 6, 96, 3); ctx.fill();
  ctx.fillStyle = "#2b2b2b"; rr(ctx, x - 10, y - 34, 20, 52, 6); ctx.fill();
  const on = Math.floor(now / 1500) % 3;
  ctx.fillStyle = on === 0 ? "#ff3b30" : "#5a1a18"; circle(ctx, x, y - 22, 5); ctx.fill();
  ctx.fillStyle = on === 1 ? "#fdd835" : "#5a4d12"; circle(ctx, x, y - 8, 5); ctx.fill();
  ctx.fillStyle = on === 2 ? "#43d060" : "#184d24"; circle(ctx, x, y + 6, 5); ctx.fill();
}
function drawHydrant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#d32f2f"; rr(ctx, x - 7, y - 10, 14, 24, 5); ctx.fill();
  ctx.fillStyle = "#b71c1c"; circle(ctx, x, y - 11, 6); ctx.fill(); rr(ctx, x - 12, y - 4, 6, 7, 2); ctx.fill(); rr(ctx, x + 6, y - 4, 6, 7, 2); ctx.fill();
}
function drawCrosswalk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#6a5a97"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#f2c12e"; ctx.lineWidth = 4; ctx.setLineDash([12, 10]);
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#e6e6e6"; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3);
}
function drawPedestrian(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y + 16, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#d6d6d6"; ctx.lineWidth = 1.5;
  circle(ctx, x, y + 6, 10); ctx.fill(); ctx.stroke(); circle(ctx, x, y - 6, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e53935"; for (const dx of [-4, 0, 4]) { circle(ctx, x + dx, y - 14, 2.5); ctx.fill(); }
  ctx.fillStyle = "#111"; rr(ctx, x - 8, y - 9, 16, 5, 2); ctx.fill();
  ctx.fillStyle = "#f5a623"; ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y - 3); ctx.lineTo(x, y + 1); ctx.closePath(); ctx.fill();
}
function drawManhole(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, passed: boolean, next: boolean, now: number) {
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(x + 2, y + 4, MANHOLE_R, MANHOLE_R * 0.92, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2c2c2c"; circle(ctx, x, y, MANHOLE_R); ctx.fill(); ctx.strokeStyle = "#151515"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#3a3a3a"; circle(ctx, x, y, MANHOLE_R - 6); ctx.fill();
  ctx.strokeStyle = "#1e1e1e"; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.moveTo(x + Math.cos(a) * (MANHOLE_R - 11), y + Math.sin(a) * (MANHOLE_R - 11)); ctx.lineTo(x + Math.cos(a) * (MANHOLE_R - 7), y + Math.sin(a) * (MANHOLE_R - 7)); }
  ctx.stroke();
  if (next) {
    const a = 0.55 + 0.4 * Math.sin(now / 180);
    ctx.strokeStyle = `rgba(255,214,0,${a})`; ctx.lineWidth = 4; circle(ctx, x, y, MANHOLE_R + 7); ctx.stroke();
  }
  ctx.font = `bold ${label.length > 5 ? 12 : 14}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 4;
  ctx.fillStyle = passed ? "#9de08a" : "#ffffff"; ctx.fillText(label, x, y + 1);
  ctx.shadowBlur = 0;
}
function drawBarrier(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#8e8e8e"; rr(ctx, x - 21, y, 5, 17, 2); ctx.fill(); rr(ctx, x + 16, y, 5, 17, 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.25)"; rr(ctx, x - 26, y - 3, 54, 12, 3); ctx.fill();
  ctx.save(); rr(ctx, x - 28, y - 7, 56, 13, 3); ctx.clip();
  ctx.fillStyle = "#f2c12e"; ctx.fillRect(x - 28, y - 7, 56, 13);
  ctx.strokeStyle = "#262626"; ctx.lineWidth = 7; ctx.beginPath();
  for (let i = -40; i < 60; i += 16) { ctx.moveTo(x + i, y + 10); ctx.lineTo(x + i + 14, y - 10); }
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5; rr(ctx, x - 28, y - 7, 56, 13, 3); ctx.stroke();
}
const CAR_SPEC: Record<CarType, { w: number; h: number; body: string; roof: string }> = {
  taxi: { w: 44, h: 68, body: "#f7c531", roof: "#e0ad1b" },
  fire: { w: 46, h: 88, body: "#d9302f", roof: "#b71c1c" },
  ice: { w: 46, h: 78, body: "#3e9be0", roof: "#2a7fc0" },
  van: { w: 44, h: 76, body: "#5cb85c", roof: "#f4f4f4" },
  police: { w: 44, h: 68, body: "#f5f5f5", roof: "#dcdcdc" },
};
function drawCar(ctx: CanvasRenderingContext2D, type: CarType, cx: number, cy: number) {
  const { w, h, body, roof } = CAR_SPEC[type];
  const x = cx - w / 2, y = cy - h / 2;
  ctx.fillStyle = "rgba(0,0,0,.28)"; rr(ctx, x + 3, y + 5, w, h, 10); ctx.fill();
  ctx.fillStyle = "#1b1b1b";
  for (const [wx, wy] of [[x - 3, y + 9], [x + w - 4, y + 9], [x - 3, y + h - 25], [x + w - 4, y + h - 25]]) { rr(ctx, wx, wy, 7, 16, 2); ctx.fill(); }
  ctx.fillStyle = body; rr(ctx, x, y, w, h, 9); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = roof; rr(ctx, x + 6, y + 22, w - 12, h - 46, 6); ctx.fill();
  ctx.fillStyle = "#cfe9ff"; rr(ctx, x + 6, y + h - 22, w - 12, 10, 3); ctx.fill(); rr(ctx, x + 6, y + 11, w - 12, 8, 3); ctx.fill();
  ctx.fillStyle = "#fff59d"; rr(ctx, x + 4, y + h - 5, 9, 4, 1); ctx.fill(); rr(ctx, x + w - 13, y + h - 5, 9, 4, 1); ctx.fill();
  ctx.fillStyle = "#ff5252"; rr(ctx, x + 4, y + 1, 9, 4, 1); ctx.fill(); rr(ctx, x + w - 13, y + 1, 9, 4, 1); ctx.fill();
  if (type === "taxi") {
    ctx.fillStyle = "#222"; rr(ctx, cx - 11, cy - 4, 22, 8, 2); ctx.fill();
    ctx.fillStyle = "#f7c531"; for (let i = 0; i < 4; i++) ctx.fillRect(cx - 10 + i * 5.5, cy - 3 + (i % 2) * 3, 2.5, 2.5);
  } else if (type === "fire") {
    ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(cx - 6, y + 20); ctx.lineTo(cx - 6, y + h - 28); ctx.moveTo(cx + 6, y + 20); ctx.lineTo(cx + 6, y + h - 28);
    for (let yy = y + 24; yy < y + h - 28; yy += 8) { ctx.moveTo(cx - 6, yy); ctx.lineTo(cx + 6, yy); }
    ctx.stroke();
  } else if (type === "ice") {
    ctx.fillStyle = "#f5b26b"; ctx.beginPath(); ctx.moveTo(cx - 7, cy + 2); ctx.lineTo(cx + 7, cy + 2); ctx.lineTo(cx, cy + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff8ac2"; circle(ctx, cx, cy - 2, 8); ctx.fill(); ctx.fillStyle = "#ffd1e6"; circle(ctx, cx - 3, cy - 5, 3); ctx.fill();
  } else if (type === "police") {
    ctx.fillStyle = "#2f5fd6"; ctx.fillRect(x, cy + 12, w, 6);
    ctx.fillStyle = "#ff3b30"; rr(ctx, x + 8, cy - 5, (w - 16) / 2 - 1, 8, 2); ctx.fill();
    ctx.fillStyle = "#2f7cff"; rr(ctx, cx + 1, cy - 5, (w - 16) / 2 - 1, 8, 2); ctx.fill();
  }
}
function drawChicken(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dead: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (dead) {
    ctx.fillStyle = "#fff";
    for (const [fx, fy, r] of [[-30, -18, 5], [24, -22, 4], [-22, 18, 4], [30, 12, 5], [4, -30, 4]]) { ctx.beginPath(); ctx.ellipse(fx, fy, r, r * 0.6, 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 6, 32, 13, 0, 0, Math.PI * 2); ctx.fillStyle = "#f4f4f4"; ctx.fill(); ctx.strokeStyle = "#cfcfcf"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#e53935"; for (const c of [8, 13, 18]) { circle(ctx, c, -6, 3.5); ctx.fill(); }
    ctx.fillStyle = "#f5a623"; ctx.beginPath(); ctx.moveTo(24, 2); ctx.lineTo(34, 5); ctx.lineTo(24, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#222"; ctx.lineWidth = 2;
    for (const ex of [6, 16]) { ctx.beginPath(); ctx.moveTo(ex - 3, 0); ctx.lineTo(ex + 3, 6); ctx.moveTo(ex + 3, 0); ctx.lineTo(ex - 3, 6); ctx.stroke(); }
    ctx.restore(); return;
  }
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 21, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f0a020"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
  ctx.moveTo(-7, 15); ctx.lineTo(-9, 21); ctx.moveTo(-13, 23); ctx.lineTo(-9, 21); ctx.lineTo(-5, 23);
  ctx.moveTo(6, 15); ctx.lineTo(4, 21); ctx.moveTo(0, 23); ctx.lineTo(4, 21); ctx.lineTo(8, 23); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#d6d6d6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-31, -11); ctx.lineTo(-24, 2); ctx.lineTo(-32, 6); ctx.lineTo(-16, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 3, 21, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ececec"; ctx.beginPath(); ctx.ellipse(-4, 6, 11, 6, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; circle(ctx, 13, -11, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e53935"; for (const [cx2, cy2] of [[7, -21], [13, -24], [19, -21]]) { circle(ctx, cx2, cy2, 4.2); ctx.fill(); }
  ctx.fillStyle = "#f5a623"; ctx.beginPath(); ctx.moveTo(23, -13); ctx.lineTo(35, -9); ctx.lineTo(23, -5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e53935"; circle(ctx, 22, -3, 3.2); ctx.fill();
  ctx.fillStyle = "#1a1a1a"; circle(ctx, 17, -13, 2.8); ctx.fill();
  ctx.fillStyle = "#fff"; circle(ctx, 18, -14, 1); ctx.fill();
  ctx.restore();
}
function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = "#f7c948"; circle(ctx, x, y, 8); ctx.fill(); ctx.strokeStyle = "#d9a521"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = "#e6b530"; ctx.lineWidth = 1.5; circle(ctx, x, y, 4.5); ctx.stroke();
  ctx.globalAlpha = 1;
}

function draw(ctx: CanvasRenderingContext2D, v: Vis, view: View, now: number) {
  const { w, h } = view;
  ctx.clearRect(0, 0, w, h);
  ctx.save(); ctx.translate(-v.camX, 0);
  const road0 = SIDE_W, road1 = SIDE_W + v.lanes * LANE_W;
  // grass
  ctx.fillStyle = "#7cb646"; ctx.fillRect(v.camX - 10, 0, w + 20, h);
  ctx.fillStyle = "rgba(0,0,0,.035)"; for (let y = 0; y < h; y += 26) ctx.fillRect(v.camX - 10, y, w + 20, 13);
  // sidewalks
  drawSidewalk(ctx, road0 - WALK_W, WALK_W, h); drawSidewalk(ctx, road1, WALK_W, h);
  // road
  ctx.fillStyle = "#6b6e72"; ctx.fillRect(road0, 0, road1 - road0, h);
  ctx.fillStyle = "#dcdcdc"; ctx.fillRect(road0 - 4, 0, 4, h); ctx.fillRect(road1, 0, 4, h);
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 4; ctx.setLineDash([26, 20]); ctx.beginPath();
  for (let l = 1; l < v.lanes; l++) { const x = road0 + l * LANE_W; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  ctx.stroke(); ctx.setLineDash([]);
  // decorations
  drawTree(ctx, road0 - 100, 70); drawBush(ctx, road0 - 104, 190); drawTree(ctx, road0 - 96, 360); drawLamp(ctx, road0 - 34, 150);
  drawCrosswalk(ctx, road1 + WALK_W, 236, SIDE_W - WALK_W + 300, 40);
  drawTrafficLight(ctx, road1 + 26, 190, now); drawHydrant(ctx, road1 + 30, 330);
  drawTree(ctx, road1 + 102, 60); drawBush(ctx, road1 + 98, 150); drawPedestrian(ctx, road1 + 100, 200); drawPedestrian(ctx, road1 + 112, 300); drawTree(ctx, road1 + 100, 385);
  // manholes
  const next = v.status === "active" && !v.hop ? v.pos + 1 : -1;
  for (let l = 1; l <= v.lanes; l++) drawManhole(ctx, laneX(l), MANHOLE_Y, fmtMult(v.table[l - 1]), v.passed[l], l === next, now);
  // parked cars + barriers
  for (let l = 1; l <= v.lanes; l++) if (v.passed[l]) { const p = v.parked[l]; if (p) drawCar(ctx, p.type, laneX(l), p.y); drawBarrier(ctx, laneX(l), BARRIER_Y); }
  // moving cars
  for (let l = 1; l <= v.lanes; l++) for (const c of v.moving[l]) drawCar(ctx, c.type, laneX(l), c.y);
  // chicken
  const t = v.hop ? Math.min(1, (now - v.hop.start) / v.hop.dur) : 0;
  const lift = v.hop ? Math.sin(Math.PI * t) * 22 : 0;
  drawChicken(ctx, v.cx, MANHOLE_Y - lift, v.hop ? 1 + 0.14 * Math.sin(Math.PI * t) : 1, v.dead);
  if (v.killer) drawCar(ctx, v.killer.type, laneX(v.killer.lane), v.killer.y);
  for (const c of v.coins) drawCoin(ctx, c.x, c.y, c.life * 1.5);
  ctx.restore();
}

/* ---------------- component ---------------- */
export function ChickenRoadGame() {
  const [st, setSt] = useState<State | null>(null);
  const [game, setGame] = useState<G | null>(null);
  const [phase, setPhase] = useState<"idle" | "active">("idle");
  const [amount, setAmount] = useState(100);
  const [diff, setDiff] = useState<Difficulty>("easy");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const [showRules, setShowRules] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visRef = useRef<Vis | null>(null);
  const viewRef = useRef<View>({ w: 860, h: H, scale: 1, dpr: 1 });
  const busyRef = useRef(false);
  const loadedRef = useRef(false);
  const stRef = useRef<State | null>(null);
  const setBusyBoth = (b: boolean) => { busyRef.current = b; setBusy(b); };

  const refresh = useCallback(async () => {
    const r = await localApi("/api/chicken/state", { cache: "no-store" });
    if (!r.ok) return;
    const s: State = await r.json();
    stRef.current = s;
    setSt(s);
    if (!loadedRef.current) {
      loadedRef.current = true;
      if (s.game) {
        const v = newVis(s.tables[s.game.difficulty]);
        applyGame(v, s.game);
        visRef.current = v;
        setGame(s.game); setDiff(s.game.difficulty); setAmount(s.game.bet); setPhase("active");
      } else visRef.current = newVis(s.tables.easy);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // resize
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const cssW = wrap.clientWidth || 860;
      const scale = Math.min(1, Math.max(0.62, cssW / 860));
      const cssH = Math.round(H * scale);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      canvas.style.height = cssH + "px";
      viewRef.current = { w: cssW / scale, h: H, scale, dpr };
    });
    if (typeof requestAnimationFrame!=="undefined") requestAnimationFrame(()=>{ try{(window as unknown as Window).dispatchEvent(new Event("resize"));}catch{} }); ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // game loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const v = visRef.current, view = viewRef.current;
      if (!v) return;
      const dt = Math.min(50, v.lastT ? now - v.lastT : 16); v.lastT = now;
      update(v, dt, now, view);
      ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
      draw(ctx, v, view, now);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const post = async (url: string, body?: unknown) => {
    const r = await localApi(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  };

  const start = async () => {
    const s = stRef.current; if (!s || busyRef.current) return;
    setBusyBoth(true); setMsg(null);
    const j = await post("/api/chicken/start", { amount, difficulty: diff });
    if (j.error) { setMsg({ t: "err", m: j.error }); setBusyBoth(false); return; }
    const v = newVis(s.tables[diff], visRef.current); v.status = "active"; visRef.current = v;
    setGame(j.game); setPhase("active"); setBusyBoth(false);
    refresh();
  };

  const step = useCallback(async () => {
    const v = visRef.current;
    if (!v || busyRef.current || v.status !== "active" || v.hop) return;
    setBusyBoth(true); setMsg(null);
    const j = await post("/api/chicken/step");
    if (j.error) { setMsg({ t: "err", m: j.error }); setBusyBoth(false); return; }
    const g: G = j.game; setGame(g);
    const target = g.position;
    if (j.event === "dead") {
      v.moving[target] = v.moving[target].filter((c) => c.y >= MANHOLE_Y + 50);
      hopTo(v, target, () => {
        v.killer = { lane: target, y: -120, type: pick(CAR_TYPES), hit: false, done: () => {
          v.status = "dead"; setPhase("idle"); setBusyBoth(false);
          setMsg({ t: "err", m: `Gaari se takra gayi! ${money(g.bet)} haar gaye.` }); refresh();
        } };
      });
    } else {
      blockLane(v, target);
      hopTo(v, target, () => {
        if (j.event === "finished") {
          hopTo(v, target + 1, () => {
            v.status = "finished"; burst(v, v.cx, MANHOLE_Y); setPhase("idle"); setBusyBoth(false);
            setMsg({ t: "ok", m: `Poori road cross! ${money(g.win)} jeete!` }); refresh();
          });
        } else setBusyBoth(false);
      });
    }
  }, [refresh]);
  const stepRef = useRef(step); stepRef.current = step;

  const cashout = async () => {
    const v = visRef.current;
    if (!v || busyRef.current || v.status !== "active" || v.hop) return;
    setBusyBoth(true);
    const j = await post("/api/chicken/cashout");
    if (j.error) setMsg({ t: "err", m: j.error });
    else { v.status = "cashed"; burst(v, v.cx, MANHOLE_Y); setGame(j.game); setPhase("idle"); setMsg({ t: "ok", m: `Cashed out @ ${fmtMult(j.multiplier)} — ${money(j.win)} jeete!` }); }
    setBusyBoth(false); refresh();
  };

  // keyboard: Space / → / D / W = GO
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ([" ", "ArrowRight", "ArrowUp", "d", "D", "w", "W"].includes(e.key)) { e.preventDefault(); stepRef.current(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const v = visRef.current, view = viewRef.current, canvas = canvasRef.current;
    if (!v || !canvas || v.status !== "active") return;
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left) / view.scale + v.camX;
    const lane = Math.floor((wx - SIDE_W) / LANE_W) + 1;
    if (lane === v.pos + 1) step();
  };

  const changeDiff = (d: Difficulty) => {
    if (phase === "active" || !stRef.current) return;
    setDiff(d);
    visRef.current = newVis(stRef.current.tables[d], visRef.current);
    setMsg(null);
  };

  const balance = st?.balance ?? 0;
  const min = st?.limits.min ?? 10, max = st?.limits.max ?? 50000;
  const potential = game && phase === "active" ? Math.floor(game.bet * game.currentMultiplier * 100) / 100 : 0;
  const nextWin = game && phase === "active" && game.nextMultiplier ? Math.floor(game.bet * game.nextMultiplier * 100) / 100 : 0;
  const lanesInfo = st ? st.difficulties[diff] : null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-[#2a2f34] bg-[#1b1f23] shadow-2xl">
        {/* top bar */}
        <div className="flex items-center justify-between bg-[#15181b] px-4 py-2">
          <div className="flex items-center text-lg font-black tracking-tight text-white">
            CHICKEN<span className="mx-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-sm text-white">2</span>ROAD
          </div>
          <div className="flex items-center gap-2">
            {game && phase === "active" && (
              <div className="hidden rounded-lg bg-[#0f1113] px-3 py-1 text-xs text-slate-300 sm:block">
                Lane <b className="text-white">{game.position}</b>/{game.lanes} · <b className="text-yellow-400">{fmtMult(game.currentMultiplier)}</b>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg bg-[#0f1113] px-3 py-1 text-sm font-bold text-white">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-yellow-600 bg-yellow-400" />
              {balance.toLocaleString()}
            </div>
            <button onClick={() => setShowRules((s) => !s)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f1113] text-xs font-bold text-slate-300 hover:text-white" title="Rules">i</button>
          </div>
        </div>

        {/* canvas */}
        <div ref={wrapRef} className="relative bg-[#7cb646]">
          <canvas ref={canvasRef} onClick={onCanvasClick} className={`block w-full ${phase === "active" && !busy ? "cursor-pointer" : ""}`} />
          {!st && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">Loading…</div>}
          {msg && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <div className={`rounded-xl px-4 py-2 text-center text-sm font-bold shadow-lg ${msg.t === "ok" ? "bg-emerald-500 text-slate-950" : "bg-red-600 text-white"}`}>{msg.m}</div>
            </div>
          )}
          {phase === "active" && !busy && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">
              Agle manhole par click karein ya <kbd className="rounded bg-white/20 px-1">SPACE</kbd> / <kbd className="rounded bg-white/20 px-1">→</kbd> dabayein
            </div>
          )}
          {showRules && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowRules(false)}>
              <div className="max-w-md rounded-2xl bg-[#1b1f23] p-5 text-sm text-slate-300" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-2 text-lg font-black text-white">Kaise khelein</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Bet aur difficulty select karke <b className="text-emerald-400">PLAY</b> dabayein.</li>
                  <li>Har <b className="text-white">GO</b> par chicken agle manhole par jati hai — multiplier barhta hai aur peeche barrier lag jata hai.</li>
                  <li>Kisi bhi lane par gaari aa sakti hai — us se pehle <b className="text-yellow-400">CASH OUT</b> karein.</li>
                  <li>Poori road cross karne par max multiplier automatically mil jata hai.</li>
                  <li>Easy 24 lanes (max 24.5x) · Medium 22 (max 2,254x) · Hard 20 (max 52,067x) · Hardcore 15 (max 3.2M x).</li>
                </ul>
                <button onClick={() => setShowRules(false)} className="mt-4 w-full rounded-xl bg-emerald-500 py-2 font-bold text-slate-950">OK</button>
              </div>
            </div>
          )}
        </div>

        {/* bottom controls */}
        <div className="flex flex-col gap-3 bg-[#1b1e21] px-3 py-3 lg:flex-row lg:items-center lg:gap-4 lg:px-5">
          {/* difficulty (traffic-light pills like the original) */}
          <div className={`flex items-center gap-1 rounded-xl bg-[#111315] p-1 lg:w-auto ${phase === "active" ? "pointer-events-none opacity-50" : ""}`}>
            {DIFFS.map((d) => {
              const dot = d === "easy" ? "bg-[#3ecf5a]" : d === "medium" ? "bg-[#f5c518]" : d === "hard" ? "bg-[#f97316]" : "bg-[#ef4444]";
              return (
                <button key={d} onClick={() => changeDiff(d)} title={`${d} · ${st?.difficulties[d].lanes ?? ""} lanes`} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold capitalize transition lg:flex-none lg:px-3 ${diff === d ? "bg-[#2b3136] text-white ring-1 ring-white/20" : "text-slate-400 hover:text-white"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${dot} ${diff === d ? "shadow-[0_0_8px_currentColor]" : "opacity-60"}`} />{d}
                </button>
              );
            })}
          </div>
          {/* bet box: MIN [amount] MAX + chips 1 2 5 10 (original style) */}
          <div className={`rounded-xl bg-[#111315] px-2 py-1.5 lg:w-72 ${phase === "active" ? "pointer-events-none opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setAmount(min)} className="rounded-md px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white">MIN</button>
              <input type="number" value={amount} min={min} max={max} onChange={(e) => setAmount(Number(e.target.value))} className="w-full min-w-0 flex-1 bg-transparent text-center text-lg font-bold text-white outline-none" />
              <button onClick={() => setAmount(Math.max(min, Math.min(max, Math.floor(balance))))} className="rounded-md px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white">MAX</button>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {[50, 100, 500, 1000].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className={`rounded-md py-1 text-[11px] font-bold ${amount === v ? "bg-[#3ecf5a] text-slate-950" : "bg-[#2b3136] text-slate-200 hover:bg-[#363d43]"}`}>{v}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 gap-2">
            {phase === "idle" ? (
              <button disabled={busy || !st} onClick={start} className="h-16 flex-1 rounded-2xl bg-[#3ecf5a] text-2xl font-black text-white shadow-lg shadow-emerald-500/30 transition hover:bg-[#35bf50] disabled:opacity-60">
                PLAY
                <div className="text-[11px] font-semibold opacity-90">{money(amount)} · {lanesInfo?.label ?? ""} · max {st ? fmtMult(st.tables[diff][st.tables[diff].length - 1]) : ""}</div>
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={() => step()} className="h-16 flex-1 rounded-2xl bg-[#3ecf5a] text-xl font-black text-white shadow-lg shadow-emerald-500/30 transition hover:bg-[#35bf50] disabled:opacity-60">
                  GO →
                  <div className="text-[11px] font-semibold opacity-90">{game?.nextMultiplier ? `next ${fmtMult(game.nextMultiplier)} = ${money(nextWin)}` : ""}</div>
                </button>
                <button disabled={busy || (game?.position ?? 0) < 1} onClick={cashout} className="h-16 flex-1 rounded-2xl bg-[#f5a623] text-lg font-black text-slate-950 shadow-lg shadow-orange-500/30 transition hover:bg-[#f7b344] disabled:opacity-40">
                  CASH OUT
                  <div className="text-sm font-black">{money(potential)}</div>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* recent */}
      {st && st.recent.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 text-sm font-bold text-white">My Recent Games</div>
          <div className="flex flex-wrap gap-2">
            {st.recent.map((r) => (
              <span key={r.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${r.status === "cashed" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {r.status === "cashed" ? `${fmtMult(r.multiplier)} · +${money(r.win)}` : `lane ${r.position} · −${money(r.bet)}`}
                <span className="ml-1 capitalize opacity-60">({r.difficulty})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
