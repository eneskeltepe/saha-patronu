// Halı saha SAHNESİ: kaldırım + tabela, sahalar (portrede dikey), sokak + araba, yaşam (insanlar, konuşma balonları).
import { formatMoney, pitchName } from './format.js';
import { config } from '../core/index.js';
import { lines } from './texts.js';

const CW = 128, CH = 80;               // hücre (sanal birim, yatay çizilir; portrede 90° döndürülür)
const FX = 14, FY = 11, FW = 100, FH = 58;
const GATE = [64, 74];                 // hücre koordinatında kapı (alt çit ortası)
const KITS = [['#f7c600', '#14285e'], ['#f7c600', '#d6232a'], ['#15151a', '#f4f4f4'], ['#7a1230', '#2a7fd6'], ['#1e9c4a', '#f4f4f4']];
const KEEPERS = ['#39d353', '#ff8a2b'];
const FORM = [[3, 29], [22, 17], [22, 41], [45, 10], [45, 29], [45, 48], [65, 29]];
const SPOTS = { // hücre koordinatında tesis noktaları [x,y,w,h]
  cafe: [0.5, 47, 11, 22], rental: [1, 35, 10, 11], parking: [118.5, 12, 9.5, 56], camera: [118.5, 3, 9.5, 8],
};

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
const R = (a, b) => a + Math.random() * (b - a);

