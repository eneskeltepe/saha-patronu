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
