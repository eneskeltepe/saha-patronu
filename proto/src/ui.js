// DOM arayüzü: üst HUD, hedef kartı, istasyon kartı, modallar, ipuçları, uçan paralar (fx canvas).
import { STATIONS, ORDER, CFG, GOALS } from './config.js';
import { stats, costFor, levelCost, nextMilestone } from './sim.js';
import { formatMoney, formatNumber } from './format.js';
import { sfx, vibrate } from './audio.js';

const $ = (s) => document.querySelector(s);
const EMOJI = { gise: '🎟️', soyunma: '👕', saha1: '⚽', saha2: '⚽', cay: '🍵', otopark: '🚗', dus: '🚿', bufe: '🥪' };
const COIN = '<i class="ico coin"></i>', GEM = '<i class="ico gem"></i>';
let world, api, shown = 0, cardId = null, buyN = 1, fxCv, fxG, dpr = 1;
const flies = [], conf = [];

export function initUI(w, a) {
  world = w; api = a; shown = w.s.money;
  fxCv = $('#fx'); fxG = fxCv.getContext('2d');
  $('#bMgr').onclick = () => { sfx('tap'); openManagers(); };
  $('#bShop').onclick = () => { sfx('tap'); openShop(); };
  $('#bSet').onclick = () => { sfx('tap'); openSettings(); };
  $('#goal').onclick = (e) => { if (e.target.closest('.claim')) { const g = world.claimGoal(); if (g) { sfx('levelup'); vibrate(30); const r = $('#goal').getBoundingClientRect(); confettiAt(r.left + r.width / 2, r.bottom); gemFly(r.left + r.width / 2, r.top + 20, g.gems); toast(`+${g.gems} elmas!`, 'gold'); } renderGoal(true); } };
  renderGoal(true);
}
export function resizeFx(w, h, d) { dpr = d; fxCv.width = w * d; fxCv.height = h * d; }

// ---------- HUD ----------
let lastGoalKey = '', clockMin = -1;
export function tickUI(dt) {
  const s = world.s;
  const diff = s.money - shown;
  shown = Math.abs(diff) < 1 ? s.money : shown + diff * Math.min(1, dt * 8);
  $('#money span').textContent = formatMoney(shown);
  $('#gems span').textContent = formatNumber(s.gems);
  const mins = Math.floor(s.day * 24 * 60);
  if (mins !== clockMin) { clockMin = mins; const h = Math.floor(mins / 60), m = mins % 60; $('#clock').textContent = `${world.night() ? '🌙' : '☀️'} ${String(h).padStart(2, '0')}:${String(m - (m % 10)).padStart(2, '0')}`; }
  renderGoal();
  if (cardId) refreshCard();
  $('#bMgr').classList.toggle('alert', ORDER.some((id) => s.st[id].built && !s.st[id].mgr && s.money >= STATIONS[id].mgr));
  $('#bShop').classList.toggle('alert', s.gems >= CFG.boost.gemCost && s.boostLeft <= 0);
  drawFx(dt);
}
export function bumpMoney() { const m = $('#money'); m.classList.add('bump'); setTimeout(() => m.classList.remove('bump'), 110); }
function renderGoal(force) {
  const g = world.goal(), el = $('#goal');
  if (!g) { const k = 'done'; if (lastGoalKey !== k || force) { lastGoalKey = k; el.className = ''; el.innerHTML = '<div class="gt"><span>Tesis tamamlandı</span><span>🏆</span></div><div class="gx">İlçe Spor Kompleksi yakında!</div>'; } return; }
  const pr = world.goalProgress(g), ready = world.s.goalReady;
  const key = world.s.goal + ':' + ready;
  if (key !== lastGoalKey || force) {
    lastGoalKey = key;
    el.className = ready ? 'ready' : '';
    el.innerHTML = `<div class="gt"><span>Hedef ${world.s.goal + 1}/${GOALS.length}</span><span style="display:flex;align-items:center;gap:2px">${GEM.replace('ico gem', 'ico gem" style="width:16px;height:16px')} ${g.gems}</span></div><div class="gx">${g.txt}</div><div class="bar"><i></i></div><button class="btn sm claim">Ödülü al!</button>`;
  }
  const bar = el.querySelector('.bar > i'); if (bar) bar.style.width = Math.round(pr * 100) + '%';
}

