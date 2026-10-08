// Tamamen sentezlenmiş ses: müzik döngüsü + efektler (dış dosya yok).
// Ayarlar (state.settings): sound (efekt), music, volume 0..1, musicVol 0..1, sfxVol 0..1
let ac = null, master, musicBus, musicLP, sfxBus, noiseBuf;
let getSettings = () => ({});
let night = false, hidden = false, started = false, timer = null, gesture = false;
let nextT = 0, step = 0, bar = 0, lastSfx = {};

const BPM = 104, SPS = 60 / BPM / 4; // saniye / 16'lık
const S = () => { const s = getSettings() || {}; return {
  sound: s.sound !== false, music: s.music !== false,
  vol: s.volume ?? 0.8, mv: s.musicVol ?? 0.55, sv: s.sfxVol ?? 0.8, vib: s.vibration !== false }; };

export function bindSettings(fn) { getSettings = fn; }

function ensure() {
  if (ac) return ac;
  if (!gesture) return null; // AudioContext yalnızca kullanıcı dokunuşundan sonra

  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ac.createGain(); master.connect(comp); comp.connect(ac.destination);
    musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 5000;
    musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(musicLP); musicLP.connect(master);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
  return ac;
}

export function applySettings() {
  if (!ac) return;
  const s = S(), t = ac.currentTime;
  master.gain.setTargetAtTime(s.vol, t, 0.05);
  sfxBus.gain.setTargetAtTime(s.sound ? 0.9 * s.sv : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(s.music && !hidden ? 0.42 * s.mv : 0, t, s.music ? 1.2 : 0.1);
  if (s.music && !hidden) startMusic(); else stopMusic();
}
// ilk dokunuşta çağrılır (autoplay politikası)
export function unlockAudio() {
  gesture = true;
  if (!ensure()) return;
  if (ac.state === 'suspended') ac.resume();
  started = true; applySettings();
}
// İlk kullanıcı hareketinde (dokunma/tık/tuş) bağlamı oluşturur ve dinleyicileri söker.
export function installUnlock() {
  const evs = ['pointerup', 'touchend', 'click', 'keydown'];
  const h = () => { unlockAudio(); if (ac && ac.state === 'running') evs.forEach((e) => removeEventListener(e, h, true)); };
  evs.forEach((e) => addEventListener(e, h, true));
}
export function setHidden(h) {
  hidden = h; if (!ac) return;
  if (h) { musicBus.gain.setTargetAtTime(0, ac.currentTime, 0.05); setTimeout(() => hidden && ac.suspend(), 250); }
  else { ac.resume(); applySettings(); }
}
export function setNight(n) {
  if (night === n) return; night = n;
  if (ac) musicLP.frequency.setTargetAtTime(n ? 1400 : 5000, ac.currentTime, 2);
}

// ---------- müzik ----------
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
// gündüz: Am F C G  | gece: Am Dm F E  (kök MIDI, minör mü)
const PROG_DAY = [[57, 1], [53, 0], [48, 0], [55, 0]];
const PROG_NIGHT = [[57, 1], [50, 1], [53, 0], [52, 0]];
// melodi motifleri: akor havuzu indeksleri (-1 sus)
const MOTIFS = [
  [3, -1, 4, -1, 5, -1, 4, 3, -1, 3, 2, -1, 3, -1, -1, -1],
  [5, -1, 4, 3, -1, 4, -1, 2, 3, -1, -1, 2, 1, -1, 2, -1],
  [3, 4, 5, -1, 6, -1, 5, -1, 4, -1, 3, -1, 4, 3, -1, -1],
  [-1, 3, -1, 4, 5, -1, -1, 4, 3, -1, 2, 3, -1, -1, 1, -1],
];
function pool(root, minor) { const r = root + 12; return [r - 12, r - 9 + (minor ? 0 : 1), r - 5, r, r + (minor ? 3 : 4), r + 7, r + 12, r + 15]; }

function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(dest, f, t, dur, type, vol, lpf) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; env(g, t, 0.008, dur, vol);
  let out = g;
  if (lpf) { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.setValueAtTime(lpf * 2.5, t); b.frequency.exponentialRampToValueAtTime(lpf, t + dur); o.connect(b); b.connect(g); }
  else o.connect(g);
  g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dest, t, dur, vol, type, freq, q = 1) {
  const n = ac.createBufferSource(); n.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); env(g, t, 0.003, dur, vol);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + dur + 0.05);
}
function kick(t, v) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.004, 0.2, v); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
}

