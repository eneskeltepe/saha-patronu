// Başsız tempo testi: açgözlü bir oyuncu simülasyonu. Kullanım: node proto/tools/pace.mjs [dakika] [tohum]
import { World, newSave, costFor, stats } from '../src/sim.js';
import { STATIONS, ORDER, GOALS, CFG } from '../src/config.js';
import assert from 'node:assert';

const MIN = +(process.argv[2] || 75);
let seed = +(process.argv[3] || 1);
Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // tekrarlanabilir

// kendi kendine kontrol: maliyet/istatistik formülleri
assert.equal(costFor('gise', 1, 1, 1e9).levels, 1);
assert.ok(stats('saha1', 25).lights && !stats('saha1', 24).lights);
assert.equal(stats('gise', 10).cap, 2);

const log = [];
const s = newSave();
let earned = 0, lastE = 0; const rates = [];
const w = new World(s, (ev, d) => {
  if (ev === 'earn') earned += d.amt;
  if (ev === 'milestone') log.push([w.time, `kilometre taşı: ${STATIONS[d.id].name} Sv${CFG.milestones[d.i]} (${d.txt})`]);
  if (ev === 'build') log.push([w.time, `inşa: ${STATIONS[d.id].name}`]);
  if (ev === 'hire') log.push([w.time, `yönetici: ${STATIONS[d.id].name}`]);
});
w.headless = true;
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, ' ')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const goalTimes = [];
let firstBuy = null, buys = 0, buyTimes = [];
const DT = 0.1;
let collectT = 0, thinkT = 0;

function think() {
  // hedef ödülünü al
  if (s.goalReady) { const g = w.claimGoal(); goalTimes.push([w.time, g.txt]); }
  const g = w.goal();
  // 1) hedefin istediği şey alınabiliyorsa al
  if (g) {
    if (g.type === 'build' && w.build(g.st)) return true;
    if (g.type === 'manager' && w.hire(g.st)) return true;
    if (g.type === 'level' && w.upgrade(g.st, 1)) return true;
  }
  // 2) ucuz yönetici (kazancın ~2 dk'sından ucuzsa)
  // 3) en ucuz yükseltme / inşa (hedef inşa için birikim yapıyorsa, ucuzları maliyetin %10'una kadar al)
  const reserve = g && (g.type === 'build' || g.type === 'manager') ? (g.type === 'build' ? STATIONS[g.st].build : STATIONS[g.st].mgr) : 0;
  let best = null, bc = Infinity;
  for (const id of ORDER) {
    const st = s.st[id]; if (!st.built) continue;
    const c = costFor(id, st.lvl, 1, s.money).cost;
    if (c < bc) { bc = c; best = id; }
  }
  if (best && bc <= s.money && (!reserve || bc < reserve * 0.08)) return w.upgrade(best, 1) > 0;
  return false;
}

for (let i = 1; i <= MIN * 600; i++) {
  w.update(DT);
  collectT += DT; thinkT += DT;
  if (collectT >= 3) { collectT = 0; for (const id of ORDER) w.collect(id); }
  if (thinkT >= 1) {
    thinkT = 0;
    let k = 0; while (k++ < 20 && think()) { buys++; if (firstBuy == null) firstBuy = w.time; if (buyTimes.length < 40) buyTimes.push(w.time); }
  }
  if (i % 600 === 0) { rates.push(`${Math.round(w.time / 60)}dk:${Math.round((earned - lastE) / 60)}/sn`); lastE = earned; }
  if (!w.goal() && !s.goalReady) break;
}
log.sort((a, b) => a[0] - b[0]);
console.log(`ilk alım: ${fmt(firstBuy)}  | ilk 3 dk alım sayısı: ${buyTimes.filter((x) => x < 180).length}  | toplam alım: ${buys}`);
console.log('--- olaylar ---'); for (const [t, m] of log) console.log(fmt(t), m);
console.log('--- hedefler ---'); goalTimes.forEach(([t, m], i) => console.log(fmt(t), `#${i + 1}`, m));
console.log(`bitti: ${goalTimes.length}/${GOALS.length} hedef, süre ${fmt(w.time)}, maç ${s.matches}, kaçan müşteri ${s.lost}, para ${Math.floor(s.money)}`);
console.log('gelir:', rates.filter((_, i) => [0,1,2,4,7,9,14,19,29,39,49,59].includes(i)).join(' '));
console.log('seviyeler:', ORDER.map((id) => `${id}:${s.st[id].lvl}`).join(' '));