// ---------- istasyon kartı ----------
export function openCard(id) {
  guard(); cardId = id; buyN = buyN || 1; $('#card').classList.remove('hidden'); renderCard(); sfx('tap');
}
export function closeCard() { cardId = null; $('#card').classList.add('hidden'); }
export const cardOpen = () => cardId;
let cardKey = '';
function refreshCard() { const k = cardSig(); if (k !== cardKey) renderCard(); }
function cardSig() { const st = world.s.st[cardId]; const c = costFor(cardId, st.lvl, buyN, world.s.money); return [cardId, st.lvl, buyN, c.levels, world.s.money >= c.cost].join('|'); }
function renderCard() {
  const id = cardId, d = STATIONS[id], st = world.s.st[id];
  cardKey = cardSig();
  const c = costFor(id, st.lvl, buyN, world.s.money), can = c.levels > 0 && world.s.money >= c.cost;
  const a = stats(id, st.lvl), b = stats(id, st.lvl + Math.max(1, c.levels));
  const nm = nextMilestone(st.lvl), mi = nm ? CFG.milestones.indexOf(nm) : -1, prev = mi > 0 ? CFG.milestones[mi - 1] : 1;
  const msTxt = nm ? `Sv ${nm}: ${d.ms[mi].txt} ${msEffect(d.ms[mi])}` : 'Tüm kilometre taşları tamam!';
  const pct = nm ? Math.round(((st.lvl - prev) / (nm - prev)) * 100) : 100;
  const isPitch = !!d.pitch, isPark = !!d.perCar;
  const unit = isPitch ? 'oyuncu' : isPark ? 'araba' : 'müşteri';
  const fmtT = (t) => (t >= 10 ? t.toFixed(0) : t.toFixed(1)) + ' sn';
  const dp = b.profit - a.profit, dtm = a.time - b.time, dc = b.cap - a.cap;
  $('#card').innerHTML = `
    <div class="hd"><div class="badge">${EMOJI[id]}</div><div><h2>${d.name}</h2><div class="lv">Seviye ${st.lvl}${st.mgr ? ' · 👔 Yönetici' : ''}</div></div><button class="x" data-x>✕</button></div>
    <div class="stats">
      <div class="stat"><b>Kazanç/${unit}</b><span>${formatMoney(a.profit)}</span><em>${dp > 0 ? '+' + formatMoney(dp) : ''}</em></div>
      ${isPark ? `<div class="stat"><b>Park yeri</b><span>${a.cap}</span><em></em></div>` : `<div class="stat"><b>${isPitch ? 'Maç süresi' : 'Süre'}</b><span>${fmtT(a.time)}</span><em>${dtm > 0.05 ? '-' + fmtT(dtm) : ''}</em></div>`}
      <div class="stat"><b>${isPitch ? 'Işık' : 'Kapasite'}</b><span>${isPitch ? (a.lights ? 'Var 💡' : 'Yok') : a.cap}</span><em>${!isPitch && dc > 0 ? '+' + dc : isPitch && b.lights && !a.lights ? 'Geliyor!' : ''}</em></div>
    </div>
    <div class="ms"><div class="row"><span>${msTxt}</span><span>${nm ? st.lvl + '/' + nm : '⭐'}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="nodes">${CFG.milestones.map((m) => `<span class="node ${st.lvl >= m ? 'on' : ''}"><i></i>${m}</span>`).join('')}</div></div>
    <div class="buy"><div class="seg">${[[1, 'x1'], [10, 'x10'], [Infinity, 'MAX']].map(([n, l]) => `<button data-n="${n}" class="${buyN === n ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button class="btn" id="upBtn" ${can ? '' : 'disabled'}>Yükselt${c.levels > 1 ? ' +' + c.levels : ''}<small>${COIN}${formatMoney(c.cost)}</small></button></div>`;
  $('#card [data-x]').onclick = () => { sfx('tap'); closeCard(); };
  $('#card').querySelectorAll('.seg button').forEach((bt) => bt.onclick = () => { buyN = +bt.dataset.n; sfx('tap'); renderCard(); });
  $('#upBtn').onclick = (e) => { const n = world.upgrade(id, buyN); if (n) { api.onUpgraded(id); const r = e.currentTarget.getBoundingClientRect(); sparkAt(r.left + r.width / 2, r.top); } else sfx('error'); renderCard(); };
}
function msEffect(m) { return m.cap ? `(+${m.cap} kapasite)` : m.speed ? `(Hız x${m.speed})` : m.profit ? `(Kazanç x${m.profit})` : ''; }

