import { createInitialState, applyOffline, tick, selectors as S, actions as A, config } from './core/index.js';
import * as storage from './storage.js';
import { createRenderer } from './ui/canvas.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { levelUpCard, unlockCard, offlineCard, eventModal, settingsModal, confirmModal } from './ui/modals.js';
import { sfx, vibrate, bindSettings, installUnlock, setHidden, setNight } from './ui/audio.js';
import { coinBurst } from './ui/fx.js';
import { createTutorial } from './ui/tutorial.js';
import { text as T } from './ui/texts.js';
import { formatMoney, esc } from './ui/format.js';
import { icon } from './ui/icons.js';

const FEATURES = { price: 'Fiyat ayarı', cafe: 'Çay ocağı & kafeterya', events: 'Mahalle olayları', staff: 'Personel', rental: 'Ekipman kiralama', parking: 'Otopark', tournament: 'Turnuvalar', camera: 'Maç kaydı & kamera', social: 'Sosyal medya', district: 'İlçe Spor Kompleksi (ikinci şube)', city: 'Şehir Arena', mega: 'Mega Kompleks', franchise: 'Franchise', roof: 'Kapalı çatı', stands: 'Tribün' };
// Gerçek halı saha tadı: bunlar UI'da sabit; ileride config'e taşınabilir.
const START_LINES = ["Abi saat 9'a saha var mı?", 'Yenilen öder maçı!', 'Kaleci bizde, forvet sizde.', 'Halı sahada ayak yapılır, pas verilir.', 'Takım tamam, top bizden!'];
const END_LINES = ['Maç sonrası çaylar bizden.', 'Abi duş sıcak su var mı?', 'Rövanş haftaya, aynı saat!', 'Yenilen öder, çay da sende.'];

const ACH = { first_pitch: 'İlk ek saha', matches100: '100 maç', five_stars: '5 yıldız', first_tournament: 'İlk turnuva', first_venue: 'İlk şube', first_franchise: 'İlk franchise' };
const app = { state: null };
let renderer, hud, panels, tutorial, resetting = false, lastFlavor = 0;

// ---------- yardımcılar ----------
function toast(text, kind = '', ic = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = (ic ? icon(ic) : '') + `<span>${esc(text)}</span>`;
  const box = document.getElementById('toasts'); box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), 3100);
}
app.toast = toast; app.fx = (n) => sfx(n);
app.run = (fn, okMsg, snd = 'buy') => {
  let r; try { r = fn(); } catch (e) { console.error(e); r = { ok: false, reason: 'Bir hata oluştu' }; }
  if (r?.ok) { sfx(snd); vibrate(25); if (okMsg) toast(okMsg, 'good'); panels.render(true); }
  else { sfx('error'); toast(r?.reason || 'Olmadı', 'bad'); }
  return r;
};
app.save = () => { if (!resetting) storage.save(app.state); };
app.reset = () => { resetting = true; storage.wipe(); location.reload(); };
app.tutorialReset = () => tutorial.reset();
app.openEvent = () => eventModal(app);
app.selectPitch = (id) => renderer.select(id);
app.resizeCanvasSoon = () => requestAnimationFrame(() => requestAnimationFrame(() => renderer.resize()));
app.confirmPrestige = () => confirmModal({
  title: 'Franchise olmak istiyor musun?', ok: 'Franchise ol',
  text: `Tüm şubelerin ve paran sıfırlanır, karşılığında +${S.prestigePreview(app.state)} Marka Puanı kazanırsın (kalıcı +%10 gelir/puan).`,
  onOk: () => app.run(() => A.prestige(app.state), 'Yeni sayfa açıldı, patron!', 'levelup'),
});

