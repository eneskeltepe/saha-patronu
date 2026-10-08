// Kenney tarzı kodla çizilen binalar / objeler (düz renk, yuvarlak köşe, koyu kontur, gölge).
// Her çizim bir kez offscreen canvas'a (2x) çizilip önbelleğe alınır.
export const PAL = {
  grass: '#33b76a', grassDk: '#27ad60', grassLt: '#3fc276', road: '#8d9aa3', roadLt: '#a6c9cb', walk: '#d9e3e6', walkDk: '#b9c8cc',
  sand: '#ecd9a8', sandDk: '#d8c08a', dirt: '#d1a65b', dirtDk: '#b98c45', pitchA: '#31d978', pitchB: '#2ecc71', line: '#ffffff',
  wood: '#c98a4b', woodDk: '#9a6331', woodLt: '#e6b27a', red: '#e8574a', redDk: '#b83d33', white: '#f7f7f2', ink: '#2b3a42', gold: '#ffc83d', goldDk: '#d99a14',
};
const S = 2; // önbellek çözünürlüğü (dünya px başına)
const cache = new Map();
export const FONT = '"Baloo 2", "Nunito", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';

function mk(w, h, fn) {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.ceil(w * S), Math.ceil(h * S)) : Object.assign(document.createElement('canvas'), { width: Math.ceil(w * S), height: Math.ceil(h * S) });
  const g = cv.getContext('2d'); g.scale(S, S); g.lineJoin = 'round'; g.lineCap = 'round';
  fn(g, w, h); return { cv, w, h };
}
export function cached(key, w, h, fn) { if (!cache.has(key)) cache.set(key, mk(w, h, fn)); return cache.get(key); }
export function clearArt() { cache.clear(); }

export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function box(g, x, y, w, h, r, fill, stroke, lw = 2.5) {
  rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function shadow(g, x, y, w, h, r, d = 6) { rr(g, x + d * 0.5, y + d, w, h, r); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill(); }
function circle(g, x, y, r, fill, stroke, lw = 2) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } }
export function sign(g, x, y, w, h, txt, bg = PAL.red, fg = '#fff', size = 11, stroke) {
  shadow(g, x - w / 2, y - h / 2, w, h, 5, 3);
  box(g, x - w / 2, y - h / 2, w, h, 5, bg, stroke || shade(bg, -0.25), 2);
  g.fillStyle = fg; g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y + 1);
}
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return '#' + [f(r), f(gg), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function stripes(g, x, y, w, h, n, a, b) { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(x + (w / n) * i, y, w / n + 0.5, h); } }
// tırtıklı tente (yukarıdan): şerit + alt kenarda yarım daireler
function awning(g, x, y, w, h, a, b, n = 6, vertical = false) {
  g.save(); shadow(g, x, y, w, h, 3, 4);
  rr(g, x, y, w, h, 3); g.clip();
  if (!vertical) stripes(g, x, y, w, h, n, a, b); else for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(x, y + (h / n) * i, w, h / n + 0.5); }
  g.restore(); rr(g, x, y, w, h, 3); g.lineWidth = 2; g.strokeStyle = shade(a, -0.3); g.stroke();
}
export function teaGlass(g, x, y, s = 1) {
  circle(g, x, y, 4.2 * s, '#fff', '#c9d3d6', 1);           // tabak
  circle(g, x, y, 2.6 * s, '#c0392b', '#8e2a1f', 0.8);       // çay
  circle(g, x - 0.8 * s, y - 0.8 * s, 0.8 * s, 'rgba(255,255,255,0.7)');
}
export function tray(g, x, y, n = 3) {
  circle(g, x, y, 10, '#d7dee2', '#9aa7ad', 1.6);
  const pts = n >= 4 ? [[-4, -4], [4, -4], [-4, 4], [4, 4]] : [[-4, -2], [4, -2], [0, 4]];
  pts.slice(0, n).forEach(([dx, dy]) => teaGlass(g, x + dx, y + dy, 0.75));
}
function semaver(g, x, y) {
  circle(g, x, y, 9, '#cfd8dc', '#7d8b91', 2); circle(g, x, y, 5, '#eef3f5', '#9aa7ad', 1.2); circle(g, x, y, 2, '#7d8b91');
  g.fillStyle = '#7d8b91'; g.fillRect(x + 8, y - 1.5, 5, 3);
}