// ---------- modallar ----------
let guardUntil = 0;
export const guard = () => { guardUntil = performance.now() + 380; };
addEventListener('click', (e) => { if (performance.now() < guardUntil && e.target.closest('#modal, #card')) { e.stopPropagation(); e.preventDefault(); } }, true);
export function modal(html, onBind) { guard(); const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.classList.remove('hidden'); m.onclick = (e) => { if (e.target === m) closeModal(); }; onBind?.(m); }
export function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; api?.onModalClosed?.(); }
export const modalOpen = () => !$('#modal').classList.contains('hidden');
function openManagers() {
  const rows = ORDER.filter((id) => world.s.st[id].built).map((id) => {
    const st = world.s.st[id], c = STATIONS[id].mgr;
    return `<div class="item"><div class="em">${EMOJI[id]}</div><div class="nm">${STATIONS[id].name}<small>${st.mgr ? 'Parayı otomatik topluyor ✓' : 'Parayı senin yerine toplar'}</small></div>
      ${st.mgr ? '<button class="btn sm gray" disabled>Çalışıyor</button>' : `<button class="btn sm" data-h="${id}" ${world.s.money >= c ? '' : 'disabled'}>${formatMoney(c)}</button>`}</div>`;
  }).join('');
  modal(`<h1>Yöneticiler</h1><p>Yönetici, sen yokken bile parayı toplar.</p><div class="list">${rows}</div><div style="height:12px"></div><button class="btn blue" data-close style="width:100%">Tamam</button>`, (m) => {
    m.querySelector('[data-close]').onclick = () => { sfx('tap'); closeModal(); };
    m.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { if (world.hire(b.dataset.h)) { sfx('kaching'); vibrate(25); const r = b.getBoundingClientRect(); confettiAt(r.left + r.width / 2, r.top); toast(`${STATIONS[b.dataset.h].name} için yönetici işe başladı!`); openManagers(); } });
    api.onManagersOpen?.(m);
  });
}
function openShop() {
  const s = world.s, b = CFG.boost, ic = CFG.instantCash;
  const boostTxt = s.boostLeft > 0 ? `Aktif: ${Math.ceil(s.boostLeft / 60)} dk kaldı` : `${b.dur / 60} dk boyunca her şey 2 kat hızlı`;
  const cash = api.instantCashAmount();
  modal(`<h1>Mağaza</h1>
    <div class="list">
      <div class="item"><div class="em">⚡</div><div class="nm">Turbo x2<small>${boostTxt}</small></div><button class="btn sm orange" data-ad>▶ Reklam</button></div>
      <div class="item"><div class="em">⚡</div><div class="nm">Turbo x2 (elmasla)<small>Reklamsız, hemen</small></div><button class="btn sm purple" data-gb ${s.gems >= b.gemCost ? '' : 'disabled'}>${b.gemCost} 💎</button></div>
      <div class="item"><div class="em">💰</div><div class="nm">Kasa dolusu para<small>${ic.minutes} dk kazanç: ${formatMoney(cash)}</small></div><button class="btn sm purple" data-cash ${s.gems >= ic.gemCost ? '' : 'disabled'}>${ic.gemCost} 💎</button></div>
      <div class="item"><div class="em">💎</div><div class="nm">Elmas paketi<small>80 elmas</small></div><button class="btn sm blue" data-iap>₺29,99</button></div>
      <div class="item"><div class="em">💎</div><div class="nm">Büyük elmas sandığı<small>500 elmas + reklamsız</small></div><button class="btn sm blue" data-iap>₺149,99</button></div>
    </div><div style="height:12px"></div><button class="btn gray" data-close style="width:100%">Kapat</button>`, (m) => {
    m.querySelector('[data-close]').onclick = () => { sfx('tap'); closeModal(); };
    m.querySelector('[data-ad]').onclick = () => fakeAd(() => { s.boostLeft += b.dur; toast('⚡ Turbo x2 başladı!', 'gold'); sfx('levelup'); });
    m.querySelector('[data-gb]').onclick = () => { if (s.gems < b.gemCost) return; s.gems -= b.gemCost; s.boostLeft += b.dur; closeModal(); toast('⚡ Turbo x2 başladı!', 'gold'); sfx('levelup'); };
    m.querySelector('[data-cash]').onclick = () => { if (s.gems < ic.gemCost) return; s.gems -= ic.gemCost; s.money += cash; closeModal(); toast('+' + formatMoney(cash), 'gold'); sfx('kaching'); coinBurstCenter(); };
    m.querySelectorAll('[data-iap]').forEach((x) => x.onclick = () => { sfx('tap'); toast('Prototip: gerçek satın alma yok 🙂'); });
  });
}
function openSettings() {
  const st = world.s.settings;
  modal(`<h1>Ayarlar</h1><div class="list">
      <div class="tog">🎵 Müzik <button class="btn sm ${st.music ? '' : 'gray'}" data-t="music">${st.music ? 'Açık' : 'Kapalı'}</button></div>
      <div class="tog">🔊 Ses efektleri <button class="btn sm ${st.sound ? '' : 'gray'}" data-t="sound">${st.sound ? 'Açık' : 'Kapalı'}</button></div>
      <div class="tog">🔄 Sıfırdan başla <button class="btn sm orange" data-reset>Sıfırla</button></div>
    </div><p style="font-size:12px;color:#8a7650;margin:12px 0 10px">Saha Patronu prototip · Grafikler: Kenney (CC0)</p><button class="btn blue" data-close style="width:100%">Tamam</button>`, (m) => {
    m.querySelector('[data-close]').onclick = () => { sfx('tap'); closeModal(); };
    m.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { st[b.dataset.t] = !st[b.dataset.t]; api.onSettings(); sfx('tap'); openSettings(); });
    m.querySelector('[data-reset]').onclick = () => {
      modal('<h1>Emin misin?</h1><p>Tüm ilerleme silinecek.</p><div class="row2"><button class="btn gray" data-no>Vazgeç</button><button class="btn orange" data-yes>Sıfırla</button></div>', (m2) => {
        m2.querySelector('[data-no]').onclick = () => openSettings();
        m2.querySelector('[data-yes]').onclick = () => api.reset();
      });
    };
  });
}
export function fakeAd(done) {
  let n = 3;
  modal(`<h1>Reklam</h1><div class="adbox" id="adb">Reklam (prototip)<br>${n}</div><p>Ödül birazdan…</p>`);
  const m = $('#modal'); m.onclick = null;
  const iv = setInterval(() => { n--; const b = document.getElementById('adb'); if (b) b.innerHTML = `Reklam (prototip)<br>${n}`; if (n <= 0) { clearInterval(iv); closeModal(); done(); } }, 1000);
}
export function offlineModal(amt, sec, give) {
  const h = Math.floor(sec / 3600), mn = Math.floor((sec % 3600) / 60);
  modal(`<h1>Hoş geldin patron!</h1><p>Sen yokken yöneticiler çalıştı (${h ? h + ' sa ' : ''}${mn} dk)</p><div class="big">${COIN}${formatMoney(amt)}</div>
    <div class="row2"><button class="btn gray" data-one>Al</button><button class="btn orange" data-two>▶ 2x Al</button></div>`, (m) => {
    m.onclick = null;
    m.querySelector('[data-one]').onclick = () => { closeModal(); give(amt); };
    m.querySelector('[data-two]').onclick = () => fakeAd(() => give(amt * 2));
  });
}
export function milestoneModal(id, txt, stage) {
  modal(`<h1>Kilometre taşı!</h1><div style="font-size:64px;line-height:1.1">${EMOJI[id]}</div><p style="font-size:20px;margin:6px 0">${STATIONS[id].name}</p><p style="color:#1fa83a;font-size:18px;margin-top:0">${txt}</p><button class="btn" data-ok style="width:100%">Süper!</button>`, (m) => {
    m.querySelector('[data-ok]').onclick = () => { sfx('tap'); closeModal(); };
  });
}
export function buildModal(id, onYes) {
  const c = STATIONS[id].build, can = world.s.money >= c;
  const desc = { otopark: 'Arabayla gelen takımlar + park ücreti. Daha çok müşteri!', saha2: 'İkinci saha: iki maç aynı anda! Kuyruklar erir.', dus: 'Maçtan sonra duş parası. Ter kokusuna son!', bufe: 'Tost ve ayran satışı. Maç sonrası açlık garantili.' }[id];
  modal(`<h1>Yeni inşaat</h1><div style="font-size:60px;line-height:1.1">${EMOJI[id]}</div><p style="font-size:21px;margin:4px 0">${STATIONS[id].name}</p><p style="font-weight:700;color:#6a5a3a">${desc}</p>
    <div class="row2"><button class="btn gray" data-no>Sonra</button><button class="btn" data-yes ${can ? '' : 'disabled'}>İnşa et<br><small style="font-size:15px">${formatMoney(c)}</small></button></div>`, (m) => {
    m.querySelector('[data-no]').onclick = () => { sfx('tap'); closeModal(); };
    m.querySelector('[data-yes]').onclick = () => { closeModal(); onYes(); };
  });
}
export function finalModal() {
  modal(`<h1>Tesis tamamlandı!</h1><div style="font-size:64px">🏆</div><p style="font-size:19px">Mahalle Sahası artık efsane!</p><p>Yeni tesis: <b>İlçe Spor Kompleksi</b><br><span style="color:#b07a00">(yakında)</span></p><button class="btn orange" data-ok style="width:100%">Devam et</button>`, (m) => {
    m.querySelector('[data-ok]').onclick = () => { sfx('tap'); closeModal(); };
  });
}
export function toast(t, cls = '') { const box = $('#toast'); while (box.children.length >= 2) box.firstChild.remove(); const d = document.createElement('div'); d.className = 'tst ' + cls; d.textContent = t; $('#toast').appendChild(d); setTimeout(() => d.remove(), 2700); }

