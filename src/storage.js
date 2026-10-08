import { migrate } from './core/index.js';
const KEY = 'sahaPatronu.save', BAK = KEY + '_bak';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const parse = (s) => { try { const o = JSON.parse(s); return o && typeof o === 'object' ? migrate(o) : null; } catch { return null; } };

/** Kayıt -> yedek -> null (çağıran yeni oyun açar). */
export function load() { return parse(read(KEY)) || parse(read(BAK)) || null; }

export function save(state, now = Date.now()) {
  try {
    state.lastSavedAt = now;
    const json = JSON.stringify(state);
    const prev = read(KEY);
    if (prev && parse(prev)) localStorage.setItem(BAK, prev); // yalnızca sağlam kaydı yedeğe al
    localStorage.setItem(KEY, json);
    return true;
  } catch { return false; }
}
export function wipe() { try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch { /* yok say */ } }