function darkness(t) {
  if (t >= 20 || t < 5) return 1;
  if (t >= 17) return (t - 17) / 3;
  if (t < 8) return 1 - (t - 5) / 3;
  return 0;
}
const unlockLv = (k) => config.unlocks?.[k] ?? config.upgrades?.[k]?.unlock ?? 1;

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function person(g, x, y, a, body, trim, z = 1, jump = 0) {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 0.6, 2 * z, 1.3 * z, 0, 0, 7); g.fill();
  g.save(); g.translate(x, y - jump); g.rotate(a);
  g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 2.1 * z, 3.1 * z, 0, 0, 7); g.fill();
  g.fillStyle = trim; g.fillRect(-0.5 * z, -2.9 * z, 1.1 * z, 5.8 * z);
  g.fillStyle = '#e2b48f'; g.beginPath(); g.arc(0.6 * z, 0, 1.4 * z, 0, 7); g.fill();
  g.restore();
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, portrait = false;
  const statics = new Map(), sims = new Map(), leaving = new Map(), amb = new Map(), screenRect = new Map();
  const floats = [], bubbles = [];
  const rain = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
  let selected = null, onGoal = null, onKick = null, onTap = null;
  let layout = null, layoutKey = '', panY = 0, backdrop = null, hits = [], lamps = [];
  const car = { on: false, x: 0, dir: 1, v: 80, lane: 0, color: '#d6232a', next: 4 };
  let bubbleT = 5, ped = { x: 0.2, dir: 1 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    layoutKey = ''; statics.clear(); backdrop = null;
  }

  // ---------- yerleşim ----------
  function doLayout(n) {
    portrait = window.innerHeight > window.innerWidth;
    const key = `${n}|${W}|${H}|${portrait}`;
    if (layout && key === layoutKey) return layout;
    layoutKey = key; backdrop = null;
    const ts = clamp(H * 0.075, 22, 40), bs = clamp(H * 0.1, 26, 46);
    const lotH = H - ts - bs, cw = portrait ? CH : CW, ch = portrait ? CW : CH;
    const minS = portrait ? 1.25 : 0.9;
    let best = null;
    for (let cols = 1; cols <= Math.min(n, 4); cols++) {
      const rows = Math.ceil(n / cols);
      const sw = (W - 10) / cols / cw, sh = (lotH - 8) / rows / ch, fit = Math.min(sw, sh);
      const s = Math.max(fit, Math.min(sw, minS));
      if (!best || s > best.s + 0.01) best = { cols, rows, s };
    }
    const { cols, rows, s } = best, w = cw * s, h = ch * s;
    const ox = (W - cols * w) / 2, contentH = rows * h + 8, oy = ts + Math.max(4, (lotH - rows * h) / 2);
    layout = { ts, bs, lotH, s, cols, rows, w, h, contentH, canPan: contentH > lotH,
      rects: Array.from({ length: n }, (_, i) => ({ x: ox + (i % cols) * w, y: oy + Math.floor(i / cols) * h, w, h, s })) };
    panY = clamp(panY, Math.min(0, lotH - contentH - 4), 0);
    return layout;
  }

  // ---------- arka plan (kaldırım, tabela, sokak) ----------
  function buildBackdrop(L) {
    const { ts, bs } = L;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#1b2b40'); lg.addColorStop(1, '#14233a');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // zemin (stabilize/parke) hafif desen
    g.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = ts; y < H - bs; y += 14) for (let x = (y / 14 % 2) * 7; x < W; x += 14) g.fillRect(x, y, 13, 13);
    // kaldırım
    g.fillStyle = '#6c7b8d'; g.fillRect(0, 0, W, ts);
    g.fillStyle = '#7f8ea0'; for (let x = 0; x < W; x += 22) g.fillRect(x + 1, 1, 20, ts - 5);
    g.fillStyle = '#4c5a6b'; g.fillRect(0, ts - 3, W, 3);
    // ağaçlar
    const rr_ = rnd(77), tr = ts * 0.36;
    for (let x = 14; x < W - 10; x += 38 + rr_() * 22) {
      if (Math.abs(x - W / 2) < Math.min(W * 0.42, 150) / 1) continue;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 2, ts * 0.5 + 3, tr, 0, 7); g.fill();
      g.fillStyle = '#2c7a45'; g.beginPath(); g.arc(x, ts * 0.5, tr, 0, 7); g.fill();
      g.fillStyle = '#3a9a58'; g.beginPath(); g.arc(x - tr * 0.3, ts * 0.5 - tr * 0.3, tr * 0.55, 0, 7); g.fill();
    }
    // tabela
    const sw = Math.min(W * 0.78, 270), sh = Math.max(14, ts * 0.72), sx = (W - sw) / 2, sy = (ts - sh) / 2 - 1;
    g.fillStyle = '#3a4656'; g.fillRect(sx + 6, sy + sh - 1, 4, 5); g.fillRect(sx + sw - 10, sy + sh - 1, 4, 5);
    const sg = g.createLinearGradient(0, sy, 0, sy + sh); sg.addColorStop(0, '#1d3a63'); sg.addColorStop(1, '#0f2240');
    g.fillStyle = sg; rr(g, sx, sy, sw, sh, 4); g.fill();
    g.strokeStyle = '#ffc83d'; g.lineWidth = 1.5; rr(g, sx + 1, sy + 1, sw - 2, sh - 2, 3.5); g.stroke();
    g.fillStyle = '#ffc83d'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = clamp(sh * 0.5, 8, 15); g.font = `900 ${fs}px system-ui, sans-serif`;
    g.fillText('SAHA PATRONU · HALI SAHA', W / 2, sy + sh / 2 + 0.5);
    // lot süsleri: sahaların dışında kalan boşluğa ağaç, çalı, bank, lamba, park etmiş araba
    lamps = [];
    if (!L.canPan) {
      const Rd = rnd(4242), pad = 10;
      const inCell = (x, y, m) => L.rects.some((r) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m);
      for (let gy = ts + 16; gy < H - bs - 12; gy += 34) for (let gx = 14; gx < W - 10; gx += 34) {
        const x = gx + (Rd() - 0.5) * 12, y = gy + (Rd() - 0.5) * 10, k = Rd();
        if (inCell(x, y, pad + 8)) continue;
        if (k < 0.42) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 2, y + 3, 10, 0, 7); g.fill(); g.fillStyle = '#2c7a45'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.fillStyle = '#3a9a58'; g.beginPath(); g.arc(x - 3, y - 3, 5.5, 0, 7); g.fill(); }
        else if (k < 0.62) { g.fillStyle = '#2f8a4d'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.arc(x + 5, y + 2, 4, 0, 7); g.arc(x - 4, y + 2, 4, 0, 7); g.fill(); }
        else if (k < 0.74) { g.fillStyle = '#5b3d25'; g.fillRect(x - 8, y - 2.5, 16, 5); g.fillStyle = '#8a5d38'; g.fillRect(x - 8, y - 2.5, 16, 2.5); g.fillStyle = '#222'; g.fillRect(x - 6, y + 2.5, 2, 2); g.fillRect(x + 4, y + 2.5, 2, 2); }
        else if (k < 0.86) { g.fillStyle = '#56657a'; g.fillRect(x - 1, y - 1, 2, 12); g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(x, y - 2, 3, 0, 7); g.fill(); lamps.push([x, y - 2]); }
        else if (y > H - bs - 70) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 11, y - 4, 24, 12); g.fillStyle = ['#d6232a', '#e8e8e8', '#2a7fd6', '#f7c600', '#444'][Math.floor(Rd() * 5)]; rr(g, x - 12, y - 6, 24, 12, 4); g.fill(); g.fillStyle = 'rgba(190,225,255,.8)'; g.fillRect(x - 3, y - 4.5, 6, 9); }
      }
    }
    // sokak
    const sy0 = H - bs;
    g.fillStyle = '#7f8ea0'; g.fillRect(0, sy0 - 4, W, 4);
    g.fillStyle = '#2a323d'; g.fillRect(0, sy0, W, bs);
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let x = 8; x < W; x += 34) g.fillRect(x, sy0 + bs / 2 - 1, 18, 2);
    g.fillStyle = '#1e252e'; g.fillRect(0, H - 3, W, 3);
    g.textBaseline = 'alphabetic';
    return cv;
  }

  function drawStreet(dt, dk, ts, bs) {
    // araba
    car.next -= dt;
    if (!car.on && car.next <= 0) { car.on = true; car.dir = Math.random() < 0.5 ? 1 : -1; car.lane = car.dir > 0 ? 0 : 1; car.x = car.dir > 0 ? -40 : W + 40; car.v = R(70, 130); car.color = ['#d6232a', '#f7c600', '#e8e8e8', '#2a7fd6', '#15151a', '#1e9c4a'][Math.floor(Math.random() * 6)]; }
    if (car.on) {
      car.x += car.dir * car.v * dt;
      if ((car.dir > 0 && car.x > W + 40) || (car.dir < 0 && car.x < -40)) { car.on = false; car.next = R(7, 16); }
      const cy = H - bs + bs * (car.lane ? 0.72 : 0.28), cl = clamp(bs * 0.55, 15, 26), cwid = cl * 0.5;
      c.save(); c.translate(car.x, cy); if (car.dir < 0) c.scale(-1, 1);
      c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, -cl / 2 + 1, -cwid / 2 + 2, cl, cwid, 3); c.fill();
      c.fillStyle = car.color; rr(c, -cl / 2, -cwid / 2, cl, cwid, cwid * 0.35); c.fill();
      c.fillStyle = 'rgba(190,225,255,.85)'; c.fillRect(-cl * 0.08, -cwid / 2 + 1.5, cl * 0.22, cwid - 3); c.fillRect(-cl * 0.38, -cwid / 2 + 2, cl * 0.12, cwid - 4);
      c.fillStyle = '#fff6c0'; c.fillRect(cl / 2 - 2, -cwid / 2 + 1, 2, 2); c.fillRect(cl / 2 - 2, cwid / 2 - 3, 2, 2);
      if (dk > 0.2) { c.globalCompositeOperation = 'lighter'; const gr = c.createLinearGradient(cl / 2, 0, cl / 2 + 34, 0); gr.addColorStop(0, `rgba(255,240,170,${0.5 * dk})`); gr.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = gr; c.fillRect(cl / 2, -cwid * 0.8, 34, cwid * 1.6); }
      c.restore();
    }
    // yaya
    ped.x += ped.dir * dt * 0.025; if (ped.x > 0.95 || ped.x < 0.05) ped.dir *= -1;
    c.fillStyle = '#e8584d'; c.beginPath(); c.arc(ped.x * W, ts * 0.78, 2.4, 0, 7); c.fill();
    c.fillStyle = '#e2b48f'; c.beginPath(); c.arc(ped.x * W, ts * 0.78 - 1.5, 1.4, 0, 7); c.fill();
  }

  // ---------- statik hücre ----------
  function lotBox(g, x, y, w, h, plus) {
    g.save(); g.setLineDash([2, 1.6]); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.55; g.strokeRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, y, w, h); g.setLineDash([]);
    if (plus) { const cx = x + w / 2, cy = y + h / 2, k = Math.min(w, h) * 0.22; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(cx - k, cy); g.lineTo(cx + k, cy); g.moveTo(cx, cy - k); g.lineTo(cx, cy + k); g.stroke(); }
    g.restore();
  }
  function drawEmptySlot(g) {
    g.fillStyle = '#22354b'; rr(g, 0, 0, CW, CH, 5); g.fill();
    lotBox(g, 14, 11, 100, 58, false);
    const cx = 64, cy = 38; g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy); g.moveTo(cx, cy - 8); g.lineTo(cx, cy + 8); g.stroke();
  }

  function drawStatic(g, p, v, state, idx, n) {
    const f = v.facilities || {}, u = p.upgrades || {}, lvl = state.level, pIdx = n > 1 ? 1 : 0;
    const Rn = rnd(hash(p.id));
    g.fillStyle = '#26394f'; rr(g, 0, 0, CW, CH, 5); g.fill();
    g.fillStyle = '#1d2e43'; g.fillRect(FX - 5, FY - 5, FW + 10, FH + 10);
    const lush = u.turf || 0;
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? `hsl(${138 - lush * 1.5} 48% ${33 + lush * 0.7}%)` : `hsl(${138 - lush * 1.5} 46% ${29 + lush * 0.7}%)`;
      g.fillRect(FX + i * FW / 10, FY, FW / 10 + 0.2, FH);
    }
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 140; i++) g.fillRect(FX + Rn() * FW, FY + Rn() * FH, 0.5, 0.5);
    const worn = Math.floor((100 - (p.condition ?? 100)) / 7);
    for (let i = 0; i < worn; i++) {
      const gx = Rn() < 0.5 ? Rn() * 14 : 86 + Rn() * 14, x = Rn() < 0.35 ? FX + Rn() * FW : FX + gx, y = FY + 10 + Rn() * (FH - 20);
      g.fillStyle = `rgba(150,125,70,${0.18 + Rn() * 0.15})`;
      g.beginPath(); g.ellipse(x, y, 3 + Rn() * 4, 2 + Rn() * 3, Rn() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = state.cosmetics?.lineColor && isHex(state.cosmetics.lineColor) ? state.cosmetics.lineColor : '#f2f6f2';
    g.globalAlpha = 0.9; g.lineWidth = 0.6;
    g.strokeRect(FX + 1.5, FY + 1.5, FW - 3, FH - 3);
    g.beginPath(); g.moveTo(FX + FW / 2, FY + 1.5); g.lineTo(FX + FW / 2, FY + FH - 1.5); g.stroke();
    g.beginPath(); g.arc(FX + FW / 2, FY + FH / 2, 8, 0, 7); g.stroke();
    g.strokeRect(FX + 1.5, FY + FH / 2 - 14, 14, 28); g.strokeRect(FX + FW - 15.5, FY + FH / 2 - 14, 14, 28);
    g.strokeRect(FX + 1.5, FY + FH / 2 - 7, 5, 14); g.strokeRect(FX + FW - 6.5, FY + FH / 2 - 7, 5, 14);
    g.globalAlpha = 1;
    for (const side of [0, 1]) {
      const gx = side ? FX + FW - 0.5 : FX - 3.5;
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(gx, FY + FH / 2 - 5, 4, 10);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.25;
      for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(gx + k, FY + FH / 2 - 5); g.lineTo(gx + k, FY + FH / 2 + 5); g.stroke(); }
      for (let k = 0; k <= 5; k++) { g.beginPath(); g.moveTo(gx, FY + FH / 2 - 5 + k * 2); g.lineTo(gx + 4, FY + FH / 2 - 5 + k * 2); g.stroke(); }
      g.strokeStyle = '#fff'; g.lineWidth = 0.7; g.strokeRect(gx, FY + FH / 2 - 5, 4, 10);
    }
    // çit / file
    const fx0 = FX - 3, fy0 = FY - 3, fw = FW + 6, fh = FH + 6;
    g.strokeStyle = 'rgba(16,58,34,0.8)'; g.lineWidth = 2.4; g.strokeRect(fx0, fy0, fw, fh);
    g.strokeStyle = 'rgba(160,230,180,0.18)'; g.lineWidth = 0.3;
    for (let x = fx0; x <= fx0 + fw; x += 1.6) { g.beginPath(); g.moveTo(x, fy0 - 1); g.lineTo(x, fy0 + 1); g.moveTo(x, fy0 + fh - 1); g.lineTo(x, fy0 + fh + 1); g.stroke(); }
    for (let y = fy0; y <= fy0 + fh; y += 1.6) { g.beginPath(); g.moveTo(fx0 - 1, y); g.lineTo(fx0 + 1, y); g.moveTo(fx0 + fw - 1, y); g.lineTo(fx0 + fw + 1, y); g.stroke(); }
    g.fillStyle = '#6b7b8e';
    for (let x = fx0; x <= fx0 + fw + 0.1; x += fw / 8) { g.fillRect(x - 0.5, fy0 - 1, 1, 1.6); g.fillRect(x - 0.5, fy0 + fh - 0.6, 1, 1.6); }
    for (let y = fy0; y <= fy0 + fh + 0.1; y += fh / 5) { g.fillRect(fx0 - 1, y - 0.5, 1.6, 1); g.fillRect(fx0 + fw - 0.6, y - 0.5, 1.6, 1); }
    // kapı (alt çit ortası)
    g.fillStyle = '#26394f'; g.fillRect(GATE[0] - 6, fy0 + fh - 1.6, 12, 3.4);
    g.fillStyle = '#c9d4e2'; g.fillRect(GATE[0] - 6.6, fy0 + fh - 2, 1.4, 4); g.fillRect(GATE[0] + 5.2, fy0 + fh - 2, 1.4, 4);
    g.strokeStyle = '#ffc83d'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(GATE[0] - 5, fy0 + fh + 2.4); g.lineTo(GATE[0] + 5, fy0 + fh + 2.4); g.stroke();
    // tribün
    if (u.stands > 0) {
      const rows = Math.min(3, 1 + Math.floor(u.stands / 4));
      for (let r = 0; r < rows; r++) {
        g.fillStyle = r % 2 ? '#8795a8' : '#a3afbf'; g.fillRect(FX - 2, 1 + r * 2, FW + 4, 2);
        for (let i = 0; i < 12 + u.stands * 3; i++) {
          g.fillStyle = ['#f7c600', '#d6232a', '#14285e', '#fff', '#2a7fd6'][Math.floor(Rn() * 5)];
          g.fillRect(FX + Rn() * (FW - 1), 1.3 + r * 2, 1, 1.2);
        }
      }
    } else if (lvl >= unlockLv('stands')) lotBox(g, FX - 2, 0.8, FW + 4, 6.4, true);
    // direkler
    if (u.lights > 0) {
      for (const [x, y] of [[fx0, fy0], [fx0 + fw, fy0], [fx0, fy0 + fh], [fx0 + fw, fy0 + fh]]) {
        g.fillStyle = '#56657a'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
        g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill();
      }
    }
    // tesis noktaları
    if (idx === 0) {
      const [cx, cy, cwd, chh] = SPOTS.cafe;
      if (f.cafe > 0) {
        g.fillStyle = '#7a4a2b'; g.fillRect(1.5, 50, 9, 10);
        g.fillStyle = '#c9362d'; g.fillRect(0.5, 48.5, 11, 4.5);
        g.fillStyle = '#e8584d'; g.fillRect(0.5, 48.5, 11, 1.5);
        g.fillStyle = '#ffd77a'; g.fillRect(3, 55, 6, 2.6);
        g.fillStyle = '#fff'; g.fillRect(4.2, 53.4, 3.6, 1.2);
        g.fillStyle = '#e8d9b8'; g.beginPath(); g.arc(3.5, 66.5, 1.2, 0, 7); g.arc(8.5, 66.5, 1.2, 0, 7); g.fill();
        g.fillStyle = '#2a7fd6'; g.fillRect(2, 63.5, 8, 1);
        if (f.cafe >= 4) { g.fillStyle = '#e8584d'; g.fillRect(0.5, 61.5, 11, 1.2); }
      } else if (lvl >= unlockLv('cafe')) lotBox(g, cx, cy, cwd, chh, true);
      if (f.rental > 0) { g.fillStyle = '#2a7fd6'; g.fillRect(1.5, 38, 9, 7); g.fillStyle = '#9fd0ff'; g.fillRect(2.5, 40, 7, 1); g.fillRect(2.5, 42.5, 7, 1); }
      else if (lvl >= unlockLv('rental')) lotBox(g, ...SPOTS.rental, true);
    }
    if (idx === (n > 1 ? 0 : 0)) {
      if (f.camera > 0) { g.fillStyle = '#56657a'; g.fillRect(122, 3, 1.4, 8); g.fillStyle = '#222'; g.fillRect(119.5, 2.5, 6.5, 4); g.fillStyle = '#ff4040'; g.beginPath(); g.arc(125, 4.5, 0.8, 0, 7); g.fill(); }
      else if (lvl >= unlockLv('camera')) lotBox(g, ...SPOTS.camera, true);
    }
    if (idx === pIdx) {
      if (f.parking > 0) {
        g.fillStyle = '#1b2735'; g.fillRect(119, 12, 8.5, 56);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.35;
        const cars = Math.min(6, 1 + Math.floor(f.parking / 2));
        for (let i = 0; i < 7; i++) {
          const y = 14 + i * 7.5;
          g.beginPath(); g.moveTo(119, y); g.lineTo(127.5, y); g.stroke();
          if (i < cars) { g.fillStyle = ['#d6232a', '#e8e8e8', '#2a7fd6', '#f7c600', '#222', '#1e9c4a'][i]; g.fillRect(120.5, y + 1.2, 6, 4.8); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(122, y + 2, 3, 2.6); }
        }
      } else if (lvl >= unlockLv('parking')) lotBox(g, ...SPOTS.parking, true);
    }
    if (u.roof > 0) {
      g.fillStyle = 'rgba(210,228,245,0.2)'; g.fillRect(fx0, fy0, fw, fh);
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.4;
      for (let x = fx0 + 8; x < fx0 + fw; x += 11) { g.beginPath(); g.moveTo(x, fy0); g.lineTo(x, fy0 + fh); g.stroke(); }
      g.strokeStyle = 'rgba(235,245,255,0.7)'; g.lineWidth = 1; g.strokeRect(fx0, fy0, fw, fh);
    }
  }

  function staticFor(p, v, state, idx, n, r) {
    const f = v.facilities || {}, pIdx = n > 1 ? 1 : 0, ul = ['cafe', 'rental', 'parking', 'camera', 'stands'].map((k) => state.level >= unlockLv(k) ? 1 : 0).join('');
    const key = [p.id, JSON.stringify(p.upgrades), Math.floor((p.condition ?? 100) / 7), idx === 0 ? `${f.cafe}${f.rental}${f.camera}` : '', idx === pIdx ? f.parking : '', ul, state.cosmetics?.lineColor, Math.round(r.s * 20)].join('|');
    let e = statics.get(p.id);
    if (!e || e.key !== key) {
      const cv = e?.cv || document.createElement('canvas');
      cv.width = Math.ceil(CW * r.s * dpr); cv.height = Math.ceil(CH * r.s * dpr);
      const g = cv.getContext('2d'); g.scale(cv.width / CW, cv.height / CH);
      drawStatic(g, p, v, state, idx, n);
      e = { key, cv }; statics.set(p.id, e);
    }
    return e.cv;
  }
  function slotStatic(r) {
    let e = statics.get('__slot');
    const key = Math.round(r.s * 20);
    if (!e || e.key !== key) {
      const cv = e?.cv || document.createElement('canvas'); cv.width = Math.ceil(CW * r.s * dpr); cv.height = Math.ceil(CH * r.s * dpr);
      const g = cv.getContext('2d'); g.scale(cv.width / CW, cv.height / CH); drawEmptySlot(g); e = { key, cv }; statics.set('__slot', e);
    }
    return e.cv;
  }

  // ---------- oyuncu simülasyonu ----------
  function kitFor(match, team) {
    const h = hash((match.colors || []).join() + match.customerType);
    const k = KITS[(h + team * 2) % KITS.length];
    return isHex(match.colors?.[team]) && team === 0 ? [match.colors[0], k[1]] : k;
  }
  function newSim(p) {
    const players = [0, 1].flatMap((team) => FORM.map(([hx, hy], i) => {
      const x = team ? 100 - hx : hx;
      return { team, i, gk: i === 0, hx: x, hy, x: 44 + Math.random() * 12, y: 60 + Math.random() * 6, vx: 0, vy: -3, a: -Math.PI / 2 };
    }));
    return { key: p.match.startHour, players, ball: { x: 50, y: 29 }, owner: 4, mode: 'enter', decide: 0.3, score: [0, 0], fl: null, cel: null, flash: { side: 0, t: 0 }, kits: [kitFor(p.match, 0), kitFor(p.match, 1)], t: 0, type: p.match.customerType };
  }
  const nearest = (sim, team, x, y, noGk = true) => { let b = null, bd = 1e9; for (const q of sim.players) { if (q.team !== team || (noGk && q.gk)) continue; const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; b = q; } } return b; };
  const idxOf = (sim, q) => q.team * 7 + q.i;

  function stepSim(sim, dt, p) {
    sim.t += dt;
    const own = sim.players[sim.owner], b = sim.ball;
    if (sim.mode === 'enter') {
      if (sim.t > 1.7) { sim.mode = 'own'; sim.decide = 0.3; }
    } else if (sim.mode === 'own') {
      b.x = own.x + Math.cos(own.a) * 1.6; b.y = own.y + Math.sin(own.a) * 1.6;
      sim.decide -= dt;
      if (sim.decide <= 0) {
        const T = own.team, d = T ? -1 : 1, goalX = T ? 0 : 100, dist = Math.abs(goalX - own.x);
        if (!own.gk && dist < 32 && Math.random() < 0.4) {
          const keeper = sim.players[(1 - T) * 7];
          const sy = 29 + (Math.random() - 0.5) * 12, saved = Math.random() < 0.45;
          sim.fl = { kind: 'shot', tx: goalX, ty: sy, T, saved, speed: 85 }; keeper.dive = saved ? sy : (sy > 29 ? sy - 10 : sy + 10);
          sim.mode = 'flight'; onKick?.('shot');
        } else if (own.gk || Math.random() < 0.8) {
          const mates = sim.players.filter((q) => q.team === T && q !== own && !q.gk);
          const ahead = mates.filter((q) => (q.x - own.x) * d > -4);
          const to = (ahead.length && Math.random() < 0.8 ? ahead : mates)[Math.floor(Math.random() * (ahead.length || mates.length))];
          sim.fl = { kind: 'pass', to, tx: to.x + d * 3, ty: to.y, T, speed: 60 };
          sim.mode = 'flight';
        }
        sim.decide = sim.mode === 'own' ? 0.25 : 0.4 + Math.random() * 0.3;
      }
    } else if (sim.mode === 'flight') {
      const f = sim.fl, dx = f.tx - b.x, dy = f.ty - b.y, dd = Math.hypot(dx, dy), st = f.speed * dt;
      if (dd <= st) {
        b.x = f.tx; b.y = f.ty;
        if (f.kind === 'pass') {
          const opp = nearest(sim, 1 - f.T, b.x, b.y);
          const icpt = opp && Math.hypot(opp.x - b.x, opp.y - b.y) < 9 && Math.random() < 0.3;
          sim.owner = idxOf(sim, icpt ? opp : f.to); sim.mode = 'own'; sim.decide = 0.15 + Math.random() * 0.2;
        } else {
          const kp = sim.players[(1 - f.T) * 7];
          if (f.saved) { sim.owner = idxOf(sim, kp); sim.mode = 'own'; sim.decide = 0.5; kp.dive = null; }
          else { sim.score[f.T]++; sim.mode = 'goal'; sim.cel = { T: f.T, t: 1.8, who: nearest(sim, f.T, f.tx, 29) }; sim.flash = { side: f.T ? 0 : 1, t: 1 }; onGoal?.(p, f.T, sim.score); }
        }
      } else { b.x += dx / dd * st; b.y += dy / dd * st; }
    } else if (sim.mode === 'goal') {
      sim.flash.t = Math.max(0, sim.flash.t - dt * 0.7);
      sim.cel.t -= dt;
      if (sim.cel.t <= 0) {
        for (const q of sim.players) { q.x = q.hx; q.y = q.hy; q.vx = q.vy = 0; q.dive = null; }
        b.x = 50; b.y = 29; sim.owner = (1 - sim.cel.T) * 7 + 4; sim.mode = 'own'; sim.decide = 0.4; sim.cel = null;
      }
    }
    const ownNow = sim.players[sim.owner];
    const chase = [nearest(sim, 0, b.x, b.y), nearest(sim, 1, b.x, b.y)];
    for (const q of sim.players) {
      const d = q.team ? -1 : 1, goalX = q.team ? 0 : 100;
      let tx, ty, sp = 8.5;
      if (sim.mode === 'enter') { tx = q.hx; ty = q.hy; sp = 15; }
      else if (sim.mode === 'goal') {
        const w = sim.cel.who;
        if (q === w) { tx = goalX - d * 4; ty = w.y < 29 ? 2 : 56; sp = 14; }
        else if (q.team === sim.cel.T && !q.gk) { tx = w.x - d * 6; ty = w.y; sp = 11; }
        else { tx = q.hx; ty = q.hy; sp = 5; }
      } else if (q.gk) { tx = q.hx; ty = q.dive != null ? q.dive : clamp(b.y, 29 - 9, 29 + 9); sp = q.dive != null ? 16 : 9; }
      else if (q === ownNow && sim.mode === 'own') { tx = goalX - d * 6; ty = 29 + Math.sin(sim.t * 2.5 + q.i) * 12; sp = 10; }
      else if (sim.mode === 'flight' && sim.fl.kind === 'pass' && q === sim.fl.to) { tx = sim.fl.tx; ty = sim.fl.ty; sp = 11; }
      else if (chase[q.team] === q && q !== ownNow) { tx = b.x; ty = b.y; sp = 9.5; }
      else { const att = ownNow.team === q.team ? 0.55 : 0.35; tx = clamp(q.hx + (b.x - 50) * att, 4, 96); ty = q.hy + (b.y - 29) * 0.3; }
      const ddx = tx - q.x, ddy = ty - q.y, dist = Math.hypot(ddx, ddy) || 1, s = sp * Math.min(1, dist / 3);
      q.vx += (ddx / dist * s - q.vx) * Math.min(1, dt * 7); q.vy += (ddy / dist * s - q.vy) * Math.min(1, dt * 7);
      q.x = clamp(q.x + q.vx * dt, 1, 99); q.y = clamp(q.y + q.vy * dt, 1.5, sim.mode === 'enter' ? 70 : 56.5);
      if (Math.hypot(q.vx, q.vy) > 0.5) q.a = Math.atan2(q.vy, q.vx);
    }
  }
  function stepLeave(L, dt) {
    L.t += dt;
    for (const q of L.players) {
      const tx = 50, ty = 66, dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1;
      q.vx += (dx / d * 11 - q.vx) * Math.min(1, dt * 6); q.vy += (dy / d * 11 - q.vy) * Math.min(1, dt * 6);
      q.x += q.vx * dt; q.y += q.vy * dt; q.a = Math.atan2(q.vy, q.vx);
    }
  }

  // ---------- ortam insanları ----------
  const SHIRTS = ['#d6232a', '#2a7fd6', '#f7c600', '#1e9c4a', '#7a1230', '#e8e8e8'];
  function makeAmb(p, idx, state) {
    const Rn = rnd(hash(p.id + (state.stats?.matches || 0)));
    const a = [];
    a.push({ k: 'keeper', x: FX + 20, y: FY + 15, wx: FX + 20, wy: FY + 15, a: 0, body: '#ff8a2b', trim: '#3a3a3a', t: 0 });
    a.push({ k: 'kid', x: GATE[0] - 12, y: GATE[1] + 3, a: -1.2, body: '#2a7fd6', trim: '#fff', z: 0.8, t: Rn() * 6 });
    const nw = Math.floor(Rn() * 3);
    for (let i = 0; i < nw; i++) a.push({ k: 'waiter', x: GATE[0] + 2 + i * 6 - 3, y: GATE[1] + 4.5 + (i % 2), a: -Math.PI / 2, body: SHIRTS[Math.floor(Rn() * 6)], trim: SHIRTS[Math.floor(Rn() * 6)], t: Rn() * 6 });
    return a;
  }
  function stepAmb(list, dt, hour) {
    for (const q of list) {
      q.t += dt;
      if (q.k === 'keeper') {
        const dx = q.wx - q.x, dy = q.wy - q.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { q.wx = FX + R(8, 92); q.wy = FY + R(8, 50); }
        else { q.x += dx / d * 4.2 * dt; q.y += dy / d * 4.2 * dt; q.a = Math.atan2(dy, dx); }
      } else if (q.k === 'kid') { q.x = GATE[0] - 12 + Math.sin(q.t * 0.7) * 4; }
    }
  }
  function drawAmb(list, jugBall) {
    for (const q of list) {
      if (q.k === 'keeper') {
        const bx = Math.cos(q.a), by = Math.sin(q.a);
        c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(q.x + bx * 2, q.y + by * 2); c.lineTo(q.x + bx * 6, q.y + by * 6 + Math.sin(q.t * 8) * 0.8); c.stroke();
        c.strokeStyle = '#d8d0c0'; c.beginPath(); c.moveTo(q.x + bx * 6 - by * 1.5, q.y + by * 6 + bx * 1.5); c.lineTo(q.x + bx * 6 + by * 1.5, q.y + by * 6 - bx * 1.5); c.stroke();
        person(c, q.x, q.y, q.a, q.body, q.trim, 1);
      } else if (q.k === 'kid') {
        const bob = Math.abs(Math.sin(q.t * 6)) * 2.2;
        person(c, q.x, q.y, q.a, q.body, q.trim, q.z);
        c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 0.25; c.beginPath(); c.arc(q.x + 2.5, q.y - bob - 0.5, 1, 0, 7); c.fill(); c.stroke();
      } else if (q.k === 'tea') {
        person(c, q.x, q.y, q.a, q.body, q.trim, 0.9);
        c.fillStyle = '#c9362d'; c.fillRect(q.x + 1, q.y - 0.4, 1.1, 1.3);
        c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(q.x + 1.6, q.y - 1.5 - ((q.t * 1.5) % 2), 0.4, 0, 7); c.fill();
      } else person(c, q.x + Math.sin(q.t * 1.3) * 0.4, q.y, q.a, q.body, q.trim, 1);
    }
  }

  // ---------- ana çizim ----------
  function toScreen(r, vx, vy) { return portrait ? [r.x + (CH - vy) * r.s, r.y + vx * r.s + panY] : [r.x + vx * r.s, r.y + vy * r.s + panY]; }
  function vbox(r, [vx, vy, vw, vh]) { return portrait ? { x: r.x + (CH - (vy + vh)) * r.s, y: r.y + vx * r.s + panY, w: vh * r.s, h: vw * r.s } : { x: r.x + vx * r.s, y: r.y + vy * r.s + panY, w: vw * r.s, h: vh * r.s }; }

  function draw(state, dtReal, clock) {
    if (!W) return;
    const v = state.venues.find((x) => x.id === state.activeVenueId) || state.venues[0];
    if (!v) return;
    const cap = config.venues?.find((t) => t.id === v.typeId)?.capacity ?? v.pitches.length, nSlots = Math.max(cap, v.pitches.length);
    const L = doLayout(nSlots);
    if (!backdrop) backdrop = buildBackdrop(L);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.drawImage(backdrop, 0, 0, W, H);
    const t = clock.hour + (clock.minute || 0) / 60, dk = darkness(t), sp = state.time?.speed || 1;
    const dt = Math.min(dtReal, 0.05) * sp, hour = Math.floor(t);
    hits = [];
    // gece (arka plan)
    if (dk > 0) {
      c.fillStyle = `rgba(4,9,30,${0.5 * dk})`; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      for (const [x, y] of [...lamps, ...[0.12, 0.5, 0.88].map((f) => [W * f, L.ts * 0.5])]) { const gr = c.createRadialGradient(x, y, 0, x, y, 44); gr.addColorStop(0, `rgba(255,225,150,${0.5 * dk})`); gr.addColorStop(1, 'rgba(255,225,150,0)'); c.fillStyle = gr; c.fillRect(x - 44, y - 44, 88, 88); }
      c.globalCompositeOperation = 'source-over';
    }
    drawStreet(Math.min(dtReal, 0.05), dk, L.ts, L.bs);

    // hücreler (kaydırılabilir alan)
    c.save(); c.beginPath(); c.rect(0, L.ts - 2, W, L.lotH + 2); c.clip();
    const roofRects = [];
    for (let i = 0; i < nSlots; i++) {
      const r = L.rects[i], p = v.pitches[i], s = r.s, ry = r.y + panY;
      if (ry > H || ry + r.h < 0) continue;
      c.save();
      if (portrait) { c.translate(r.x + CH * s, ry); c.rotate(Math.PI / 2); } else c.translate(r.x, ry);
      c.scale(s, s); c.beginPath(); c.rect(0, 0, CW, CH); c.clip();
      if (!p) { c.drawImage(slotStatic(r), 0, 0, CW, CH); c.restore(); hits.push({ type: 'lot', ...vbox(r, [14, 11, 100, 58]) }); const bb = vbox(r, [14, 11, 100, 58]); labelPill('+ Yeni saha', '', bb.x + bb.w / 2, bb.y + bb.h - 4, s, '#ffc83d', true); continue; }
      const lit = (p.upgrades?.lights || 0) > 0;
      c.drawImage(staticFor(p, v, state, i, v.pitches.length, r), 0, 0, CW, CH);
      let sim = sims.get(p.id);
      if (p.match) {
        amb.delete(p.id);
        if (!sim || sim.key !== p.match.startHour) { sim = newSim(p); sims.set(p.id, sim); leaving.delete(p.id); }
        stepSim(sim, dt, p);
        for (const q of [...sim.players].sort((a, b) => a.y - b.y)) {
          const kit = q.gk ? [KEEPERS[q.team], '#222'] : sim.kits[q.team];
          const jump = sim.mode === 'goal' && sim.cel && q.team === sim.cel.T && !q.gk ? Math.abs(Math.sin(sim.t * 11 + q.i)) * 2 : 0;
          person(c, FX + q.x, FY + q.y, q.a, kit[0], kit[1], 1, jump);
        }
        const bx = FX + sim.ball.x, by = FY + sim.ball.y;
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(bx, by + 0.8, 1.1, 0.6, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 0.3; c.beginPath(); c.arc(bx, by - (sim.mode === 'flight' ? 1 : 0), 1.4, 0, 7); c.fill(); c.stroke();
        if (sim.flash.t > 0) { c.fillStyle = `rgba(255,255,255,${sim.flash.t * 0.5})`; c.fillRect(sim.flash.side ? FX + FW - 1 : FX - 3.5, FY + FH / 2 - 6, 5, 12); }
        if (p.match.kind === 'tournament') { c.strokeStyle = 'rgba(255,200,61,.9)'; c.lineWidth = 0.9; c.strokeRect(FX - 4.5, FY - 4.5, FW + 9, FH + 9); }
      } else {
        if (sim) { leaving.set(p.id, { players: sim.players, kits: sim.kits, t: 0 }); sims.delete(p.id); }
        const lv = leaving.get(p.id);
        if (lv) {
          stepLeave(lv, dt);
          for (const q of lv.players) { const kit = q.gk ? [KEEPERS[q.team], '#222'] : lv.kits[q.team]; c.globalAlpha = clamp(1 - (lv.t - 1.8) / 0.8, 0, 1); person(c, FX + q.x, FY + q.y, q.a, kit[0], kit[1], 1); }
          c.globalAlpha = 1;
          if (lv.t > 2.7) leaving.delete(p.id);
        } else {
          let a = amb.get(p.id); if (!a) { a = makeAmb(p, i, state); amb.set(p.id, a); }
          stepAmb(a, dt, hour); drawAmb(a);
        }
      }
      // çay ocağı müşterileri
      if (i === 0 && (v.facilities?.cafe || 0) > 0) {
        let tea = amb.get('__tea'); if (!tea) { tea = [{ k: 'tea', x: 3.6, y: 65.4, a: 0.4, body: '#d6232a', trim: '#fff', t: 0 }, { k: 'tea', x: 8.6, y: 65.4, a: Math.PI - 0.4, body: '#2a7fd6', trim: '#fff', t: 1.3 }]; amb.set('__tea', tea); }
        for (const q of tea) q.t += dt; drawAmb(tea);
      }
      // gece
      if (dk > 0) {
        c.fillStyle = `rgba(4,9,30,${(lit ? 0.22 : 0.6) * dk})`; c.fillRect(0, 0, CW, CH);
        if (lit) {
          c.globalCompositeOperation = 'lighter';
          for (const [x, y] of [[FX - 3, FY - 3], [FX + FW + 3, FY - 3], [FX - 3, FY + FH + 3], [FX + FW + 3, FY + FH + 3]]) {
            const gr = c.createRadialGradient(x, y, 0, x, y, 42); gr.addColorStop(0, `rgba(255,236,160,${0.5 * dk})`); gr.addColorStop(1, 'rgba(255,236,160,0)');
            c.fillStyle = gr; c.fillRect(x - 42, y - 42, 84, 84);
          }
          c.globalCompositeOperation = 'source-over';
        }
      }
      c.restore();
      if ((p.upgrades?.roof || 0) > 0) roofRects.push(r);
      const rect = portrait ? { x: r.x, y: ry, w: CH * s, h: CW * s } : { x: r.x, y: ry, w: CW * s, h: CH * s };
      screenRect.set(p.id, rect);
      if (selected === p.id && v.pitches.length > 1) { c.strokeStyle = '#3ddc84'; c.lineWidth = 2; c.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2); }
      // dokunma bölgeleri (tesisler önce)
      const f = v.facilities || {}, pIdx = v.pitches.length > 1 ? 1 : 0;
      if (i === 0) { hits.push({ type: 'fac', key: 'cafe', ...vbox(r, SPOTS.cafe) }, { type: 'fac', key: 'rental', ...vbox(r, SPOTS.rental) }, { type: 'fac', key: 'camera', ...vbox(r, SPOTS.camera) }); }
      if (i === pIdx) hits.push({ type: 'fac', key: 'parking', ...vbox(r, SPOTS.parking) });
      hits.push({ type: 'upg', key: 'stands', id: p.id, ...vbox(r, [FX - 2, 0.8, FW + 4, 6.4]) });
      hits.push({ type: 'pitch', id: p.id, ...rect });
      labelPill(pitchName(p), pillText(p, sim, state, t), rect.x + rect.w / 2, rect.y + rect.h - 3, s, null);
    }
    c.restore();
    bubbleTick(Math.min(dtReal, 0.05), state, v, L, roofRects);
    // yağmur
    if (state.weather?.kind === 'rain') {
      c.save();
      if (roofRects.length) { c.beginPath(); c.rect(0, 0, W, H); roofRects.forEach((r) => { const q = portrait ? { x: r.x + r.w * 0.1, y: r.y + panY + r.h * 0.1 } : { x: r.x + r.w * 0.1, y: r.y + panY + r.h * 0.1 }; c.rect(q.x, q.y, r.w * 0.8, r.h * 0.8); }); c.clip('evenodd'); }
      c.fillStyle = 'rgba(10,20,40,0.18)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(190,215,255,0.45)'; c.lineWidth = 1; c.beginPath();
      for (const d of rain) { d.y += dtReal * d.s * 1.3; d.x -= dtReal * 0.15; if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.2; } if (d.x < 0) d.x += 1.1; const x = d.x * W, y = d.y * H; c.moveTo(x, y); c.lineTo(x - 3, y + 10); }
      c.stroke(); c.restore();
    }
    // yüzen yazılar
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.age += dtReal; if (f.age > f.life) { floats.splice(i, 1); continue; }
      const k = f.age / f.life, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      c.globalAlpha = a; c.font = `800 ${f.size}px system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.65)'; c.fillStyle = f.color;
      const y = f.y - k * 44, sc = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : 1.1 - Math.min(0.1, (k - 0.12));
      c.save(); c.translate(f.x, y); c.scale(sc, sc); c.strokeText(f.text, 0, 0); c.fillText(f.text, 0, 0); c.restore(); c.globalAlpha = 1;
    }
  }

  function pillText(p, sim, state, t) {
    const gh = state.time?.gameHours ?? 0;
    if (p.match) return p.match.kind === 'tournament' ? 'TURNUVA' : `${sim?.score[0] ?? 0} - ${sim?.score[1] ?? 0}`;
    if (p.blockedUntilHour > gh) return 'Kapalı';
    if (t >= 2 && t < 9) return 'Kapalı · 09:00';
    if (!(p.upgrades?.lights > 0) && (t >= 18 || t < 2)) return 'Işık yok';
    return 'Boş';
  }
  function labelPill(name, extra, cx, cy, s, col, plain) {
    const fs = clamp(s * 5.6, 9, 13);
    c.font = `700 ${fs}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
    const w1 = c.measureText(name).width, w2 = extra ? c.measureText(extra).width + 8 : 0, h = fs + 5, w = w1 + w2 + 14;
    const x = cx - w / 2;
    c.fillStyle = plain ? 'rgba(8,16,30,0.6)' : 'rgba(8,16,30,0.78)'; rr(c, x, cy - h / 2, w, h, h / 2); c.fill();
    c.fillStyle = col || '#fff'; c.fillText(name, x + 7, cy);
    if (extra) { c.fillStyle = extra === 'Boş' ? '#8ea3bf' : /Kapalı|Işık/.test(extra) ? '#ffb86b' : extra === 'TURNUVA' ? '#ffc83d' : '#9be8b4'; c.fillText(extra, x + 7 + w1 + 8, cy); }
    c.textBaseline = 'alphabetic';
  }

  // ---------- konuşma balonları ----------
  function bubbleTick(dt, state, v, L) {
    bubbleT -= dt;
    if (bubbleT <= 0 && !document.hidden) {
      bubbleT = R(10, 20);
      const cand = [];
      v.pitches.forEach((p, i) => {
        const r = L.rects[i], am = amb.get(p.id), sim = sims.get(p.id), type = p.match?.customerType || 'neighborhood';
        if (am) am.forEach((q) => cand.push({ q, r, p, pick: q.k === 'keeper' ? 'keeper' : q.k === 'waiter' || q.k === 'kid' ? 'waiting' : type, local: true }));
        else if (sim && sim.mode !== 'goal') { const q = sim.players[1 + Math.floor(Math.random() * 12)]; cand.push({ q: { x: FX + q.x, y: FY + q.y, ref: q }, r, p, pick: type, local: true, follow: q }); }
        if (i === 0 && amb.get('__tea')) amb.get('__tea').forEach((q) => cand.push({ q, r, p, pick: 'tea', local: true }));
      });
      if (cand.length) { const c0 = cand[Math.floor(Math.random() * cand.length)]; const arr = lines(c0.pick); bubbles.push({ ...c0, text: arr[Math.floor(Math.random() * arr.length)], age: 0, life: 3.4 }); if (bubbles.length > 2) bubbles.shift(); }
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.age += dt; if (b.age > b.life) { bubbles.splice(i, 1); continue; }
      const q = b.follow ? { x: FX + b.follow.x, y: FY + b.follow.y } : b.q;
      const [sx, sy] = toScreen(b.r, q.x, q.y);
      const a = b.age < 0.25 ? b.age / 0.25 : b.age > b.life - 0.4 ? (b.life - b.age) / 0.4 : 1;
      c.globalAlpha = a; c.font = '700 11px system-ui, sans-serif'; c.textAlign = 'center';
      const w = Math.min(c.measureText(b.text).width + 14, W - 8), h = 20, bx = clamp(sx - w / 2, 4, W - w - 4), by = sy - 30 - (1 - a) * 4;
      c.fillStyle = 'rgba(255,255,255,.96)'; rr(c, bx, by, w, h, 8); c.fill();
      c.beginPath(); c.moveTo(sx - 4, by + h - 0.5); c.lineTo(sx + 4, by + h - 0.5); c.lineTo(sx, by + h + 5); c.closePath(); c.fill();
      c.fillStyle = '#0f1b2d'; c.textBaseline = 'middle'; c.fillText(b.text, bx + w / 2, by + h / 2 + 0.5); c.textBaseline = 'alphabetic'; c.globalAlpha = 1;
    }
  }

  // ---------- dokunma / kaydırma ----------
  let pd = null;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); pd = { x: e.clientX, y: e.clientY, pan: panY, moved: false }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!pd) return; const dy = e.clientY - pd.y;
    if (Math.abs(dy) > 8 || Math.abs(e.clientX - pd.x) > 8) pd.moved = true;
    if (pd.moved && layout?.canPan) panY = clamp(pd.pan + dy, Math.min(0, layout.lotH - layout.contentH - 4), 0);
  });
  const up = (e) => {
    if (!pd) return; const d = pd; pd = null;
    if (d.moved) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const inb = (h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
    const hit = hits.find((h) => (h.type === 'fac' || h.type === 'upg') && inb(h)) || hits.find((h) => (h.type === 'pitch' || h.type === 'lot') && inb(h));
    if (hit) onTap?.(hit);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { pd = null; });

  return {
    resize, draw,
    select(id) { selected = id; },
    setHandlers(h) { onGoal = h.onGoal; onKick = h.onKick; onTap = h.onTap; },
    floatAt(pitchId, text, color = '#ffc83d', size = 18) {
      const r = screenRect.get(pitchId); if (!r) return;
      floats.push({ x: r.x + r.w / 2, y: r.y + r.h * 0.5, text, color, size, age: 0, life: 1.8 });
    },
    goalText(p) { this.floatAt(p.id, 'GOL!', '#fff', 24); },
    money(pitchId, state, amount) { this.floatAt(pitchId, '+' + formatMoney(amount), '#ffc83d', 17); },
    pitchCenter(pitchId) { const r = screenRect.get(pitchId); if (!r) return null; const b = canvas.getBoundingClientRect(); return { x: b.left + r.x + r.w / 2, y: b.top + r.y + r.h / 2 }; },
    pitchBox(pitchId) { const r = screenRect.get(pitchId); if (!r) return null; const b = canvas.getBoundingClientRect(); return { x: b.left + r.x, y: b.top + r.y, w: r.w, h: r.h }; },
  };
}
