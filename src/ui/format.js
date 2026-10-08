// Türkçe sayı/para biçimi: 12.400₺, 450K₺, 1,2M₺, 3,4B₺
const grp = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dec = (x) => (Math.floor(x * 10) / 10).toString().replace('.', ',');

export function formatNumber(n) {
  n = Number(n);
  if (!isFinite(n)) n = 0;
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a < 1e5) return s + grp(a);
  if (a < 1e6) return s + Math.floor(a / 1e3) + 'K';
  if (a < 1e9) return s + dec(a / 1e6) + 'M';
  if (a < 1e12) return s + dec(a / 1e9) + 'B';
  return s + dec(a / 1e12) + 'T';
}
export const formatMoney = (n) => formatNumber(n) + '₺';

export function formatClock(c) {
  const h = String(Math.floor(c.hour) % 24).padStart(2, '0');
  const m = String(Math.floor(c.minute || 0)).padStart(2, '0');
  return `${h}:${m}`;
}
export function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk`;
  return `${sec} sn`;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "Saha 1" -> "1 Nolu Saha"; çatılı sahaya "Kapalı Saha" (halı saha ağzıyla)
import { pitchLabel } from './texts.js';
export function pitchName(p) {
  const cfg = pitchLabel(p); if (cfg) return cfg;
  const m = /^(?:Saha (\d+)|(\d+) Nolu Saha)$/.exec(p?.name || '');
  if (!m) return p?.name || 'Saha';
  const n = m[1] || m[2];
  return (p.upgrades?.roof || 0) > 0 ? `${n} Nolu Kapalı Saha` : `${n} Nolu Saha`;
}