// ---------- binalar: { base, top } katmanları, dünya boyutunda ----------
export function gise(stage, w = 104, h = 84) {
  return {
    base: cached('gise' + stage, w + 8, h + 10, (g) => {
      // zemin + tezgâh (soldaki pencere hattı) + çatı
      shadow(g, 0, 0, w, h, 8);
      box(g, 0, 0, w, h, 8, '#f1e6cf', '#c9b48a');
      // karo zemin
      g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1;
      for (let i = 10; i < 44; i += 10) { g.beginPath(); g.moveTo(i, 4); g.lineTo(i, h - 4); g.stroke(); }
      // tezgah
      box(g, 3, 4, 13, h - 8, 4, PAL.woodLt, PAL.woodDk, 2);
      // kasa / turnike detayları
      box(g, 6, 14, 8, 8, 2, '#5d6d75', '#3b474d', 1.2);
      if (stage >= 2) for (let i = 0; i < 3; i++) box(g, -1, 28 + i * 18, 4, 10, 1, '#b0bec5', '#78909c', 1);
      // çatı
      box(g, 44, 0, w - 44, h, 8, stage >= 3 ? '#4a90d9' : PAL.red, stage >= 3 ? '#2f6aa8' : PAL.redDk, 3);
      g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, 48, 4, w - 52, h / 2 - 6, 6); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(48, h / 2); g.lineTo(w - 4, h / 2); g.stroke();
      // klima
      box(g, w - 26, h - 24, 16, 14, 3, '#dfe6e9', '#9aa7ad', 1.5);
      g.strokeStyle = '#9aa7ad'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(w - 23, h - 20 + i * 3.5); g.lineTo(w - 13, h - 20 + i * 3.5); g.stroke(); }
      sign(g, 44 + (w - 44) / 2, 18, 48, 17, 'GİŞE', '#ffd23f', '#7a3b00', 11, '#c79a00');
      if (stage >= 1) { circle(g, w - 8, 8, 5, '#3fae5a', '#2a7a3e', 1.5); }
    }),
    top: cached('giseTop' + stage, 20, h, (g) => {
      awning(g, 0, 2, 16, h - 4, stage >= 3 ? '#4a90d9' : PAL.red, '#fff', 7, true);
    }),
  };
}
export function soyunma(stage, w = 206, h = 118) {
  return {
    base: cached('soy' + stage, w + 8, h + 10, (g) => {
      shadow(g, 0, 0, w, h, 10);
      const roof = stage >= 2 ? '#5aa0c8' : '#8fa4b8', rd = shade(roof, -0.3);
      box(g, 0, 0, w, h, 10, roof, rd, 3);
      // çatı panelleri (eğim ve bölmeler)
      g.fillStyle = 'rgba(255,255,255,0.16)'; rr(g, 4, 4, w - 8, h / 2 - 4, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1.5;
      for (let x = 22; x < w - 6; x += 22) { g.beginPath(); g.moveTo(x, 5); g.lineTo(x, h - 5); g.stroke(); }
      g.lineWidth = 3; g.strokeStyle = rd; g.beginPath(); g.moveTo(8, h / 2); g.lineTo(w - 8, h / 2); g.stroke();
      // havalandırmalar / güneş paneli
      for (const [x, y] of [[30, 22], [30, h - 34]]) { box(g, x, y, 18, 14, 3, '#dfe6e9', '#9aa7ad', 1.5); circle(g, x + 9, y + 7, 4, '#b0bec5', '#78909c', 1); }
      if (stage >= 1) for (let i = 0; i < 3; i++) { box(g, 70 + i * 26, 14, 22, 30, 2, '#2d4a7a', '#1b2f52', 1.5); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(70 + i * 26 + 11, 15); g.lineTo(70 + i * 26 + 11, 43); g.moveTo(71 + i * 26, 29); g.lineTo(91 + i * 26, 29); g.stroke(); }
      if (stage >= 3) { box(g, 70, h - 40, 74, 26, 4, '#eaf6fb', '#9fc6d6', 1.5); g.fillStyle = 'rgba(90,160,200,0.35)'; rr(g, 74, h - 36, 66, 18, 3); g.fill(); }
      // kapı (sağ)
      box(g, w - 8, h / 2 - 14, 10, 28, 3, PAL.wood, PAL.woodDk, 2);
      sign(g, w / 2 + 20, h - 16, 104, 18, 'SOYUNMA ODASI', '#2f6aa8', '#fff', 10.5);
    }),
  };
}
export function dus(stage, w = 182, h = 96) {
  return {
    base: cached('dus' + stage, w + 8, h + 10, (g) => {
      shadow(g, 0, 0, w, h, 10);
      box(g, 0, 0, w, h, 10, '#d4eef6', '#8fc2d4', 3);
      g.fillStyle = 'rgba(255,255,255,0.4)'; rr(g, 4, 4, w - 8, h / 2 - 4, 7); g.fill();
      g.strokeStyle = 'rgba(70,140,170,0.25)'; g.lineWidth = 1;
      for (let x = 14; x < w; x += 14) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke(); }
      // su deposu
      circle(g, 34, 34, 18, '#4a90d9', '#2f6aa8', 3); circle(g, 34, 34, 11, '#6aa8e8', '#2f6aa8', 1.5); circle(g, 30, 30, 3, 'rgba(255,255,255,0.6)');
      g.strokeStyle = '#7d8b91'; g.lineWidth = 3; g.beginPath(); g.moveTo(52, 34); g.lineTo(90, 34); g.lineTo(90, 60); g.stroke();
      if (stage >= 2) { box(g, 110, 14, 50, 30, 4, '#a0522d', '#6d3519', 2); g.fillStyle = '#ffd9b3'; g.font = `900 9px ${FONT}`; g.textAlign = 'center'; g.fillText('SAUNA', 135, 32); }
      box(g, w - 8, h / 2 - 12, 10, 24, 3, '#eceff1', '#90a4ae', 2);
      sign(g, w / 2 + 10, h - 16, 66, 18, '💧 DUŞ', '#2f9fd0', '#fff', 11);
    }),
  };
}
export function cay(stage, w = 150, h = 112) {
  return {
    base: cached('cay' + stage, w + 10, h + 12, (g) => {
      if (stage === 0) {
        // açık tezgah: toprak zemin + L tezgah + semaver + küçük tente
        shadow(g, 10, 10, w - 20, h - 20, 10, 4);
        box(g, 10, 10, w - 20, h - 20, 10, '#e2c58c', '#c4a468', 2);
        box(g, w - 34, 16, 18, h - 32, 4, PAL.woodLt, PAL.woodDk, 2.5);
        box(g, 20, 16, w - 54, 16, 4, PAL.woodLt, PAL.woodDk, 2.5);
        semaver(g, 40, 24); tray(g, w - 25, 50, 3); teaGlass(g, w - 25, 80); teaGlass(g, 70, 24);
        box(g, 24, 46, 26, 20, 3, '#7d5a3c', '#4e3523', 1.5); // ocak
        circle(g, 31, 56, 4, '#333'); circle(g, 43, 56, 4, '#333');
        awning(g, 14, h - 34, w - 52, 18, PAL.red, '#fff', 8);
        sign(g, w / 2 - 14, h - 44, 74, 15, 'ÇAY OCAĞI', '#fff', PAL.redDk, 9, '#c9b48a');
        return;
      }
      // kulübe / kafe
      const roof = stage >= 2 ? '#3fae5a' : '#b5743f', rd = shade(roof, -0.32);
      shadow(g, 0, 0, w - 18, h, 9);
      box(g, 0, 0, w - 18, h, 9, roof, rd, 3);
      // ahşap kiremit sıraları
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.5;
      for (let y = 12; y < h - 4; y += 12) { g.beginPath(); g.moveTo(5, y); g.lineTo(w - 23, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, 4, 4, (w - 18) / 2 - 6, h - 8, 6); g.fill();
      g.lineWidth = 3; g.strokeStyle = rd; g.beginPath(); g.moveTo((w - 18) / 2, 6); g.lineTo((w - 18) / 2, h - 6); g.stroke();
      // baca
      box(g, 22, 16, 20, 20, 3, '#9e9e9e', '#616161', 2); box(g, 25, 19, 14, 14, 2, '#424242');
      // tezgah penceresi (sağ)
      box(g, w - 22, 8, 20, h - 16, 4, PAL.woodLt, PAL.woodDk, 2.5);
      semaver(g, w - 12, 24); tray(g, w - 12, 56, stage >= 2 ? 4 : 3); teaGlass(g, w - 12, 84); teaGlass(g, w - 12, 96);
      if (stage >= 2) awning(g, w - 30, 4, 12, h - 8, '#3fae5a', '#fff', 9, true);
      sign(g, (w - 18) / 2, h - 18, 92, 20, 'ÇAY OCAĞI', PAL.red, '#fff', 12);
    }),
  };
}
export function bufe(stage, w = 206, h = 100, overhang) {
  return {
    base: cached('bufe' + stage, w + 8, h + 10, (g) => {
      shadow(g, 0, 0, w, h, 8);
      box(g, 0, 0, w, h, 8, '#f6efe0', '#cdbb94', 2);
      box(g, w - 22, 6, 18, h - 12, 4, '#cfd8dc', '#78909c', 2.5); // tezgah (çelik)
      box(g, w - 44, 14, 18, 14, 3, '#37474f', '#1c262b', 1.5); // tost makinesi
      if (stage >= 1) box(g, w - 44, 34, 18, 14, 3, '#37474f', '#1c262b', 1.5);
      box(g, w - 44, h - 30, 18, 18, 9, '#fff', '#b0bec5', 1.5); // ayran kazanı
      if (overhang) { g.save(); rr(g, 0, 0, w - 50, h, 8); g.clip(); g.drawImage(overhang, 0, 0, w - 50, h); g.restore(); rr(g, 0, 0, w - 50, h, 8); g.lineWidth = 2.5; g.strokeStyle = '#a84e12'; g.stroke(); }
      sign(g, (w - 50) / 2, h / 2, 96, 22, 'TOST • AYRAN', '#fff', '#c0392b', 11, '#c9b48a');
    }),
  };
}
// para destesi (yukarıdan banknot) ve madeni para
export function bill() {
  return cached('bill', 26, 16, (g) => {
    box(g, 1, 1, 24, 14, 2.5, '#7bc950', '#3f8a2a', 1.6);
    box(g, 4, 4, 18, 8, 1.5, '#9be070');
    circle(g, 13, 8, 3.2, '#5aa83a'); g.fillStyle = '#e9ffd9'; g.font = `900 5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₺', 13, 8.3);
  });
}
export function coin() {
  return cached('coin', 16, 16, (g) => {
    circle(g, 8, 8, 7, PAL.gold, PAL.goldDk, 1.6); circle(g, 8, 8, 4.5, '#ffe07a');
    g.fillStyle = PAL.goldDk; g.font = `900 7px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₺', 8, 8.5);
  });
}
export function table(withUmbrella) {
  return cached('table' + (withUmbrella ? 1 : 0), 60, 40, (g) => {
    for (const x of [10, 50]) { circle(g, x, 20 + 2, 6, 'rgba(0,0,0,0.15)'); circle(g, x, 20, 6, '#a0522d', '#6d3519', 1.5); }
    circle(g, 30, 23, 11, 'rgba(0,0,0,0.18)');
    circle(g, 30, 20, 11, PAL.woodLt, PAL.woodDk, 2);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.beginPath(); g.arc(30, 20, 7, 0, Math.PI * 2); g.stroke();
  });
}
export function bench(len) {
  return cached('bench' + len, 18, len, (g) => {
    box(g, 2, 2, 14, len - 4, 3, 'rgba(0,0,0,0.15)');
    box(g, 0, 0, 14, len - 4, 3, '#3d7fd1', '#24538f', 2);
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(7, 4); g.lineTo(7, len - 8); g.stroke();
  });
}
export function floodPole() {
  return cached('flood', 30, 30, (g) => {
    circle(g, 15, 17, 8, 'rgba(0,0,0,0.2)');
    circle(g, 15, 15, 7, '#78909c', '#455a64', 2);
    box(g, 5, 4, 20, 10, 3, '#eceff1', '#78909c', 2);
    for (let i = 0; i < 3; i++) circle(g, 9 + i * 6, 9, 2.2, '#fff59d', '#c9b458', 0.8);
  });
}
export function lamp() {
  return cached('lamp', 22, 22, (g) => {
    circle(g, 11, 13, 6, 'rgba(0,0,0,0.2)'); circle(g, 11, 11, 5, '#607d8b', '#37474f', 2); circle(g, 11, 11, 2.5, '#fff59d');
  });
}