// ---------- olaylar ----------
function handle(events) {
  const st = app.state, seen = new Set();
  for (const e of events) {
    const mine = !e.venueId || e.venueId === st.activeVenueId;
    switch (e.type) {
      case 'match_start': if (mine && !seen.has('ws')) { seen.add('ws'); sfx('whistle'); flavor(START_LINES, 0.2); } break;
      case 'match_end':
        if (mine) {
          if (e.pitchId && e.amount) { renderer.money(e.pitchId, st, e.amount); const pc = renderer.pitchCenter(e.pitchId); if (pc) coinBurst(pc, Math.min(10, 4 + Math.floor(Math.log10(Math.max(10, e.amount))))); }
          if (!seen.has('we')) { seen.add('we'); sfx('whistle3'); setTimeout(() => sfx('coin'), 900); flavor(END_LINES, 0.2); }
        }
        break;
      case 'level_up': sfx('levelup'); vibrate([40, 30, 60]); levelUpCard(e.payload?.level ?? st.level, e.payload?.gems ?? config.economy.gemsPerLevel); break;
      case 'unlock': { const k = e.payload?.key || e.payload?.feature; unlockCard(e.payload?.name || e.payload?.label || T('unlocks', k, FEATURES[k] || 'Yeni bir özellik')); }; break;
      case 'event_offer': sfx('pop'); eventModal(app); break;
      case 'achievement': toast(`Başarım kazandın: ${ACH[e.payload?.id] || e.payload?.id || ''}`, 'gold', 'trophy'); sfx('levelup'); break;
      case 'mission_done': toast('Görev tamamlandı! Ödülünü Etkinlik sekmesinden al', 'good', 'check'); break;
      case 'weather': toast(st.weather.kind === 'rain' ? 'Yağmur bastırdı, talep düşebilir' : 'Hava açtı, sahalar şenlendi', '', st.weather.kind === 'rain' ? 'rain' : 'sun'); break;
      case 'tournament_end': toast(`Turnuva bitti${e.amount ? ': +' + formatMoney(e.amount) : ''}`, 'gold', 'trophy'); sfx('kaching'); break;
    }
  }
}
function flavor(lines, p) {
  const now = performance.now();
  if (now - lastFlavor < 14000 || Math.random() > p) return;
  lastFlavor = now; toast(lines[Math.floor(Math.random() * lines.length)], '', 'chat');
}

// ---------- döngü ----------
let raf = 0, last = 0, panelT = 0, nightT = 0;
function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min((ts - last) / 1000 || 0.016, 0.5); last = ts;
  const now = Date.now(), st = app.state;
  let ev = []; try { ev = tick(st, dt, now) || []; } catch (e) { console.error(e); }
  if (ev.length) { handle(ev); tutorial.onEvents(ev); }
  hud(st, dt, now);
  const clock = S.clock(st);
  renderer.draw(st, dt, clock, ts / 1000);
  if (ts - panelT > 250) { panelT = ts; panels.render(); }
  if (ts - nightT > 2000) { nightT = ts; setNight(!!clock.isNight); }
}
function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
function stop() { cancelAnimationFrame(raf); raf = 0; }

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); app.save(); stop(); setHidden(true); }
  else {
    setHidden(false);
    if (hiddenAt && Date.now() - hiddenAt > 15000) offline(true);
    hiddenAt = 0; start();
  }
});
addEventListener('pagehide', () => app.save());

function offline(fromResume) {
  const off = applyOffline(app.state, Date.now());
  if (off && off.earned > 0 && off.seconds >= 30) setTimeout(() => offlineCard(app, off), fromResume ? 0 : 1300);
}

// ---------- açılış ----------
function boot() {
  const now = Date.now();
  app.state = storage.load() || createInitialState(now);
  app.state.settings = { sound: true, vibration: true, ...(app.state.settings || {}) };
  bindSettings(() => app.state.settings);
  offline(false);
  renderer = createRenderer(document.getElementById('game'));
  renderer.setHandlers({
    onGoal: (p) => { renderer.goalText(p, app.state); sfx('goal'); },
    onKick: () => sfx('kick'),
    onTap: (h) => {
      sfx('tap');
      if (h.type === 'fac') panels.openTab('tesis', { scroll: `[data-fac=${h.key}]` });
      else if (h.type === 'upg') panels.openTab('saha', { pitch: h.id, scroll: `[data-up=${h.key}]` });
      else if (h.type === 'lot') panels.openTab('saha', { scroll: '#a-newpitch' });
      else panels.openTab('saha', { pitch: h.id, scroll: '#a-pitch' });
    },
  });
  hud = createHud(app);
  panels = createPanels(app);
  tutorial = createTutorial(app, panels);
  new ResizeObserver(() => renderer.resize()).observe(document.getElementById('stage'));
  renderer.resize();
  panels.render(true);
  document.getElementById('btn-settings').onclick = () => { sfx('tap'); settingsModal(app); };
  document.getElementById('venue-switch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-venue]');
    if (b) { A.setActiveVenue(app.state, b.dataset.venue); sfx('tap'); panels.selPitch = null; panels.render(true); }
  });
  // ses ilk dokunuşta açılır (autoplay politikası)
  installUnlock();
  setInterval(app.save, 5000);
  if (app.state.pendingEvent) setTimeout(() => eventModal(app), 1500);
  start();
  setTimeout(() => document.getElementById('splash').classList.add('out'), 1100);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => {});
  app.renderer = renderer;
  window.__game = app; // test / hata ayıklama
}
try { boot(); } catch (e) { console.error(e); document.querySelector('#splash p').textContent = 'Başlatılamadı: ' + e.message; }
