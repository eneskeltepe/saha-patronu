// Canvas çizimi: kamera, önceden çizilmiş zemin katmanı, dünya, gece ışıkları, ekran-uzayı etiketleri.
import { G, W, H, ROAD, WALK_Y, FENCE_Y, SPINE, SPX, LAMPS, TREES } from './layout.js';
import { STATIONS, ORDER, CFG } from './config.js';
import { stats, darkness, levelCost, PITCHES } from './sim.js';
import * as A from './art.js';
import { formatMoney } from './format.js';

const BG = 1.5;
export const cam = { x: 560, y: 470, z: 0.8, vw: 390, vh: 844 };
let atlas = null, frames = null, bgCv = null, bgKey = '';
export const fx = { parts: [], texts: [], flies: [], confetti: [], pops: [], shake: 0 };

export async function loadAtlas() {
  const [img, json] = await Promise.all([
    new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'assets/atlas.png'; }),
    fetch('assets/atlas.json').then((r) => r.json()),
  ]);
  atlas = img; frames = json;
}
export function spr(g, name, x, y, w, h, ang = 0, alpha = 1) {
  const f = frames[name]; if (!f) return;
  if (!w) { w = f[2]; h = f[3]; }
  g.save(); g.translate(x, y); if (ang) g.rotate(ang); if (alpha !== 1) g.globalAlpha *= alpha;
  g.drawImage(atlas, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); g.restore();
}
export const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + cam.vw / 2, y: (y - cam.y) * cam.z + cam.vh / 2 });
export const toWorld = (x, y) => ({ x: (x - cam.vw / 2) / cam.z + cam.x, y: (y - cam.vh / 2) / cam.z + cam.y });
export const minZoom = () => Math.max(0.45, cam.vw / W, cam.vh / (H + 40));
export function clampCam() {
  cam.z = Math.max(minZoom(), Math.min(1.6, cam.z));
  const hw = cam.vw / 2 / cam.z, hh = cam.vh / 2 / cam.z;
  cam.x = Math.max(hw, Math.min(W - hw, cam.x));
  cam.y = Math.max(hh - 40, Math.min(H - hh, cam.y));
}

