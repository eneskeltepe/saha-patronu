// Saha Patronu prototipi: açılış, döngü, dokunma/kaydırma, olay -> efekt/ses bağlantısı, kayıt.
import { CFG, STATIONS, ORDER } from './config.js';
import { World, newSave, PITCHES, levelCost } from './sim.js';
import { G, W, H } from './layout.js';
import { cam, loadAtlas, render, toScreen, toWorld, clampCam, popText, burst, updParts, fx, buildings } from './render.js';
import * as UI from './ui.js';
import { sfx, vibrate, installUnlock, bindSettings, applySettings, setHidden, setNight } from './audio.js';
import { formatMoney } from './format.js';

const KEY = 'sahaPatronuProto.save';
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), SPEED = DEBUG ? +(Q.get('speed') || 10) : 1;

function load() { try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1 && o.st) { const base = newSave(); for (const id of ORDER) o.st[id] = { ...base.st[id], ...o.st[id] }; return { ...base, ...o, settings: { ...base.settings, ...o.settings } }; } } catch { /* bozuk kayıt: yeni oyun */ } return null; }
let resetting = false;
function save() { if (resetting) return; try { world.s.lastSeen = Date.now(); localStorage.setItem(KEY, JSON.stringify(world.s)); } catch { /* depolama yok: sorun değil */ } }

const cv = document.getElementById('cv'), g = cv.getContext('2d');
let dpr = 1, world, last = performance.now(), running = true;
let saved = load();
const fresh = !saved;
world = new World(saved || newSave(), onEvent);
if (DEBUG) { window.__game = { world, cam, save, STATIONS, fx, setMoney: (m) => { world.s.money = m; }, toScreen, G }; }

// ---------- boyut ----------
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = innerWidth, h = innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cam.vw = w; cam.vh = h;
  UI.resizeFx(w, h, dpr);
  clampCam();
}
addEventListener('resize', resize);

// ---------- olaylar ----------
function stationCenter(id) { const r = G[id].rect; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
function onScreen(x, y, m = 40) { const p = toScreen(x, y); return p.x > -m && p.y > -m && p.x < cam.vw + m && p.y < cam.vh + m; }
function onEvent(ev, d) {
  if (ev === 'goal') {
    const r = G[d.id].rect;
    if (onScreen(d.x, d.y, 100)) { sfx('goal'); popText(r.x + r.w / 2, r.y + r.h / 2, 'GOL!', { size: 46, color: '#ffe14d', stroke: '#c0392b', life: 1.6 }); burst(d.x, d.y, 30); fx.shake = 0.5; vibrate(30); }
    const pt = world.pitch[d.id]; for (const p of pt.players) if (p.side === (d.side ? 1 : 0)) p.c.jump = 0.35;
  } else if (ev === 'whistle') { if (onScreen(...Object.values(stationCenter(d.id)), 150)) sfx('whistle'); }
  else if (ev === 'final') { if (onScreen(...Object.values(stationCenter(d.id)), 150)) { sfx('whistle3'); const c = stationCenter(d.id); popText(c.x, c.y - 30, `${d.score[0]} - ${d.score[1]}`, { size: 30, stroke: '#2b3a42', life: 1.4 }); } }
  else if (ev === 'kick') { if (Math.random() < 0.35 && onScreen(...Object.values(stationCenter(d.id)), 0)) sfx('kick'); }
  else if (ev === 'milestone') {
    sfx('levelup'); vibrate([30, 40, 30]); UI.confettiRain(); fx.shake = 0.6;
    const c = stationCenter(d.id); popText(c.x, c.y, 'YENİ SEVİYE!', { size: 30, color: '#ffe14d', stroke: '#7a3b00', life: 2 });
    setTimeout(() => { UI.closeCard(); UI.milestoneModal(d.id, d.txt); }, 350);
  } else if (ev === 'build') {
    sfx('levelup'); vibrate(40); UI.confettiRain(); fx.shake = 0.7;
    const c = stationCenter(d.id); burst(c.x, c.y, 60); popText(c.x, c.y, 'AÇILDI!', { size: 40, color: '#ffe14d', stroke: '#2e7d32', life: 2.2 });
    panTo(c.x, c.y);
  } else if (ev === 'mgr') {
    const p = G[d.id].pile, s = toScreen(p.x, p.y);
    if (onScreen(p.x, p.y, 0)) UI.coinFly(s.x, s.y, 2, 0, () => { UI.bumpMoney(); });
  } else if (ev === 'goalReady') { sfx('pop'); UI.toast('Hedef tamam! Ödülünü al 💎', 'gold'); }
  else if (ev === 'goalDone') { if (d.last) setTimeout(() => { UI.confettiRain(); sfx('levelup'); UI.finalModal(); }, 600); }
}
let panAnim = null;
function panTo(x, y) { panAnim = { x0: cam.x, y0: cam.y, x, y, t: 0 }; }

// ---------- dokunma / kaydırma / yakınlaştırma ----------
const ptrs = new Map(); let drag = null, pinch = null;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, t: performance.now(), moved: 0 };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; drag = null; }
});
cv.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; cam.z = Math.max(0.45, Math.min(1.6, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); clampCam(); return; }
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy)); if (drag.moved > 8) { cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; clampCam(); panAnim = null; } }
});
const endPtr = (e) => {
  const wasTap = drag && drag.moved <= 8 && performance.now() - drag.t < 450 && ptrs.size === 1;
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (wasTap) tap(e.clientX, e.clientY);
  if (ptrs.size === 0) drag = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.z = Math.max(0.45, Math.min(1.6, cam.z * (e.deltaY < 0 ? 1.1 : 0.9))); clampCam(); }, { passive: false });

