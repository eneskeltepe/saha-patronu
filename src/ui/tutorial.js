// İlk kez oynayanlar için kısa rehber (coach-mark). İlerleme state.settings.tutorial içinde (sayı | 'done').
import { selectors as S } from '../core/index.js';

export function createTutorial(app, panels) {
  const steps = [
    { id: 'match', target: '#sheet-title', pad: 0, noSpot: true, text: 'Burası senin sahan! İlk müşteriler geliyor, maçı izle.', ok: 'Tamam', onEvent: 'match_end' },
    { id: 'income', target: '#hud-money-chip', text: 'Maç bitince kazanç buraya akar. Biriktir, sahanı büyüt!' },
    { id: 'repair', target: '[data-act=repair]', tab: 'saha', text: 'Her maç sahayı biraz yıpratır. Bakım yap, fiyatın düşmesin.' },
    { id: 'turf', target: '[data-act=upg][data-k=turf]', tab: 'saha', text: 'İlk yatırım: Zemin. Daha iyi çim, daha yüksek saat ücreti demek.' },
    { id: 'tesis', target: '[data-tab=tesis]', when: () => S.isUnlocked(app.state, 'cafe'), text: 'Kafeterya açıldı! Tesis sekmesinden çay ocağı kur, maç başı ekstra kazan.' },
    { id: 'lights', target: '[data-act=upg][data-k=lights]', tab: 'saha', text: 'Işık al ki akşam maçları kaçmasın. Talep akşam patlar!' },
  ];
  const spot = document.createElement('div'), card = document.createElement('div');
  spot.className = 'coach-spot'; card.className = 'coach-card';
  card.innerHTML = '<p></p><div class="coach-btns"><button class="btn ghost" data-skip>Atla</button><button class="btn primary" data-ok>Tamam</button></div><i class="coach-arrow"></i>';
  document.body.append(spot, card);
  spot.style.display = card.style.display = 'none';
  const txt = card.querySelector('p'), arrow = card.querySelector('.coach-arrow');
  let shownFor = -1, opened = -1, since = 0;

  const settings = () => (app.state.settings ||= {});
  if (settings().tutorial === undefined) {
    const st = app.state;
    settings().tutorial = (st.stats?.matches > 0 || st.level > 1 || st.prestiges > 0 || st.brandPoints > 0) ? 'done' : 0;
  }
  const idx = () => settings().tutorial;
  const advance = () => { const i = idx(); if (typeof i !== 'number') return; settings().tutorial = i + 1 >= steps.length ? 'done' : i + 1; shownFor = -1; since = 0; app.save(); };
  const finish = () => { settings().tutorial = 'done'; hide(); app.save(); };
  const hide = () => { spot.style.display = card.style.display = 'none'; };

  card.addEventListener('click', (e) => { if (e.target.closest('[data-skip]')) finish(); else if (e.target.closest('[data-ok]')) advance(); });
  document.addEventListener('click', (e) => { const i = idx(); if (typeof i !== 'number') return; const s = steps[i]; if (s && s.target.startsWith('[') && e.target.closest(s.target)) setTimeout(advance, 250); }, true);

  function update() {
    const i = idx();
    if (typeof i !== 'number' || !steps[i]) return hide();
    const s = steps[i];
    if (document.querySelector('.modal-back') || (s.when && !s.when())) return hide();
    if (shownFor !== i) { shownFor = i; since = performance.now(); opened = -1; txt.textContent = s.text; }
    if (s.tab && opened !== i) { opened = i; if (panels.currentTab() !== s.tab) panels.openTab(s.tab); }
    const el = document.querySelector(s.target);
    if (el && s.tab && opened === i) el.scrollIntoView?.({ block: 'nearest' });
    if (!el) {
      // hedef yok (ör. kilitli/yanlış sekme): kartı ortada, spot'suz göster
      spot.style.display = 'none'; card.style.display = 'block'; card.style.left = '50%'; card.style.top = '38%'; card.style.bottom = 'auto'; card.style.transform = 'translateX(-50%)'; arrow.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect(), pad = s.pad ?? 6, vw = innerWidth, vh = innerHeight;
    if (r.width === 0) return hide();
    spot.style.display = card.style.display = 'block';
    spot.style.left = r.left - pad + 'px'; spot.style.top = r.top - pad + 'px'; spot.style.width = r.width + pad * 2 + 'px'; spot.style.height = r.height + pad * 2 + 'px';
    const cw = Math.min(300, vw - 24), below = r.top + r.height / 2 < vh / 2;
    card.style.width = cw + 'px'; card.style.transform = 'none'; arrow.style.display = 'block';
    const left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2));
    card.style.left = left + 'px';
    if (s.noSpot) { spot.style.display = 'none'; card.style.bottom = 'auto'; card.style.top = r.bottom + 4 + 'px'; arrow.className = 'coach-arrow up'; arrow.style.display = 'none'; card.style.left = Math.max(12, (vw - cw) / 2) + 'px'; return; }
    else if (below) { card.style.top = r.bottom + pad + 16 + 'px'; card.style.bottom = 'auto'; arrow.className = 'coach-arrow up'; }
    else { card.style.bottom = vh - r.top + pad + 16 + 'px'; card.style.top = 'auto'; arrow.className = 'coach-arrow down'; }
    arrow.style.left = Math.max(16, Math.min(cw - 32, r.left + r.width / 2 - left - 8)) + 'px';
  }
  setInterval(update, 300);
  addEventListener('resize', update);
  return {
    onEvents(evs) { const i = idx(); if (typeof i !== 'number') return; const s = steps[i]; if (s?.onEvent && evs.some((e) => e.type === s.onEvent)) setTimeout(advance, 1500); },
    reset() { settings().tutorial = 0; shownFor = -1; },
  };
}