// ---------- zemin katmanı ----------
function seeded(n) { let s = n; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function buildBg(s) {
  const cv = document.createElement('canvas'); cv.width = W * BG; cv.height = H * BG;
  const g = cv.getContext('2d'); g.scale(BG, BG); g.lineJoin = g.lineCap = 'round';
  const r = seeded(7), st = s.st;
  // çim + desen
  g.fillStyle = A.PAL.grass; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const x = r() * W, y = FENCE_Y + r() * (H - FENCE_Y); A.rr(g, x, y, 30 + r() * 60, 18 + r() * 30, 16); g.fillStyle = 'rgba(30,140,80,0.22)'; g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) { const x = r() * W, y = FENCE_Y + r() * (H - FENCE_Y); g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x, y - 4); g.lineTo(x + 3, y); g.stroke(); }
  // yol
  g.fillStyle = A.PAL.roadLt; g.fillRect(0, ROAD.y0, W, ROAD.y1);
  g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, ROAD.y0 + 6, W, 4); g.fillRect(0, ROAD.y1 - 12, W, 4);
  g.fillStyle = '#fff'; for (let x = 10; x < W; x += 48) { A.rr(g, x, 63, 26, 5, 2.5); g.fill(); }
  // kaldırım + bordür
  g.fillStyle = A.PAL.walk; g.fillRect(0, ROAD.y1, W, FENCE_Y - ROAD.y1);
  g.fillStyle = '#eef3f4'; g.fillRect(0, ROAD.y1, W, 5);
  g.strokeStyle = A.PAL.walkDk; g.lineWidth = 1;
  for (let x = 0; x < W; x += 26) { g.beginPath(); g.moveTo(x, ROAD.y1 + 5); g.lineTo(x, FENCE_Y); g.stroke(); }
  // yürüme yolu (omurga) + kollar
  const path = (x, y, w, h) => { A.rr(g, x - 3, y - 3, w + 6, h + 6, 10); g.fillStyle = A.PAL.sandDk; g.fill(); A.rr(g, x, y, w, h, 8); g.fillStyle = A.PAL.sand; g.fill(); };
  path(SPINE.x0, FENCE_Y - 6, SPINE.x1 - SPINE.x0, H - FENCE_Y - 30);
  const doorBranch = (id, y, x0, x1) => { if (st[id].built) path(Math.min(x0, x1), y - 20, Math.abs(x1 - x0), 40); };
  doorBranch('soyunma', 405, 296, SPINE.x0 + 6); doorBranch('dus', 554, 284, SPINE.x0 + 6); doorBranch('bufe', 1009, 296, SPINE.x0 + 6);
  if (st.cay.built) { path(196, 676, SPINE.x0 - 190, 56); path(206, 760, 156, 170); if (stats('cay', st.cay.lvl).stage >= 2) path(44, 800, 170, 130); }
  for (const id of PITCHES) if (st[id].built) path(SPINE.x1 - 6, G[id].gate.y - 22, 34, 44);
  // dekor: taş yol karoları
  g.strokeStyle = 'rgba(160,120,60,0.18)'; g.lineWidth = 1;
  for (let y = FENCE_Y + 10; y < H - 40; y += 22) { g.beginPath(); g.moveTo(SPINE.x0 + 6, y); g.lineTo(SPINE.x1 - 6, y); g.stroke(); }
  // otopark
  if (st.otopark.built) {
    const o = G.otopark.rect;
    A.rr(g, o.x - 3, o.y - 3, o.w + 6, o.h + 6, 12); g.fillStyle = '#7e8f98'; g.fill();
    A.rr(g, o.x, o.y, o.w, o.h, 10); g.fillStyle = A.PAL.roadLt; g.fill();
    g.fillStyle = A.PAL.roadLt; g.fillRect(G.otopark.entryX - 22, ROAD.y1 - 2, 44, FENCE_Y - ROAD.y1 + 20);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { const x = 38 + i * 68; g.beginPath(); g.moveTo(x, 222); g.lineTo(x, 304); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `900 22px ${A.FONT}`; g.textAlign = 'center'; g.fillText('P', 330, 300);
  }
  // sahalar
  for (const id of PITCHES) if (st[id].built) drawPitchBase(g, id, stats(id, st[id].lvl).stage);
  // çit (kaldırım ile tesis arası)
  const fence = (x0, x1) => {
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, FENCE_Y + 3); g.lineTo(x1, FENCE_Y + 3); g.stroke();
    g.strokeStyle = '#f2f2ee'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, FENCE_Y); g.lineTo(x1, FENCE_Y); g.stroke();
    for (let x = x0; x <= x1; x += 26) { g.beginPath(); g.arc(x, FENCE_Y, 4, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#b9c2c6'; g.stroke(); }
  };
  fence(st.otopark.built ? 64 : 0, SPINE.x0 - 4); fence(SPINE.x1 + 4, W);
  // kapı direkleri
  for (const x of [SPINE.x0 - 4, SPINE.x1 + 4]) { A.box(g, x - 8, FENCE_Y - 10, 16, 20, 4, PAL2.post, PAL2.postDk, 2); }
  // ağaçlar + dekor
  for (const [x, y, k] of TREES) { const n = k === 'l' ? 'tree_large' : 'tree_small', sz = k === 'l' ? 96 : 66; g.save(); g.globalAlpha = 0.2; g.beginPath(); g.arc(x + 6, y + 9, sz * 0.45, 0, 7); g.fillStyle = '#000'; g.fill(); g.restore(); spr(g, n, x, y, sz, sz, r() * 6); }
  // çalılar + çiçek tarhları (omurga kenarı ve boşluklar)
  const bush = (x, y, s = 30) => { g.save(); g.globalAlpha = 0.2; g.beginPath(); g.arc(x + 3, y + 4, s * 0.42, 0, 7); g.fillStyle = '#000'; g.fill(); g.restore(); spr(g, 'tree_small', x, y, s, s, r() * 6); };
  const flowers = (x, y) => { for (let i = 0; i < 7; i++) { const a = r() * 7, d = r() * 12; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 3, 0, 7); g.fillStyle = ['#ff6b81', '#ffd23f', '#fff', '#b388ff'][i % 4]; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.15)'; g.stroke(); } };
  for (const [x, y] of [[352, 300], [352, 490], [352, 620], [352, 930], [352, 1100], [352, 1270], [488, 270], [610, 200], [650, 214], [700, 196], [770, 210], [482, 800], [482, 1360], [20, 200], [345, 1210]]) {
    if (x < 360 && st.otopark.built && y < 330) continue;
    bush(x, y, 26 + r() * 10); flowers(x + 16, y + 14);
  }
  // giriş tabelası
  { const cx = (SPINE.x0 + SPINE.x1) / 2; A.box(g, cx - 66, FENCE_Y - 26, 132, 8, 3, '#7d5a3c', '#4e3523', 1.5); A.sign(g, cx, FENCE_Y - 30, 132, 24, 'MAHALLE SAHASI', '#2e9e44', '#fff', 13); }
  spr(g, 'rock1', 350, 1380, 36, 30); spr(g, 'rock2', 20, 1100, 30, 28); spr(g, 'tires_white', 470, 1395, 28, 28);
  if (st.otopark.built) { spr(g, 'cone_straight', 26, 312, 18, 18); spr(g, 'cone_straight', 340, 176, 18, 18); }
  return cv;
}
const PAL2 = { post: '#e8574a', postDk: '#b83d33' };
function drawPitchBase(g, id, stage) {
  const r = G[id].rect;
  // çevre (pist) + file çit
  A.rr(g, r.x - 10, r.y - 16, r.w + 20, r.h + 32, 14); g.fillStyle = stage >= 1 ? '#2a9d5c' : '#a77d3e'; g.fill();
  if (stage === 0) {
    A.rr(g, r.x, r.y, r.w, r.h, 6); g.fillStyle = A.PAL.dirt; g.fill();
    const rr = seeded(id.length * 31);
    for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(r.x + 10 + rr() * (r.w - 20), r.y + 10 + rr() * (r.h - 20), 6 + rr() * 16, 4 + rr() * 8, rr() * 3, 0, 7); g.fillStyle = 'rgba(150,100,40,0.25)'; g.fill(); }
    for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(r.x + rr() * r.w, r.y + rr() * r.h, 1.5, 0, 7); g.fillStyle = 'rgba(90,60,20,0.35)'; g.fill(); }
  } else {
    const n = 10; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? A.PAL.pitchB : A.PAL.pitchA; g.fillRect(r.x, r.y + (r.h / n) * i, r.w, r.h / n + 0.5); }
  }
  // çizgiler
  g.strokeStyle = stage === 0 ? 'rgba(255,255,255,0.7)' : '#fff'; g.lineWidth = 3;
  const m = 10, x0 = r.x + m, y0 = r.y + m, w = r.w - 2 * m, h = r.h - 2 * m, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  g.strokeRect(x0, y0, w, h);
  g.beginPath(); g.moveTo(x0, cy); g.lineTo(x0 + w, cy); g.stroke();
  g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.stroke();
  g.beginPath(); g.arc(cx, cy, 3.5, 0, 7); g.fillStyle = '#fff'; g.fill();
  for (const s of [0, 1]) {
    const yb = s ? y0 + h : y0, d = s ? -1 : 1;
    g.strokeRect(cx - 70, s ? yb - 64 : yb, 140, 64);
    g.beginPath(); g.arc(cx, yb + d * 48, 3, 0, 7); g.fill();
    g.beginPath(); g.arc(cx, yb + d * 64, 26, s ? Math.PI : 0, s ? 2 * Math.PI : Math.PI); g.stroke();
  }
  // köşe yayları
  for (const [x, y, a] of [[x0, y0, 0], [x0 + w, y0, Math.PI / 2], [x0 + w, y0 + h, Math.PI], [x0, y0 + h, -Math.PI / 2]]) { g.beginPath(); g.arc(x, y, 9, a, a + Math.PI / 2); g.stroke(); }
  // file çit
  g.strokeStyle = 'rgba(20,50,35,0.55)'; g.lineWidth = 2.5; A.rr(g, r.x - 6, r.y - 12, r.w + 12, r.h + 24, 10); g.stroke();
  for (let x = r.x - 6; x <= r.x + r.w + 6; x += 37) for (const y of [r.y - 12, r.y + r.h + 12]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fillStyle = '#37474f'; g.fill(); }
  // yedek kulübesi bankı
  const b = A.bench(Math.min(300, r.h - 160)); g.drawImage(b.cv, r.x - 26, r.y + 10, b.w, b.h);
  // tribün
  if (stage >= 3) { const ty = r.y + r.h + 18; spr(g, 'tribune_full', r.x + r.w / 2 + 20, ty + 46, 210, 104); spr(g, 'tribune_overhang_striped', r.x + r.w / 2 + 20, ty + 6, 214, 30); }
}
function bgSig(s) { return ORDER.map((id) => (s.st[id].built ? 1 : 0) + ':' + (s.st[id].built ? stats(id, s.st[id].lvl).stage : 0)).join(','); }