function tap(sx, sy) {
  const p = toWorld(sx, sy), s = world.s;
  // 1) para yığını
  for (const id of ORDER) {
    const st = s.st[id]; if (!st.built || st.pile <= 0) continue;
    const pp = G[id].pile;
    if (Math.hypot(p.x - pp.x, p.y - pp.y) < 30 / Math.min(1, cam.z) + 4) { collect(id); return; }
  }
  // 2) inşa alanı
  for (const id of ORDER) {
    if (s.st[id].built || !STATIONS[id].build) continue;
    const r = G[id].rect;
    if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) { sfx('tap'); UI.closeCard(); UI.buildModal(id, () => { if (!world.build(id)) sfx('error'); }); return; }
  }
  // 3) istasyon
  for (const id of ORDER) {
    if (!s.st[id].built) continue;
    const r = G[id].rect, m = 14, l = G[id].label;
    if ((p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m) || Math.hypot(p.x - l.x, p.y - l.y) < 40) { UI.openCard(id); focusCard(id); return; }
  }
  UI.closeCard();
}
function focusCard(id) {
  // kartın altında kalmasın: istasyonu ekranın üst yarısına kaydır
  const c = stationCenter(id), sp = toScreen(c.x, c.y);
  if (sp.y > cam.vh * 0.5 || sp.y < 80 || sp.x < 40 || sp.x > cam.vw - 40) panTo(c.x, c.y + (cam.vh * 0.18) / cam.z);
}
function collect(id) {
  const st = world.s.st[id], amt = world.collect(id);
  if (!amt) return;
  const pp = G[id].pile, sp = toScreen(pp.x, pp.y);
  const n = Math.max(3, Math.min(12, Math.round(Math.log2(amt + 1) * 1.4)));
  sfx('coin'); vibrate(12);
  popText(pp.x, pp.y - 20, '+' + formatMoney(amt), { size: 22, color: '#fff36b', stroke: '#5a3d00', life: 1, rise: 40 });
  UI.coinFly(sp.x, sp.y, n, amt / n, () => { sfx('coin'); UI.bumpMoney(); });
  if (world.s.tut === 0) world.s.tut = 1;
}
UI.initUI(world, {
  onUpgraded(id) { sfx('kaching'); vibrate(15); const c = stationCenter(id); burst(c.x, c.y - 20, 14, ['#ffd23f', '#fff', '#4cd964']); popText(c.x, c.y - 30, 'Sv ' + world.s.st[id].lvl, { size: 24, color: '#7dff8a', stroke: '#1b5e20', life: 0.9 }); if (world.s.tut === 1 && id === 'gise') world.s.tut = 2; },
  onSettings() { applySettings(); save(); },
  reset() { resetting = true; try { localStorage.removeItem(KEY); } catch { /* yok say */ } running = false; location.reload(); },
  instantCashAmount() { let r = 0; for (const id of ORDER) r += world.s.st[id].rate; return Math.max(500, Math.floor(r * 60 * CFG.instantCash.minutes)); },
  onModalClosed() {},
});
bindSettings(() => world.s.settings);
installUnlock();