// ---------- ipucu eli ----------
export function hint(x, y, text, down = false) {
  const h = $('#hint');
  if (x == null) { h.classList.add('hidden'); return; }
  h.classList.remove('hidden'); h.classList.toggle('down', down); h.style.left = x + 'px'; h.style.top = y + 'px'; h.querySelector('.htxt').textContent = text; h.querySelector('.hand').textContent = down ? '👇' : '👆';
}

// ---------- uçan paralar / konfeti (fx canvas, ekran px) ----------
export function coinFly(x, y, n, amtEach, onEach) {
  const r = $('#money .ico').getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 7, sp = 30 + Math.random() * 50;
    flies.push({ x, y, sx: x + Math.cos(a) * sp, sy: y + Math.sin(a) * sp - 20, tx, ty, t: -i * 0.035, dur: 0.55 + Math.random() * 0.2, kind: 'coin', onEach, gem: false });
  }
}
function gemFly(x, y, n) {
  const r = $('#gems .ico').getBoundingClientRect();
  for (let i = 0; i < Math.min(8, n); i++) { const a = Math.random() * 7; flies.push({ x, y, sx: x + Math.cos(a) * 50, sy: y + Math.sin(a) * 50, tx: r.left + 12, ty: r.top + 12, t: -i * 0.05, dur: 0.7, kind: 'gem' }); }
}
function coinBurstCenter() { coinFly(innerWidth / 2, innerHeight / 2, 14, 0, () => { sfx('coin'); bumpMoney(); }); }
export function confettiAt(x, y, n = 70) {
  const cols = ['#ffd23f', '#4cd964', '#3d9bff', '#ff5e5e', '#b23cff', '#fff'];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 250 + Math.random() * 380; conf.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[i % cols.length], life: 2 + Math.random(), spin: Math.random() * 10 }); }
}
export function confettiRain() { for (let i = 0; i < 4; i++) confettiAt(innerWidth * (0.15 + i * 0.23), innerHeight * 0.35, 40); }
function sparkAt(x, y) { for (let i = 0; i < 14; i++) { const a = Math.random() * 7, v = 80 + Math.random() * 160; conf.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, r: 0, w: 6, h: 6, c: i % 2 ? '#ffd23f' : '#fff', life: 0.7, spin: 0, star: true }); } }
const coinImg = (() => { const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d'); g.beginPath(); g.arc(20, 22, 17, 0, 7); g.fillStyle = '#c98700'; g.fill(); g.beginPath(); g.arc(20, 19, 17, 0, 7); g.fillStyle = '#ffc83d'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#d99a14'; g.stroke(); g.beginPath(); g.arc(20, 19, 11, 0, 7); g.fillStyle = '#ffe07a'; g.fill(); g.fillStyle = '#c98700'; g.font = '900 17px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₺', 20, 20); return c; })();
const gemImg = (() => { const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d'); g.beginPath(); g.moveTo(10, 6); g.lineTo(30, 6); g.lineTo(37, 16); g.lineTo(20, 36); g.lineTo(3, 16); g.closePath(); g.fillStyle = '#b23cff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#7a1fc2'; g.stroke(); return c; })();
function drawFx(dt) {
  const g = fxG; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, fxCv.width, fxCv.height);
  for (const f of flies) {
    f.t += dt; if (f.t < 0) continue;
    const k = Math.min(1, f.t / f.dur);
    let x, y, sc;
    if (k < 0.3) { const q = k / 0.3, e = 1 - (1 - q) * (1 - q); x = f.x + (f.sx - f.x) * e; y = f.y + (f.sy - f.y) * e; sc = 1 + q * 0.2; }
    else { const q = (k - 0.3) / 0.7, e = q * q; x = f.sx + (f.tx - f.sx) * e; y = f.sy + (f.ty - f.sy) * e - Math.sin(q * Math.PI) * 40; sc = 1.2 - q * 0.5; }
    const im = f.kind === 'gem' ? gemImg : coinImg, s = 26 * sc;
    g.drawImage(im, x - s / 2, y - s / 2, s, s);
    if (k >= 1 && !f.done) { f.done = true; f.onEach?.(); if (f.kind === 'gem') sfx('pop'); }
  }
  for (let i = flies.length - 1; i >= 0; i--) if (flies[i].done) flies.splice(i, 1);
  for (const p of conf) {
    p.life -= dt; p.vy += 700 * dt; p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.spin * dt;
    g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c;
    if (p.star) { g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
    g.restore();
  }
  for (let i = conf.length - 1; i >= 0; i--) if (conf[i].life <= 0) conf.splice(i, 1);
}
