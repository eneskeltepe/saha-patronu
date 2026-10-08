// Metinler: önce config.texts (core), yoksa buradaki yedekler.
import { config } from '../core/index.js';

const FALLBACK_LINES = {
  neighborhood: ["Abi saat 9'a saha var mı?", 'Yenilen öder maçı!', 'Kaleci ben olurum.', 'Top bizden, çay sizden.', 'Pas ver, pas!'],
  company: ['Toplantı bitti, maç başlasın!', 'Müdür bey kaleye!', 'Fatura şirketten.', 'Stres atma vakti.'],
  veteran: ['Dizim tutarsa gol atarım.', 'Eskiden bu saha topraktı.', 'Sabah maçı en güzeli.'],
  women: ['Bugün rövanş var, hazırız!', 'Tribüne gelin, alkış bekliyoruz!'],
  academy: ['Hocam top bende!', 'Anne bak, gol attım!'],
  keeper: ['Zemin tıkır, abi.', 'Çimi taradım, hazır.', 'Çizgileri yeniden çektim.'],
  tea: ['Bir çay daha, abi!', 'Çay demli, simit sıcak.', 'Yenilen öder çayı.'],
  waiting: ['Abi sıradayız, kaç dakika?', 'Saha boşalınca haber ver.', 'Takım tamam, bekliyoruz.'],
};
export function lines(type) {
  const c = config.texts?.customerLines;
  const arr = (c && (Array.isArray(c[type]) ? c[type] : null)) || FALLBACK_LINES[type] || FALLBACK_LINES.neighborhood;
  return arr.length ? arr : FALLBACK_LINES.neighborhood;
}

/** config.texts[group][id] -> string | {name,text,title,desc} | function(arg). */
export function text(group, id, fallback, arg) {
  let v = config.texts?.[group];
  if (Array.isArray(v)) v = v.find((x) => x?.id === id);
  else if (v && typeof v === 'object') v = v[id];
  if (typeof v === 'function') v = v(arg);
  const fill = (s) => String(s).replace(/\{(\w+)\}/g, (_, k) => (arg && arg[k] != null ? (k === 'target' && arg.target >= 1000 ? Math.floor(arg.target).toLocaleString('tr-TR') : arg[k]) : ''));
  if (typeof v === 'string') return fill(v);
  if (v && typeof v === 'object') return fill(v.name || v.title || v.text || fallback);
  return fallback;
}
export function textDesc(group, id, fallback) {
  let v = config.texts?.[group];
  if (Array.isArray(v)) v = v.find((x) => x?.id === id); else if (v && typeof v === 'object') v = v[id];
  return (v && typeof v === 'object' && (v.desc || v.description)) || fallback;
}
/** Saha adı: config.texts.pitchNames varsa onu kullanır. */
export function pitchLabel(p) {
  const pn = config.texts?.pitchNames, m = /^Saha (\d+)$/.exec(p?.name || '');
  const n = m ? +m[1] : null, roof = (p?.upgrades?.roof || 0) > 0;
  if (Array.isArray(pn)) return null;
  if (typeof pn === 'function') { try { const r = pn(p, n); if (typeof r === 'string') return r; } catch { /* yedek */ } }
  else if (pn && typeof pn === 'object') {
    const t = roof ? (pn.roof ?? pn.covered) : (pn.default ?? pn.normal ?? pn.pitch);
    if (typeof t === 'string') return t.replace('{n}', n ?? '');
    if (n && typeof pn[n] === 'string') return pn[n];
  }
  return null;
}
