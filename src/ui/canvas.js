// Kuşbakışı halı saha çizimi: statik katman (önbellekli) + canlı oyuncular/top/efektler.
import { formatMoney, pitchName } from './format.js';

const CW = 128, CH = 80;               // hücre (sanal birim)
const FX = 14, FY = 11, FW = 100, FH = 58; // saha
const KITS = [['#f7c600', '#14285e'], ['#f7c600', '#d6232a'], ['#15151a', '#f4f4f4'], ['#7a1230', '#2a7fd6'], ['#1e9c4a', '#f4f4f4']];
const KEEPERS = ['#39d353', '#ff8a2b'];
const FORM = [[3, 29], [22, 17], [22, 41], [45, 10], [45, 29], [45, 48], [65, 29]];

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

function darkness(t) {
  if (t >= 20 || t < 5) return 1;
  if (t >= 17) return (t - 17) / 3;
  if (t < 8) return 1 - (t - 5) / 3;
  return 0;
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let rects = [];
  const statics = new Map();   // pitchId -> {key, cv}
  const sims = new Map();
  const floats = [];
  const rain = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
  let selected = null, onGoal = null, onKick = null, layoutKey = '';

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    layoutKey = ''; statics.clear();
  }

  function layout(n) {
    const key = `${n}|${W}|${H}`;
    if (key === layoutKey) return;
    layoutKey = key;
    let best = null;
    for (let cols = 1; cols <= Math.min(n, 4); cols++) {
      const rows = Math.ceil(n / cols);
      const s = Math.min((W - 8) / cols / CW, (H - 8) / rows / CH);
      if (!best || s > best.s) best = { cols, rows, s };
    }
    const { cols, rows, s } = best, w = CW * s, h = CH * s;
    const ox = (W - cols * w) / 2, oy = (H - rows * h) / 2;
    rects = Array.from({ length: n }, (_, i) => ({ x: ox + (i % cols) * w, y: oy + Math.floor(i / cols) * h, w, h, s }));
  }

  // ---------- statik katman ----------
  function drawStatic(g, p, v, state, idx, n, s) {
    const f = v.facilities || {}, u = p.upgrades || {};
    const R = rnd(hash(p.id));
    g.fillStyle = '#26394f'; rr(g, 0, 0, CW, CH, 5); g.fill();
    // zemin gölgesi / çevre
    g.fillStyle = '#1d2e43'; g.fillRect(FX - 5, FY - 5, FW + 10, FH + 10);
    // sentetik çim + biçme şeritleri
    const lush = u.turf || 0;
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? `hsl(${138 - lush * 1.5} 48% ${33 + lush * 0.7}%)` : `hsl(${138 - lush * 1.5} 46% ${29 + lush * 0.7}%)`;
      g.fillRect(FX + i * FW / 10, FY, FW / 10 + 0.2, FH);
    }
    // çim dokusu
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 140; i++) g.fillRect(FX + R() * FW, FY + R() * FH, 0.5, 0.5);
    // aşınma yamaları
    const worn = Math.floor((100 - (p.condition ?? 100)) / 7);
    for (let i = 0; i < worn; i++) {
      const gx = R() < 0.5 ? R() * 14 : 86 + R() * 14, x = R() < 0.35 ? FX + R() * FW : FX + gx, y = FY + 10 + R() * (FH - 20);
      g.fillStyle = `rgba(150,125,70,${0.18 + R() * 0.15})`;
      g.beginPath(); g.ellipse(x, y, 3 + R() * 4, 2 + R() * 3, R() * 3, 0, 7); g.fill();
    }
    // çizgiler
    g.strokeStyle = state.cosmetics?.lineColor && isHex(state.cosmetics.lineColor) ? state.cosmetics.lineColor : '#f2f6f2';
    g.globalAlpha = 0.9; g.lineWidth = 0.6;
    g.strokeRect(FX + 1.5, FY + 1.5, FW - 3, FH - 3);
    g.beginPath(); g.moveTo(FX + FW / 2, FY + 1.5); g.lineTo(FX + FW / 2, FY + FH - 1.5); g.stroke();
    g.beginPath(); g.arc(FX + FW / 2, FY + FH / 2, 8, 0, 7); g.stroke();
    g.strokeRect(FX + 1.5, FY + FH / 2 - 14, 14, 28); g.strokeRect(FX + FW - 15.5, FY + FH / 2 - 14, 14, 28);
    g.strokeRect(FX + 1.5, FY + FH / 2 - 7, 5, 14); g.strokeRect(FX + FW - 6.5, FY + FH / 2 - 7, 5, 14);
    g.globalAlpha = 1;
    // kaleler + file
    for (const side of [0, 1]) {
      const gx = side ? FX + FW - 0.5 : FX - 3.5;
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(gx, FY + FH / 2 - 5, 4, 10);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.25;
      for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(gx + k, FY + FH / 2 - 5); g.lineTo(gx + k, FY + FH / 2 + 5); g.stroke(); }
      for (let k = 0; k <= 5; k++) { g.beginPath(); g.moveTo(gx, FY + FH / 2 - 5 + k * 2); g.lineTo(gx + 4, FY + FH / 2 - 5 + k * 2); g.stroke(); }
      g.strokeStyle = '#fff'; g.lineWidth = 0.7; g.strokeRect(gx, FY + FH / 2 - 5, 4, 10);
    }
    // yüksek çit / yeşil file
    const fx0 = FX - 3, fy0 = FY - 3, fw = FW + 6, fh = FH + 6;
    g.strokeStyle = 'rgba(16,58,34,0.8)'; g.lineWidth = 2.4; g.strokeRect(fx0, fy0, fw, fh);
    g.strokeStyle = 'rgba(160,230,180,0.18)'; g.lineWidth = 0.3;
    for (let x = fx0; x <= fx0 + fw; x += 1.6) { g.beginPath(); g.moveTo(x, fy0 - 1); g.lineTo(x, fy0 + 1); g.moveTo(x, fy0 + fh - 1); g.lineTo(x, fy0 + fh + 1); g.stroke(); }
    for (let y = fy0; y <= fy0 + fh; y += 1.6) { g.beginPath(); g.moveTo(fx0 - 1, y); g.lineTo(fx0 + 1, y); g.moveTo(fx0 + fw - 1, y); g.lineTo(fx0 + fw + 1, y); g.stroke(); }
    g.fillStyle = '#6b7b8e';
    for (let x = fx0; x <= fx0 + fw + 0.1; x += fw / 8) { g.fillRect(x - 0.5, fy0 - 1, 1, 1.6); g.fillRect(x - 0.5, fy0 + fh - 0.6, 1, 1.6); }
    for (let y = fy0; y <= fy0 + fh + 0.1; y += fh / 5) { g.fillRect(fx0 - 1, y - 0.5, 1.6, 1); g.fillRect(fx0 + fw - 0.6, y - 0.5, 1.6, 1); }
    // tribün
    if (u.stands > 0) {
      const rows = Math.min(3, 1 + Math.floor(u.stands / 4));
      for (let r = 0; r < rows; r++) {
        g.fillStyle = r % 2 ? '#8795a8' : '#a3afbf'; g.fillRect(FX - 2, 1 + r * 2, FW + 4, 2);
        for (let i = 0; i < 12 + u.stands * 3; i++) {
          g.fillStyle = ['#f7c600', '#d6232a', '#14285e', '#fff', '#2a7fd6'][Math.floor(R() * 5)];
          g.fillRect(FX + R() * (FW - 1), 1.3 + r * 2, 1, 1.2);
        }
      }
    }
    // direkler (aydınlatma)
    if (u.lights > 0) {
      for (const [x, y] of [[fx0, fy0], [fx0 + fw, fy0], [fx0, fy0 + fh], [fx0 + fw, fy0 + fh]]) {
        g.fillStyle = '#56657a'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
        g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill();
      }
    }
    // çay ocağı / kantin
    if (idx === 0 && f.cafe > 0) {
      g.fillStyle = '#7a4a2b'; g.fillRect(1.5, 50, 9, 10);
      g.fillStyle = '#c9362d'; g.fillRect(0.5, 48.5, 11, 4.5);
      g.fillStyle = '#e8584d'; g.fillRect(0.5, 48.5, 11, 1.5);
      g.fillStyle = '#ffd77a'; g.fillRect(3, 55, 6, 2.6);
      g.fillStyle = '#fff'; g.fillRect(4.2, 53.4, 3.6, 1.2);
      if (f.cafe >= 4) { g.fillStyle = '#2a7fd6'; g.fillRect(1, 61, 10, 2); }
      g.fillStyle = '#e8d9b8'; g.beginPath(); g.arc(3.5, 66, 1.3, 0, 7); g.arc(8.5, 66, 1.3, 0, 7); g.fill();
    }
    if (idx === 0 && f.rental > 0) { g.fillStyle = '#2a7fd6'; g.fillRect(1.5, 38, 9, 7); g.fillStyle = '#9fd0ff'; g.fillRect(2.5, 40, 7, 1); g.fillRect(2.5, 42.5, 7, 1); }
    if (idx === 0 && f.camera > 0) { g.fillStyle = '#222'; g.fillRect(fx0 + fw + 1.5, fy0 + 3, 4, 3); g.fillStyle = '#ff4040'; g.beginPath(); g.arc(fx0 + fw + 5, fy0 + 4.5, 0.7, 0, 7); g.fill(); }
    // otopark
    const pIdx = n > 1 ? 1 : 0;
    if (idx === pIdx && f.parking > 0) {
      g.fillStyle = '#1b2735'; g.fillRect(119, 12, 8.5, 56);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.35;
      const cars = Math.min(6, 1 + Math.floor(f.parking / 2));
      for (let i = 0; i < 7; i++) {
        const y = 14 + i * 7.5;
        g.beginPath(); g.moveTo(119, y); g.lineTo(127.5, y); g.stroke();
        if (i < cars) { g.fillStyle = ['#d6232a', '#e8e8e8', '#2a7fd6', '#f7c600', '#222', '#1e9c4a'][i]; g.fillRect(120.5, y + 1.2, 6, 4.8); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(122, y + 2, 3, 2.6); }
      }
    }
    // kapalı çatı (balon saha)
    if (u.roof > 0) {
      g.fillStyle = 'rgba(210,228,245,0.2)'; g.fillRect(fx0, fy0, fw, fh);
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.4;
      for (let x = fx0 + 8; x < fx0 + fw; x += 11) { g.beginPath(); g.moveTo(x, fy0); g.lineTo(x, fy0 + fh); g.stroke(); }
      g.strokeStyle = 'rgba(235,245,255,0.7)'; g.lineWidth = 1; g.strokeRect(fx0, fy0, fw, fh);
    }
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function staticFor(p, v, state, idx, n, rect) {
    const f = v.facilities || {};
    const key = [p.id, JSON.stringify(p.upgrades), Math.floor((p.condition ?? 100) / 7), idx === 0 ? f.cafe + '' + f.rental + f.camera : '', idx === (n > 1 ? 1 : 0) ? f.parking : '', state.cosmetics?.lineColor, Math.round(rect.w)].join('|');
    let e = statics.get(p.id);
    if (!e || e.key !== key) {
      const cv = e?.cv || document.createElement('canvas');
      cv.width = Math.ceil(rect.w * dpr); cv.height = Math.ceil(rect.h * dpr);
      const g = cv.getContext('2d'); g.scale(cv.width / CW, cv.height / CH);
      drawStatic(g, p, v, state, idx, n, rect.s);
      e = { key, cv }; statics.set(p.id, e);
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
      return { team, i, gk: i === 0, hx: x, hy, x, y: hy, vx: 0, vy: 0, a: team ? Math.PI : 0 };
    }));
    return { key: p.match.startHour, players, ball: { x: 50, y: 29 }, owner: 4, mode: 'own', decide: 0.3, score: [0, 0], fl: null, cel: null, flash: { side: 0, t: 0 }, kits: [kitFor(p.match, 0), kitFor(p.match, 1)] };
  }
  const nearest = (sim, team, x, y, noGk = true) => { let b = null, bd = 1e9; for (const q of sim.players) { if (q.team !== team || (noGk && q.gk)) continue; const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; b = q; } } return b; };
  const idxOf = (sim, q) => q.team * 7 + q.i;

  function stepSim(sim, dt, p) {
    sim.t = (sim.t || 0) + dt;
    const own = sim.players[sim.owner], b = sim.ball;
    if (sim.mode === 'own') {
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
        } else sim.decide = 0.25;
        if (sim.mode === 'own') sim.decide = 0.25; else sim.decide = 0.4 + Math.random() * 0.3;
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
          else {
            sim.score[f.T]++; sim.mode = 'goal'; sim.cel = { T: f.T, t: 1.8, who: nearest(sim, f.T, f.tx, 29) }; sim.flash = { side: f.T ? 0 : 1, t: 1 };
            onGoal?.(p, f.T, sim.score);
          }
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
      if (sim.mode === 'goal') {
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
      q.x = clamp(q.x + q.vx * dt, 1, 99); q.y = clamp(q.y + q.vy * dt, 1.5, 56.5);
      if (Math.hypot(q.vx, q.vy) > 0.5) q.a = Math.atan2(q.vy, q.vx);
    }
  }

  function drawPlayer(g, q, sim, jump) {
    const kit = q.gk ? [KEEPERS[q.team], '#222'] : sim.kits[q.team];
    const x = FX + q.x, y = FY + q.y - jump;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(FX + q.x, FY + q.y + 0.6, 2, 1.3, 0, 0, 7); g.fill();
    g.save(); g.translate(x, y); g.rotate(q.a);
    g.fillStyle = kit[0]; g.beginPath(); g.ellipse(0, 0, 2.1, 3.1, 0, 0, 7); g.fill();
    g.fillStyle = kit[1]; g.fillRect(-0.5, -2.9, 1.1, 5.8);
    g.fillStyle = '#e2b48f'; g.beginPath(); g.arc(0.6, 0, 1.4, 0, 7); g.fill();
    g.restore();
  }

  // ---------- ana çizim ----------
  function draw(state, dtReal, clock, nowS) {
    if (!W) return;
    const v = state.venues.find((x) => x.id === state.activeVenueId) || state.venues[0];
    if (!v) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#15263d'); bg.addColorStop(1, '#0f1b2d');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    layout(v.pitches.length);
    const t = clock.hour + (clock.minute || 0) / 60, dk = darkness(t), sp = state.time?.speed || 1;
    const dt = Math.min(dtReal, 0.05) * sp;
    const roofRects = [];
    v.pitches.forEach((p, i) => {
      const r = rects[i]; if (!r) return;
      const s = r.s, lit = (p.upgrades?.lights || 0) > 0;
      c.save(); c.translate(r.x, r.y);
      c.drawImage(staticFor(p, v, state, i, v.pitches.length, r), 0, 0, r.w, r.h);
      c.scale(s, s);
      c.beginPath(); c.rect(0, 0, CW, CH); c.clip();
      // maç
      let sim = sims.get(p.id);
      if (p.match) {
        if (!sim || sim.key !== p.match.startHour) { sim = newSim(p); sims.set(p.id, sim); }
        stepSim(sim, dt, p);
        const order = sim.players.map((q, k) => [q, k]).sort((a, b) => a[0].y - b[0].y);
        for (const [q] of order) {
          const jump = sim.mode === 'goal' && sim.cel && q.team === sim.cel.T && !q.gk ? Math.abs(Math.sin(sim.t * 11 + q.i)) * 2 : 0;
          drawPlayer(c, q, sim, jump);
        }
        const bx = FX + sim.ball.x, by = FY + sim.ball.y;
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(bx, by + 0.8, 1.1, 0.6, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 0.3; c.beginPath(); c.arc(bx, by - (sim.mode === 'flight' ? 1 : 0), 1.4, 0, 7); c.fill(); c.stroke();
        if (sim.flash.t > 0) { c.fillStyle = `rgba(255,255,255,${sim.flash.t * 0.5})`; c.fillRect(sim.flash.side ? FX + FW - 1 : FX - 3.5, FY + FH / 2 - 6, 5, 12); }
        if (p.match.kind === 'tournament') { c.strokeStyle = 'rgba(255,200,61,.9)'; c.lineWidth = 0.9; c.strokeRect(FX - 4.5, FY - 4.5, FW + 9, FH + 9); }
      } else if (sim) sims.delete(p.id);
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
      if ((p.upgrades?.roof || 0) > 0) roofRects.push(r);
      c.restore();
      if (selected === p.id && v.pitches.length > 1) { c.strokeStyle = '#3ddc84'; c.lineWidth = 2; c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
      label(p, sim, r, state, t);
    });
    // yağmur
    if (state.weather?.kind === 'rain') {
      c.save();
      if (roofRects.length) { c.beginPath(); c.rect(0, 0, W, H); roofRects.forEach((r) => c.rect(r.x + r.w * 0.1, r.y + r.h * 0.1, r.w * 0.8, r.h * 0.8)); c.clip('evenodd'); }
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

  function label(p, sim, r, state, t) {
    let txt, col = '#cfe0f5';
    const gh = state.time?.gameHours ?? 0;
    if (p.match) { txt = p.match.kind === 'tournament' ? 'TURNUVA' : `${sim?.score[0] ?? 0} - ${sim?.score[1] ?? 0}`; col = p.match.kind === 'tournament' ? '#ffc83d' : '#fff'; }
    else if (p.blockedUntilHour > gh) { txt = 'Kapalı'; col = '#ffb86b'; }
    else if (t >= 2 && t < 9) { txt = 'Kapalı · 09:00'; col = '#8ea3bf'; }
    else if (!(p.upgrades?.lights > 0) && (t >= 18 || t < 2)) { txt = 'Işık yok'; col = '#ffb86b'; }
    else { txt = 'Boş'; col = '#8ea3bf'; }
    const fs = clamp(r.s * 6.2, 8.5, 13);
    c.font = `700 ${fs}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
    const name = pitchName(p), w1 = c.measureText(name).width, w2 = c.measureText(txt).width;
    const px = r.x + r.s * 15, py = r.y + r.h - r.s * 3.2, h = fs + 4;
    c.fillStyle = 'rgba(8,16,30,0.72)'; rr(c, px - 4, py - h / 2, w1 + w2 + 20, h, h / 2); c.fill();
    c.fillStyle = '#fff'; c.fillText(name, px, py);
    c.fillStyle = col; c.fillText(txt, px + w1 + 10, py);
    c.textBaseline = 'alphabetic';
  }

  return {
    resize, draw,
    select(id) { selected = id; },
    setHandlers(h) { onGoal = h.onGoal; onKick = h.onKick; },
    pitchAt(x, y, state) {
      const v = state.venues.find((q) => q.id === state.activeVenueId);
      const i = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      return i >= 0 ? v?.pitches[i]?.id : null;
    },
    floatAt(pitchId, state, text, color = '#ffc83d', size = 18) {
      const v = state.venues.find((q) => q.id === state.activeVenueId); const i = v?.pitches.findIndex((p) => p.id === pitchId);
      const r = rects[i]; if (!r) return;
      floats.push({ x: r.x + r.w / 2, y: r.y + r.h * 0.5, text, color, size, age: 0, life: 1.8 });
    },
    goalText(p, state) { this.floatAt(p.id, state, 'GOL!', '#fff', 22); },
    money(pitchId, state, amount) { this.floatAt(pitchId, state, '+' + formatMoney(amount), '#ffc83d', 17); },
  };
}
