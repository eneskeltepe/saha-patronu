// Modal kartlar: seviye atlama, açılan özellik, olay, çevrimdışı kazanç, ayarlar, onay.
import { selectors as S, actions as A } from '../core/index.js';
import { formatMoney, esc } from './format.js';
import { icon } from './icons.js';
import { showRewardedAd } from '../monetize.js';
import { applySettings } from './audio.js';

const root = document.getElementById('modal-root');
const queue = []; let cur = null;

/** opts: {badge:'gold|green|blue', ic, title, text, html, buttons:[{label,cls,keep,onClick}], sound} */
export function showModal(opts, front = false) {
  front ? queue.unshift(opts) : queue.push(opts);
  if (!cur) next();
}
export function closeModal() { cur?.el.remove(); cur = null; setTimeout(next, 60); }
function next() {
  const o = queue.shift(); if (!o) return;
  const el = document.createElement('div'); el.className = 'modal-back';
  el.innerHTML = `<div class="modal-card" role="dialog">${o.ic ? `<div class="modal-badge ${o.badge || 'gold'}">${icon(o.ic)}</div>` : ''}<h3>${o.title || ''}</h3>${o.text ? `<p>${o.text}</p>` : ''}${o.html || ''}<div class="mbtns">${(o.buttons || []).map((b, i) => `<button class="btn ${b.cls || 'primary'} block" data-b="${i}">${b.label}</button>`).join('')}</div></div>`;
  root.appendChild(el); cur = { el, o };
  o.onMount?.(el);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const def = o.buttons[+b.dataset.b];
    if (def.keep) { def.onClick?.(el); return; }
    closeModal(); def.onClick?.();
  });
}

export function levelUpCard(level, gems) {
  showModal({ ic: 'star', title: `Seviye ${level}!`, text: gems ? `Tebrikler patron! ${gems} elmas kazandın.` : 'Tebrikler patron, işler büyüyor!', buttons: [{ label: 'Devam' }] });
}
export function unlockCard(label) {
  showModal({ ic: 'lock', badge: 'green', title: 'Yeni özellik açıldı!', text: esc(label), buttons: [{ label: 'Harika' }] });
}

export function offlineCard(app, off) {
  showModal({
    ic: 'coin', title: 'Hoş geldin patron!', text: 'Siz yokken sahalar boş durmadı.',
    html: `<div class="big">${formatMoney(off.earned)}</div><p>Siz yokken ${formatMoney(off.earned)} kazandınız${off.cappedHours ? ` (en fazla ${off.cappedHours} saat)` : ''}</p>`,
    buttons: [
      { label: `${icon('play')} Reklam izle 2x`, cls: 'gold', onClick: async () => { if (await showRewardedAd('offline2x')) app.run(() => A.grantReward(app.state, 'offline2x'), 'Kazanç ikiye katlandı!', 'coin'); } },
      { label: 'Topla', cls: 'ghost' },
    ],
  });
}

export function eventModal(app) {
  const ev = S.eventView(app.state); if (!ev) return;
  showModal({
    ic: 'chat', title: esc(ev.title), text: esc(ev.text), sound: 'pop',
    html: '',
    buttons: [
      ...ev.choices.map((c, i) => ({ label: `<span style="text-align:left;display:block;width:100%"><b>${esc(c.label)}</b>${c.cost ? ` · ${formatMoney(c.cost)}` : ''}<br><small style="opacity:.75;font-weight:600">${esc(c.hint || '')}</small></span>`, cls: 'ghost', onClick: () => app.run(() => A.resolveEvent(app.state, i)) })),
      { label: 'Sonra karar ver', cls: 'ghost', onClick: () => {} },
    ],
  }, true);
}

export function confirmModal({ title, text, ok = 'Evet', danger, onOk }) {
  showModal({ ic: 'lock', badge: 'blue', title, text, buttons: [{ label: ok, cls: danger ? 'danger' : 'primary', onClick: onOk }, { label: 'Vazgeç', cls: 'ghost' }] }, true);
}

export function settingsModal(app) {
  const s = app.state.settings;
  const row = (key, ic, name) => `<div class="set-row">${icon(ic)}<span class="grow" style="text-align:left;font-weight:700">${name}</span><button class="sw ${s[key] !== false ? 'on' : ''}" data-sw="${key}" aria-label="${name}"></button></div>`;
  const sl = (key, name, dflt) => `<div class="set-row"><span style="width:92px;text-align:left;font-size:12px;color:var(--dim)">${name}</span><input type="range" class="grow" min="0" max="1" step="0.05" value="${s[key] ?? dflt}" data-sl="${key}"></div>`;
  showModal({
    ic: 'gear', badge: 'blue', title: 'Ayarlar',
    html: row('music', 'music', 'Müzik') + row('sound', 'volume', 'Ses efektleri') + row('vibration', 'vib', 'Titreşim') + sl('volume', 'Ana ses', 0.8) + sl('musicVol', 'Müzik sesi', 0.55) + sl('sfxVol', 'Efekt sesi', 0.8) + '<div style="height:10px"></div>',
    onMount(el) {
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-sw]'); if (!b) return; const k = b.dataset.sw; s[k] = s[k] === false; b.classList.toggle('on', s[k] !== false); applySettings(); app.save(); });
      el.addEventListener('input', (e) => { const r = e.target.closest('[data-sl]'); if (!r) return; s[r.dataset.sl] = +r.value; applySettings(); });
      el.addEventListener('change', () => app.save());
    },
    buttons: [
      { label: `${icon('trash')} Kaydı sıfırla`, cls: 'danger', onClick: () => confirmModal({ title: 'Emin misin patron?', text: 'Bütün ilerleme silinecek. Bu geri alınamaz.', ok: 'Evet, sıfırla', danger: true, onOk: () => app.reset() }) },
      { label: 'Kapat', cls: 'ghost' },
    ],
  }, true);
}