function playStep(t, st, b) {
  const sec = Math.floor(b / 8) % 4, prog = night ? PROG_NIGHT : PROG_DAY;
  const [root, minor] = prog[b % 4], p = pool(root, minor);
  const kv = night ? 0.5 : 0.75;
  // davul
  if (st === 0 || st === 10 || (st === 6 && sec % 2 === 1) || (st === 14 && sec === 3 && b % 8 === 7)) kick(t, kv);
  if (st === 4 || st === 12) { noise(musicBus, t, 0.14, night ? 0.18 : 0.3, 'bandpass', 1800, 0.8); tone(musicBus, 190, t, 0.08, 'triangle', 0.12); }
  if (st % 2 === 0) noise(musicBus, t, 0.04, (st % 4 === 2 ? 0.1 : 0.06) * (night ? 0.6 : 1), 'highpass', 7500);
  if (!night && sec >= 1 && st % 4 === 3) noise(musicBus, t, 0.03, 0.04, 'highpass', 9000);
  // bas
  const bf = m2f(root - 12);
  if (st === 0 || st === 3 || st === 8 || st === 11 || (st === 14 && sec > 0)) tone(musicBus, st === 11 || st === 14 ? bf * 2 : bf, t, SPS * 2.4, 'triangle', 0.5, 600);
  // pad
  if (st === 0) [0, minor ? 3 : 4, 7].forEach((i) => tone(musicBus, m2f(root + i), t, SPS * 15, 'sine', night ? 0.1 : 0.06));
  // melodi (pluck)
  const motif = MOTIFS[(sec + (b % 4 === 3 ? 1 : 0)) % MOTIFS.length][st];
  const play = night ? st % 2 === 0 : true;
  if (motif >= 0 && play && !(sec === 3 && b % 8 < 2)) tone(musicBus, m2f(p[motif] + (night ? -12 : 0)), t, night ? SPS * 3 : SPS * 1.9, night ? 'sine' : 'triangle', night ? 0.2 : 0.26, 2200);
  // kontra arp (8 barlık bölümlerden 2. ve 3.'te)
  if (!night && (sec === 1 || sec === 2) && st % 4 === 2) tone(musicBus, m2f(p[2 + (st >> 2) % 3] + 12), t, SPS * 1.2, 'square', 0.05, 3000);
}
function schedule() {
  if (!ac || hidden) return;
  while (nextT < ac.currentTime + 0.25) {
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    playStep(nextT, step, bar);
    nextT += SPS; step++; if (step === 16) { step = 0; bar++; }
  }
}
function startMusic() { if (timer || !ac) return; nextT = ac.currentTime + 0.1; timer = setInterval(schedule, 80); }
function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

// ---------- efektler ----------
function whistle(t, dur, f = 2850) {
  const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
  o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 38; lg.gain.value = 90; lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
  g.gain.setValueAtTime(0.28, t + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  noise(sfxBus, t, dur, 0.06, 'bandpass', 3500, 2);
}
function cheer(t, dur, v) {
  const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1500, t + dur * 0.4); f.frequency.linearRampToValueAtTime(700, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.1);
}
const SFX = {
  tap: (t) => tone(sfxBus, 900, t, 0.04, 'sine', 0.08),
  coin: (t) => { tone(sfxBus, 1976, t, 0.1, 'triangle', 0.12); tone(sfxBus, 2637, t + 0.06, 0.2, 'triangle', 0.1); },
  kaching: (t) => {
    noise(sfxBus, t, 0.05, 0.3, 'highpass', 4000);
    tone(sfxBus, 1568, t + 0.06, 0.5, 'sine', 0.2); tone(sfxBus, 2093, t + 0.12, 0.7, 'sine', 0.16); tone(sfxBus, 3136, t + 0.12, 0.5, 'sine', 0.06);
    [0.2, 0.26, 0.32].forEach((d, i) => tone(sfxBus, 3500 + i * 300, t + d, 0.08, 'triangle', 0.06));
  },
  buy: (t) => SFX.kaching(t),
  levelup: (t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(sfxBus, f, t + i * 0.1, 0.35, 'triangle', 0.16); tone(sfxBus, f / 2, t + i * 0.1, 0.35, 'sine', 0.1); }); tone(sfxBus, 1568, t + 0.55, 0.9, 'triangle', 0.16); },
  pop: (t) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.1); env(g, t, 0.005, 0.15, 0.15); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.25); },
  error: (t) => { tone(sfxBus, 140, t, 0.2, 'sawtooth', 0.12, 500); tone(sfxBus, 110, t + 0.12, 0.25, 'sawtooth', 0.12, 500); },
  whistle: (t) => whistle(t, 0.35),
  whistle3: (t) => { whistle(t, 0.22); whistle(t + 0.35, 0.22); whistle(t + 0.7, 0.6, 2750); },
  kick: (t) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08); env(g, t, 0.003, 0.1, 0.35); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.2); noise(sfxBus, t, 0.04, 0.15, 'lowpass', 900); },
  cheer: (t) => cheer(t, 2.4, 0.45),
  goal: (t) => { cheer(t, 3.2, 0.55); noise(sfxBus, t + 0.05, 0.3, 0.2, 'bandpass', 250, 1); },
};
const COOL = { coin: 0.12, kick: 0.25, tap: 0.04, cheer: 1, goal: 2, kaching: 0.12, whistle: 0.5, whistle3: 1.5, levelup: 0.6, pop: 0.15, error: 0.3 };
let budgetT = 0, budget = 0; // genel sınır: saniyede en fazla ~10 efekt (ses düğümü yığılmasın)
export function sfx(name) {
  if (!S().sound || !ensure() || hidden) return;
  const now = ac.currentTime;
  if ((lastSfx[name] || -9) + (COOL[name] ?? 0) > now) return;
  if (now - budgetT > 1) { budgetT = now; budget = 0; }
  if (++budget > 10) return;
  lastSfx[name] = now;
  try { SFX[name]?.(now + 0.01); } catch { /* ses opsiyonel */ }
}
export function vibrate(ms = 20) {
  if (!S().vib) return;
  try { navigator.vibrate?.(ms); } catch { /* yok say */ }
}