// ---------- ana çizim ----------
let steam = [], tNow = 0;
export function render(g, w, dpr, world, ui) {
  const s = world.s; tNow += ui.dt;
  const sig = bgSig(s); if (sig !== bgKey) { bgKey = sig; bgCv = buildBg(s); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#27ad60'; g.fillRect(0, 0, cam.vw, cam.vh);
  const sh = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 8 : 0; fx.shake = Math.max(0, fx.shake - ui.dt * 2);
  g.save();
  g.translate(cam.vw / 2 + sh, cam.vh / 2 + sh); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(bgCv, 0, 0, W, H);
  // trafik
  for (const t of world.traffic) carSprite(g, t);
  for (const c of world.cars) carSprite(g, c);
  // saha kaleleri + top
  for (const id of PITCHES) if (s.st[id].built) drawGoals(g, id, world.pitch[id]);
  // çay masaları
  const cst = stats('cay', s.st.cay.lvl);
  if (s.st.cay.built) G.cay.tables.forEach((t) => { if (t.tier === 0 || cst.stage >= 2) { const im = A.table(); g.drawImage(im.cv, t.x - 30, t.y - 20, 60, 40); } });
  // bina tabanları
  const bases = buildings(s);
  for (const b of bases) if (b.base) g.drawImage(b.base.cv, b.x, b.y, b.base.w, b.base.h);
  // kasiyerler
  if (s.st.gise.built) { const cap = Math.min(3, stats('gise', s.st.gise.lvl).cap); for (let i = 0; i < cap; i++) person(g, G.gise.rect.x + 26, G.gise.svc[i].y, 'brown', 'white', Math.PI, 0, 'cap'); }
  // insanlar
  for (const c of world.cust) if (!c.hidden) person(g, c.x, c.y, c.hair, c.kit, c.ang, c.st === 'play' ? (c.running ? 1 : 0.3) : (c.path.length ? 1 : 0), null, c);
  for (const wk of world.workers) {
    person(g, wk.x, wk.y, wk.hair, wk.kit, wk.ang || 0, wk.path.length ? 1 : 0, wk.kind === 'caycı' ? 'apron' : 'vest');
    if (wk.kind === 'caycı' && wk.tray) { const im = A.cached('trayI', 24, 24, (gg) => A.tray(gg, 12, 12, 3)); g.drawImage(im.cv, wk.x - 2, wk.y - 18, 24, 24); }
    if (wk.sweeping) { g.save(); g.translate(wk.x, wk.y); g.rotate((wk.ang || 0) + Math.sin(tNow * 10) * 0.5); g.fillStyle = '#8d6e63'; g.fillRect(8, -1.5, 14, 3); g.fillStyle = '#ffca28'; A.rr(g, 20, -6, 6, 12, 2); g.fill(); g.restore(); }
  }
  // yöneticiler
  for (const id of ORDER) if (s.st[id].built && s.st[id].mgr) { const p = mgrPos(id); person(g, p.x, p.y, 'black', 'purple', Math.PI / 2, 0, 'tie'); }
  // toplar
  for (const id of PITCHES) { const pt = world.pitch[id]; if (pt.ball) { const b = pt.ball; g.beginPath(); g.ellipse(b.x + 2, b.y + 3, 5, 3.5, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill(); spr(g, 'ball_soccer2', b.x, b.y, 10, 10, b.spin); } }
  // üst katmanlar (tente, şemsiye)
  for (const b of bases) if (b.top) g.drawImage(b.top.cv, b.tx, b.ty, b.top.w, b.top.h);
  if (s.st.cay.built && cst.stage >= 2) G.cay.tables.forEach((t, i) => spr(g, i % 2 ? 'tent_blue' : 'tent_red', t.x, t.y - 4, 34, 34, 0.785, 0.92));
  // projektör direkleri / lambalar
  for (const id of PITCHES) if (s.st[id].built && stats(id, s.st[id].lvl).lights) for (const p of floodPts(id)) { const im = A.floodPole(); g.drawImage(im.cv, p.x - 15, p.y - 15, 30, 30); }
  for (const l of LAMPS) { const im = A.lamp(); g.drawImage(im.cv, l.x - 11, l.y - 11, 22, 22); }
  // duman / buhar
  updSteam(g, s, ui.dt);
  // para yığınları
  for (const id of ORDER) if (s.st[id].built && s.st[id].pile > 0) drawPile(g, id, s.st[id].pile, stats(id, s.st[id].lvl).profit);
  // dünya-uzayı efektler (konfeti parçaları vb.)
  for (const p of fx.parts) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  g.restore();
  // gece
  const dk = darkness(s.day);
  if (dk > 0.01) drawNight(g, world, dk);
  // ekran-uzayı: rozetler, inşa alanları, baloncuklar, yazılar
  drawPlots(g, world);
  drawBadges(g, world, ui);
  drawBubbles(g, world);
  drawTexts(g, ui.dt);
}
function carSprite(g, c) {
  const f = frames[c.sprite]; if (!f) return;
  const w = f[2] * 0.42, h = f[3] * 0.42;
  g.save(); g.translate(c.x + 3, c.y + 4); g.rotate(c.ang + Math.PI / 2); g.globalAlpha = 0.22; A.rr(g, -w / 2, -h / 2, w, h, 8); g.fillStyle = '#000'; g.fill(); g.restore();
  spr(g, c.sprite, c.x, c.y, w, h, c.ang + Math.PI / 2);
}
function person(g, x, y, hair, kit, ang, moving, extra, c) {
  const k = moving ? Math.sin(tNow * 14 + (c ? c.id : x)) : 0;
  g.beginPath(); g.ellipse(x + 2, y + 3, 13, 9, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fill();
  const name = `character_${hair}_${kit}`;
  const sc = c && c.jump ? 1 + c.jump : 1;
  spr(g, name, x, y, 36 * sc, 25 * sc, ang + Math.PI / 2 + k * 0.12);
  if (extra === 'cap') { g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fillStyle = '#e8574a'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#a33'; g.stroke(); }
  else if (extra === 'apron') { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#999'; g.stroke(); }
  else if (extra === 'tie') { g.beginPath(); g.arc(x + 0, y - 15, 5, 0, 7); g.fillStyle = A.PAL.gold; g.fill(); g.lineWidth = 1.2; g.strokeStyle = A.PAL.goldDk; g.stroke(); g.fillStyle = '#7a4a00'; g.font = `900 7px ${A.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', x, y - 14.5); }
}
export function buildings(s) {
  const out = [];
  const add = (id, fn) => { if (!s.st[id].built) return; const r = G[id].rect, st = stats(id, s.st[id].lvl).stage; const b = fn(Math.min(3, st)); out.push({ id, base: b.base, top: b.top, x: r.x, y: r.y, tx: r.x - 4, ty: r.y }); };
  add('gise', (st) => A.gise(st)); add('soyunma', (st) => A.soyunma(st)); add('dus', (st) => A.dus(st));
  add('cay', (st) => A.cay(Math.min(2, st)));
  add('bufe', (st) => A.bufe(st, 206, 100, overhangCanvas()));
  return out;
}
let ohc = null;
function overhangCanvas() {
  if (ohc) return ohc; const f = frames.tribune_overhang_striped; ohc = document.createElement('canvas'); ohc.width = f[2]; ohc.height = f[3];
  ohc.getContext('2d').drawImage(atlas, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); return ohc;
}
export function mgrPos(id) {
  const r = G[id].rect;
  if (id === 'otopark') return { x: r.x + r.w - 20, y: r.y + 30 };
  if (id === 'saha1' || id === 'saha2') return { x: r.x + r.w - 22, y: r.y - 26 };
  if (id === 'gise') return { x: r.x + r.w + 16, y: r.y + r.h - 14 };
  return { x: r.x + 22, y: r.y + r.h + 14 };
}
function floodPts(id) { const r = G[id].rect; return [{ x: r.x - 14, y: r.y - 20 }, { x: r.x + r.w + 14, y: r.y - 20 }, { x: r.x - 14, y: r.y + r.h + 20 }, { x: r.x + r.w + 14, y: r.y + r.h + 20 }]; }
function drawGoals(g, id, pt) {
  const r = G[id].rect, cx = r.x + r.w / 2;
  for (const s of [0, 1]) {
    const shake = pt.net[s] > 0 ? Math.sin(pt.net[s] * 40) * 3 * pt.net[s] : 0;
    const y = s ? r.y + r.h - 10 : r.y + 10, d = s ? 1 : -1, depth = 16;
    const yy = s ? y : y - depth;
    g.save();
    A.rr(g, cx - 34, yy + d * shake * 0.5, 68, depth, 3); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
    for (let x = cx - 34; x < cx + 34; x += 5) { g.beginPath(); g.moveTo(x + shake, yy); g.lineTo(x - shake, yy + depth); g.stroke(); }
    for (let k = 0; k < depth; k += 5) { g.beginPath(); g.moveTo(cx - 34, yy + k + (shake ? Math.sin(k) * shake : 0)); g.lineTo(cx + 34, yy + k); g.stroke(); }
    g.restore();
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath();
    g.moveTo(cx - 34, y); g.lineTo(cx - 34, y + d * depth); g.lineTo(cx + 34, y + d * depth); g.lineTo(cx + 34, y); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
  }
}
function drawPile(g, id, amt, unit) {
  const p = G[id].pile;
  const n = Math.max(1, Math.min(14, Math.ceil(Math.log2(amt / Math.max(1, unit) + 1) * 2)));
  const bob = Math.sin(tNow * 3 + p.x) * 1.2;
  // parıltı halkası
  g.save(); g.globalAlpha = 0.35 + 0.15 * Math.sin(tNow * 4); g.beginPath(); g.ellipse(p.x, p.y + 4, 26, 13, 0, 0, 7); g.fillStyle = '#fff6a8'; g.fill(); g.restore();
  const im = A.bill();
  for (let i = 0; i < n; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = p.x - 22 + col * 15 + (row % 2) * 6, y = p.y - row * 4 + bob * (row > 0 ? 1 : 0);
    g.save(); g.translate(x, y); g.rotate(((i * 37) % 10 - 5) * 0.03); g.drawImage(im.cv, -13, -8, 26, 16); g.restore();
  }
  if (n > 6) { const c = A.coin(); for (let i = 0; i < Math.min(5, n - 6); i++) g.drawImage(c.cv, p.x + 14 + (i % 2) * 6, p.y + 2 - i * 3, 12, 12); }
}
function updSteam(g, s, dt) {
  const cs = stats('cay', s.st.cay.lvl).stage;
  if (s.st.cay.built && Math.random() < dt * 4) {
    const src = cs >= 1 ? { x: G.cay.rect.x + 32, y: G.cay.rect.y + 26 } : { x: G.cay.rect.x + 40, y: G.cay.rect.y + 22 };
    steam.push({ x: src.x, y: src.y, life: 2.2, r: 4 });
  }
  if (s.st.dus.built && Math.random() < dt * 2) steam.push({ x: G.dus.rect.x + 34, y: G.dus.rect.y + 34, life: 1.6, r: 3 });
  for (const p of steam) { p.life -= dt; p.y -= dt * 14; p.x += dt * 6; p.r += dt * 6; g.globalAlpha = Math.max(0, p.life / 2.2) * 0.55; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fillStyle = '#fff'; g.fill(); }
  g.globalAlpha = 1; steam = steam.filter((p) => p.life > 0);
}
// ---------- gece ----------
// shortcut: ışıklar her kare gradyan yerine önceden çizilmiş tek bir sprite ile basılır (mobilde ucuz)
const glows = {};
function glowSprite(kind) {
  if (glows[kind]) return glows[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (kind === 'cut') { gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
  else { gr.addColorStop(0, 'rgba(255,200,110,1)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); }
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (glows[kind] = c);
}
let nightCv = null;
function drawNight(g, world, dk) {
  const s = world.s, vw = cam.vw, vh = cam.vh, q = 0.5;
  if (!nightCv) nightCv = document.createElement('canvas');
  if (nightCv.width !== Math.ceil(vw * q) || nightCv.height !== Math.ceil(vh * q)) { nightCv.width = Math.ceil(vw * q); nightCv.height = Math.ceil(vh * q); }
  const n = nightCv.getContext('2d');
  n.setTransform(1, 0, 0, 1, 0, 0); n.globalCompositeOperation = 'source-over'; n.clearRect(0, 0, nightCv.width, nightCv.height);
  n.fillStyle = `rgba(8,14,58,${0.7 * dk})`; n.fillRect(0, 0, nightCv.width, nightCv.height);
  n.globalCompositeOperation = 'destination-out';
  const lights = [];
  for (const l of LAMPS) lights.push([l.x, l.y + 10, 80, 0.9]);
  for (const b of buildings(s)) lights.push([b.x + b.base.w / 2, b.y + b.base.h / 2, Math.max(b.base.w, b.base.h) * 0.6, 0.55]);
  for (const id of PITCHES) if (s.st[id].built && stats(id, s.st[id].lvl).lights) { const r = G[id].rect; lights.push([r.x + r.w / 2, r.y + r.h / 2, r.h * 0.62, 1]); for (const p of floodPts(id)) lights.push([p.x, p.y, 120, 1]); }
  for (const t of world.traffic.concat(world.cars)) lights.push([t.x + Math.cos(t.ang) * 50, t.y + Math.sin(t.ang) * 50, 60, 0.8]);
  for (const [x, y, r, a] of lights) {
    const p = toScreen(x, y), rr = r * cam.z;
    if (p.x < -rr || p.y < -rr || p.x > vw + rr || p.y > vh + rr) continue;
    n.globalAlpha = a; n.drawImage(glowSprite('cut'), (p.x - rr) * q, (p.y - rr) * q, rr * 2 * q, rr * 2 * q);
  }
  n.globalAlpha = 1; g.drawImage(nightCv, 0, 0, vw, vh);
  // sıcak ışık parlamaları
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of lights) {
    const p = toScreen(x, y), rr = r * cam.z * 0.7;
    if (p.x < -rr || p.y < -rr || p.x > vw + rr || p.y > vh + rr) continue;
    g.globalAlpha = 0.22 * dk * a; g.drawImage(glowSprite('warm'), p.x - rr, p.y - rr, rr * 2, rr * 2);
  }
  // projektör ışık konileri
  for (const id of PITCHES) if (s.st[id].built && stats(id, s.st[id].lvl).lights) {
    const r = G[id].rect, c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    for (const p of floodPts(id)) {
      const a = Math.atan2(c.y - p.y, c.x - p.x) + Math.PI / 2, sp = toScreen(p.x, p.y);
      g.save(); g.translate(sp.x, sp.y); g.rotate(a); g.globalAlpha = 0.55 * dk;
      const f = frames.light_yellow; g.drawImage(atlas, f[0], f[1], f[2], f[3], -70 * cam.z, -300 * cam.z, 140 * cam.z, 300 * cam.z); g.restore();
    }
  }
  g.restore();
}
// ---------- ekran-uzayı ----------
function txt(g, s, x, y, size, fill = '#fff', stroke = '#2b3a42', align = 'center', lw) {
  g.font = `900 ${size}px ${A.FONT}`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = lw || Math.max(3, size * 0.28); g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); g.fillStyle = fill; g.fillText(s, x, y);
}
export function pill(g, x, y, w, h, fill, stroke) { A.rr(g, x - w / 2, y - h / 2 + 3, w, h, h / 2); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill(); A.rr(g, x - w / 2, y - h / 2, w, h, h / 2); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = 2; g.strokeStyle = stroke; g.stroke(); } }
export function plotRect(id) { return G[id].rect; }
function drawPlots(g, world) {
  const s = world.s;
  for (const id of ORDER) {
    if (s.st[id].built || !STATIONS[id].build) continue;
    const r = G[id].rect, a = toScreen(r.x, r.y), z = cam.z, w = r.w * z, h = r.h * z;
    if (a.x > cam.vw || a.y > cam.vh || a.x + w < 0 || a.y + h < 0) continue;
    const can = s.money >= STATIONS[id].build;
    g.save(); A.rr(g, a.x, a.y, w, h, 14 * z); g.fillStyle = can ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.18)'; g.fill();
    g.setLineDash([12 * z, 9 * z]); g.lineDashOffset = -tNow * 20; g.lineWidth = 3.5; g.strokeStyle = can ? '#fff' : 'rgba(255,255,255,0.75)'; g.stroke(); g.restore();
    const cx = a.x + w / 2, cy = a.y + h / 2, pulse = can ? 1 + 0.06 * Math.sin(tNow * 6) : 1;
    g.save(); g.translate(cx, cy - 18); g.scale(pulse, pulse);
    g.beginPath(); g.arc(0, 3, 19, 0, 7); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fill();
    g.beginPath(); g.arc(0, 0, 19, 0, 7); g.fillStyle = can ? '#4cd964' : '#9e9e9e'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.fillRect(-9, -2.5, 18, 5); g.fillRect(-2.5, -9, 5, 18); g.restore();
    txt(g, STATIONS[id].name, cx, cy + 14, 15);
    pill(g, cx, cy + 38, 104, 26, can ? '#4cd964' : '#5d6d75', can ? '#2e9e44' : '#3b474d');
    txt(g, formatMoney(STATIONS[id].build), cx, cy + 38, 14, '#fff', 'rgba(0,0,0,0.35)', 'center', 3);
  }
}
function drawBadges(g, world, ui) {
  const s = world.s;
  for (const id of ORDER) {
    const st = s.st[id]; if (!st.built) continue;
    const l = G[id].label, p = toScreen(l.x, l.y);
    if (p.x < -60 || p.y < -40 || p.x > cam.vw + 60 || p.y > cam.vh + 40) continue;
    const pt = world.pitch[id], label = `${STATIONS[id].short} · Sv ${st.lvl}` + (pt && pt.state === 'play' ? `  ⚽ ${pt.score[0]}-${pt.score[1]}` : '');
    g.font = `900 12px ${A.FONT}`; const tw = g.measureText(label).width + 20;
    pill(g, p.x, p.y, tw, 22, 'rgba(43,58,66,0.82)');
    txt(g, label, p.x, p.y + 0.5, 12, '#fff', 'rgba(0,0,0,0)', 'center', 0.01);
    if (s.money >= levelCost(id, st.lvl)) {
      const bx = p.x + tw / 2 + 4, by = p.y - 6 + Math.sin(tNow * 6) * 3;
      g.beginPath(); g.arc(bx, by + 2, 11, 0, 7); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill();
      g.beginPath(); g.arc(bx, by, 11, 0, 7); g.fillStyle = '#4cd964'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(bx, by - 6.5); g.lineTo(bx + 6, by + 0.5); g.lineTo(bx + 2.5, by + 0.5); g.lineTo(bx + 2.5, by + 6); g.lineTo(bx - 2.5, by + 6); g.lineTo(bx - 2.5, by + 0.5); g.lineTo(bx - 6, by + 0.5); g.closePath(); g.fill();
    }
    // pile tutarı
    if (st.pile > 0) { const pp = toScreen(G[id].pile.x, G[id].pile.y - 22); txt(g, '+' + formatMoney(st.pile), pp.x, pp.y - Math.sin(tNow * 3) * 2, 13, '#fff36b', '#5a3d00'); }
  }
  // karanlıkta ışıksız saha uyarısı
  for (const id of PITCHES) if (s.st[id].built && world.pitch[id].blocked) {
    const r = G[id].rect, p = toScreen(r.x + r.w / 2, r.y + r.h / 2);
    pill(g, p.x, p.y, 210, 52, 'rgba(20,24,48,0.88)', '#ffd23f');
    txt(g, '💡 Işık yok, maç yok!', p.x, p.y - 9, 15, '#ffd23f', 'rgba(0,0,0,0)', 'center', 0.01);
    txt(g, 'Sv 25\'te projektör gelir', p.x, p.y + 12, 12, '#fff', 'rgba(0,0,0,0)', 'center', 0.01);
  }
}
function drawBubbles(g, world) {
  let n = 0; const used = [];
  for (const c of world.cust) {
    if (!c.bubble || c.hidden || n > 4) continue; n++;
    const p = toScreen(c.x, c.y - 18), b = c.bubble, k = Math.min(1, (b.max - b.t) * 6, b.t * 4);
    if (p.x < -80 || p.x > cam.vw + 80 || p.y < -40 || p.y > cam.vh + 40) continue;
    if (used.some((u) => Math.abs(u.x - p.x) < 150 && Math.abs(u.y - p.y) < 34)) continue; used.push(p);
    g.save(); g.translate(p.x, p.y - 16); g.scale(k, k);
    g.font = `800 12px ${A.FONT}`; const w = g.measureText(b.txt).width + 18;
    A.rr(g, -w / 2, -14 + 2, w, 26, 13); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
    A.rr(g, -w / 2, -14, w, 26, 13); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(-6, 11); g.lineTo(0, 19); g.lineTo(6, 11); g.fill();
    g.fillStyle = '#2b3a42'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.txt, 0, -1);
    g.restore();
  }
}
// GOL! vb. dünya konumlu büyük yazılar
export function popText(x, y, s, opt = {}) { fx.texts.push({ x, y, s, t: 0, life: opt.life || 1.4, size: opt.size || 30, color: opt.color || '#fff', stroke: opt.stroke || '#d35400', rise: opt.rise ?? 30 }); }
function drawTexts(g, dt) {
  for (const t of fx.texts) {
    t.t += dt; const p = toScreen(t.x, t.y), k = t.t / t.life;
    const sc = k < 0.15 ? 0.4 + (k / 0.15) * 0.9 : k < 0.25 ? 1.3 - (k - 0.15) * 3 : 1;
    g.save(); g.globalAlpha = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1; g.translate(p.x, p.y - k * t.rise); g.scale(sc, sc);
    txt(g, t.s, 0, 0, t.size, t.color, t.stroke, 'center', t.size * 0.22); g.restore();
  }
  fx.texts = fx.texts.filter((t) => t.t < t.life);
}
export function burst(x, y, n = 24, colors = ['#ffd23f', '#4cd964', '#3d9bff', '#ff5e5e', '#fff']) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 40 + Math.random() * 120; fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 2 + Math.random() * 3, c: colors[i % colors.length], life: 0.8 + Math.random() * 0.6, max: 1.4 }); }
}
export function updParts(dt) { for (const p of fx.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.vx *= 0.97; } fx.parts = fx.parts.filter((p) => p.life > 0); }
