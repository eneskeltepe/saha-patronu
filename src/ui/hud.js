import { selectors as S, config } from '../core/index.js';
import { formatMoney, formatNumber, esc } from './format.js';
import { icon } from './icons.js';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = { money: $('hud-money'), rate: $('hud-rate'), gems: $('hud-gems'), time: $('hud-time'), weather: $('hud-weather'), boost: $('hud-boost'), lv: $('hud-level'), xp: $('hud-xp'), xpt: $('hud-xptxt'), venues: $('venue-switch') };
  $('hud-money-chip').querySelector('.ico').innerHTML = icon('coin');
  document.querySelector('.chip.gems .ico').innerHTML = icon('gem');
  $('btn-settings').innerHTML = icon('gear');
  const cache = {}; let shown = null, vsig = '', rateT = 0, wasMoney = 0;
  const set = (k, node, v) => { if (cache[k] !== v) { cache[k] = v; node.textContent = v; } };
  const html = (k, node, v) => { if (cache[k] !== v) { cache[k] = v; node.innerHTML = v; } };
  function pop(node) { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); }

  return function update(st, dt, now) {
    if (shown === null) shown = st.money;
    if (Math.abs(st.money - shown) < 1) shown = st.money; else shown += (st.money - shown) * Math.min(1, dt * 7);
    const m = formatMoney(shown);
    if (cache.m !== m) { cache.m = m; el.money.textContent = m; if (st.money - wasMoney > Math.max(50, st.money * 0.02)) pop(el.money); }
    wasMoney = st.money;
    const g = formatNumber(st.gems);
    if (cache.g !== g) { if (cache.g) pop(el.gems); set('g', el.gems, g); }
    const c = S.clock(st);
    const dn = DAYS[((((c.day ?? 1) - 1) % 7) + 7) % 7];
    set('t', el.time, `${dn} ${String(Math.floor(c.hour) % 24).padStart(2, '0')}:${String(Math.floor(c.minute || 0)).padStart(2, '0')}`);
    html('w', el.weather, icon(st.weather?.kind === 'rain' ? 'rain' : c.isNight ? 'moon' : 'sun'));
    set('b', el.boost, st.time?.speedBoostUntil > now ? `2x hız ${Math.ceil((st.time.speedBoostUntil - now) / 1000)} sn` : '');
    const lp = S.levelProgress(st), base = config.xpThresholds[lp.level] || 0, need = Math.max(1, (lp.next || 1) - base), cur = Math.max(0, lp.xp - base);
    set('lv', el.lv, String(lp.level)); set('xt', el.xpt, `${formatNumber(cur)}/${formatNumber(need)} XP`);
    const w = `${Math.min(100, (cur / need) * 100).toFixed(1)}%`;
    if (cache.x !== w) { cache.x = w; el.xp.style.width = w; }
    if (now - rateT > 1000) {
      rateT = now;
      const v = st.venues.find((x) => x.id === st.activeVenueId);
      if (v) { const net = S.incomePerHour(st, v.id) - S.salaryPerHour(st, v.id); set('r', el.rate, `${net >= 0 ? '+' : ''}${formatMoney(net)}/sa`); }
    }
    const sig = st.venues.length > 1 ? st.venues.map((v) => v.id + (v.id === st.activeVenueId ? '*' : '') + v.name).join() : '';
    if (sig !== vsig) {
      vsig = sig;
      el.venues.innerHTML = st.venues.length > 1 ? st.venues.map((v) => `<button data-venue="${v.id}" class="${v.id === st.activeVenueId ? 'on' : ''}">${esc(v.name)}</button>`).join('') : '';
    }
  };
}