// ---------- ipuçları ----------
function tutorial() {
  const s = world.s;
  if (UI.modalOpen()) { UI.hint(null); return; }
  if (s.tut === 0) {
    const id = ORDER.find((k) => s.st[k].built && s.st[k].pile > 0);
    if (!id) return UI.hint(null);
    const p = toScreen(G[id].pile.x, G[id].pile.y + 8); return UI.hint(p.x, p.y, 'Paraya dokun!');
  }
  if (s.tut === 1) {
    if (s.money < levelCost('gise', s.st.gise.lvl)) return UI.hint(null);
    if (UI.cardOpen() === 'gise') { const b = document.getElementById('upBtn')?.getBoundingClientRect(); if (b) return UI.hint(b.left + b.width / 2, b.bottom - 8, 'Kasayı yükselt!'); }
    const r = G.gise.rect, p = toScreen(r.x + r.w / 2, r.y + r.h - 10); return UI.hint(p.x, p.y, 'Kasaya dokun');
  }
  if (s.tut === 2) {
    if (s.st.gise.mgr) { s.tut = 3; return UI.hint(null); }
    if (s.money < STATIONS.gise.mgr) return UI.hint(null);
    const b = document.getElementById('bMgr').getBoundingClientRect(); return UI.hint(b.left + b.width / 2, b.top - 4, 'Yönetici al!', true);
  }
  UI.hint(null);
}

// ---------- döngü ----------
let saveT = 0, prevNight = null;
function frame(now) {
  if (!running) return;
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  const t0 = performance.now(); let sim = real * SPEED;
  while (sim > 0) { const d = Math.min(0.1, sim); world.update(d); sim -= d; }
  const t1 = performance.now(); updParts(real);
  for (const c of world.cust) if (c.jump) { c.jump = Math.max(0, c.jump - real * 0.6); }
  if (panAnim) { panAnim.t = Math.min(1, panAnim.t + real * 2.5); const e = 1 - Math.pow(1 - panAnim.t, 3); cam.x = panAnim.x0 + (panAnim.x - panAnim.x0) * e; cam.y = panAnim.y0 + (panAnim.y - panAnim.y0) * e; clampCam(); if (panAnim.t >= 1) panAnim = null; }
  render(g, cv.width, dpr, world, { dt: real });
  const t2 = performance.now(); UI.tickUI(real);
  if (DEBUG) { const pf = window.__game.perf ||= { u: 0, r: 0, ui: 0 }; pf.u = pf.u * 0.95 + (t1 - t0) * 0.05; pf.r = pf.r * 0.95 + (t2 - t1) * 0.05; pf.ui = pf.ui * 0.95 + (performance.now() - t2) * 0.05; }
  tutorial();
  const n = world.night(); if (n !== prevNight) { prevNight = n; setNight(n); }
  saveT += real; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); setHidden(true); }
  else { setHidden(false); last = performance.now(); checkOffline(); }
});
addEventListener('pagehide', save);

function checkOffline() {
  const sec = (Date.now() - (world.s.lastSeen || Date.now())) / 1000;
  if (sec < 60) return;
  const { amt, sec: t } = world.offlineEarnings(sec);
  world.s.lastSeen = Date.now();
  if (amt < 1) return;
  UI.offlineModal(amt, t, (a) => { world.s.money += a; sfx('kaching'); UI.coinFly(cam.vw / 2, cam.vh / 2, 14, 0, () => { sfx('coin'); UI.bumpMoney(); }); save(); });
}

(async function boot() {
  resize();
  try { await loadAtlas(); } catch (e) { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:40%;width:100%;text-align:center;color:#fff">Grafikler yüklenemedi</p>'); return; }
  // başlangıç kadrajı: gişe + saha
  const portrait = cam.vh > cam.vw;
  cam.z = portrait ? Math.min(1, cam.vw / 470) : Math.min(1.1, cam.vh / 560);
  cam.x = portrait ? 520 : 470; cam.y = portrait ? 430 : 400; clampCam();
  if (fresh) world.s.money = CFG.startMoney; else checkOffline();
  if (DEBUG && Q.get('money')) world.s.money = +Q.get('money');
  if (DEBUG && Q.get('day')) world.s.day = +Q.get('day');
  last = performance.now(); requestAnimationFrame(frame);
})();
