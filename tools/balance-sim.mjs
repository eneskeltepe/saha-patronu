import { createInitialState, tick, applyOffline, actions as A, selectors as S, config as C } from '../src/core/index.js';
import { offlineEstimate } from '../src/core/sim.js';

const milestones = ['2. saha','Aydınlatma sv1','Kafeterya','Sv5','Sv10','2. şube','Sv20 / franchise'];
function optimizePrices(s) {
  if (!S.isUnlocked(s,'price')) return;
  for (const v of s.venues) for (const p of v.pitches) {
    const ref = S.referencePrice(s,v.id,p.id);
    let best = -Infinity, price = ref;
    for (const ratio of C.balance.priceRatios) {
      A.setPrice(s,v.id,p.id,ref*ratio);
      const income = S.incomePerHour(s,v.id);
      if (income > best) { best = income; price = ref*ratio; }
    }
    A.setPrice(s,v.id,p.id,price);
  }
}
const net = s => S.incomePerHour(s)-S.salaryPerHour(s);
function decide(s,casualMode = false) {
  if (s.pendingEvent) A.resolveEvent(s,0);
  for (const m of s.missions.list) if (!m.claimed && m.progress >= m.target) A.claimMission(s,m.id);
  for (const v of s.venues) for (const p of v.pitches) if (p.condition < C.balance.repairBelow) A.repairPitch(s,v.id,p.id);
  optimizePrices(s);
  for (let purchases = 0; purchases < C.balance.maxPurchases; purchases++) {
    const expectedValue = n => casualMode ? net(n) + offlineEstimate(n,C.time.secondsPerDay/C.balance.sessionsPerDay-C.balance.sessionSeconds).earned / (C.balance.sessionSeconds/C.time.secondsPerHour) : net(n);
    const base = expectedValue(s), candidates = [];
    for (const v of s.venues) {
      if (v.pitches.length < C.venues.find(t => t.id === v.typeId).capacity) candidates.push({ cost: S.pitchCost(s,v.id), run: n => A.buyPitch(n,v.id) });
      for (const p of v.pitches) for (const key of Object.keys(C.upgrades)) if (p.upgrades[key] < C.upgrades[key].max && s.level >= C.upgrades[key].unlock) candidates.push({ cost: S.upgradeCost(s,v.id,p.id,key), run: n => A.upgradePitch(n,v.id,p.id,key) });
      for (const key of Object.keys(C.facilities)) if (v.facilities[key] < C.economy.maxLevel && s.level >= C.facilities[key].unlock) candidates.push({ cost: S.facilityCost(s,v.id,key), run: n => A.upgradeFacility(n,v.id,key) });
      for (const key of Object.keys(C.staff)) if (v.staff[key] < C.economy.maxLevel && s.level >= C.staff[key].unlock) candidates.push({ cost: S.staffCost(s,v.id,key), run: n => A.hireOrUpgradeStaff(n,v.id,key), keeper: key === 'keeper', venueId: v.id });
    }
    for (const v of C.venues) if (s.level >= v.unlock && !s.venues.some(x => x.typeId === v.id)) candidates.push({ cost: v.cost, run: n => A.buyVenue(n,v.id) });
    let best;
    for (const c of candidates) {
      const copy = structuredClone(s); copy.money = C.maxMoney;
      if (!c.run(copy).ok) continue;
      let gain = expectedValue(copy)-base;
      // Görevli satın alımında gelecekteki bakım masrafı tasarrufu da getiriye dahildir.
      if (c.keeper) {
        const v = s.venues.find(v => v.id === c.venueId);
        if (v.staff.keeper === 0) gain += v.pitches.reduce((sum,p) => sum + C.economy.wear*C.economy.repairPerCondition*S.bookingChance(s,v.id,p.id,C.hours.eveningStart),0);
      }
      c.score = gain/c.cost;
      if (gain > 0 && (!best || c.score > best.score)) best = c;
    }
    // En iyi getiri için biriktir. Daha ucuz ama daha kötü yatırımı alma.
    if (!best || s.money < best.cost || !best.run(s).ok) break;
    optimizePrices(s);
  }
}
function record(s,times,elapsed,mode) {
  const first = s.venues[0];
  const conditions = [first.pitches.length >= 2, first.pitches.some(p => p.upgrades.lights >= 1), first.facilities.cafe >= 1, s.level >= 5, s.level >= 10, s.venues.length >= 2, s.level >= 20 && S.prestigePreview(s) > 0];
  conditions.forEach((met,i) => { if (met && times[milestones[i]] === undefined) { times[milestones[i]] = elapsed; console.log(`${mode}: ${milestones[i]} = ${(elapsed/C.time.minutesPerHour).toFixed(1)} gerçek dk`); } });
}
function active(early = false) {
  const s = createInitialState(0); s.seed = C.balance.seed;
  const times = {}; let elapsed = 0;
  const limit = early ? C.balance.earlySeconds : C.balance.activeDays*C.time.secondsPerDay;
  while (elapsed < limit && times[milestones.at(-1)] === undefined) {
    elapsed += C.balance.stepSeconds;
    tick(s,C.balance.stepSeconds,elapsed*C.time.msPerSecond);
    if (elapsed % C.balance.decisionSeconds === 0) decide(s);
    record(s,times,elapsed,'Aktif');
    if (elapsed % C.time.secondsPerDay === 0) console.log(`Aktif gün ${elapsed/C.time.secondsPerDay}: toplam kazanç ${Math.round(s.totalEarned)}₺`);
  }
  const result = { times, level: s.level, money: Math.round(s.money) };
  result.prestigeOk = times[milestones.at(-1)] !== undefined && A.prestige(s).ok;
  return result;
}
function casual() {
  const s = createInitialState(0); const times = {}; let elapsed = 0;
  const gap = C.time.secondsPerDay/C.balance.sessionsPerDay;
  for (let day = 0; day < C.balance.casualDays; day++) {
    for (let session = 0; session < C.balance.sessionsPerDay; session++) {
      const start = day*C.time.secondsPerDay+session*gap;
      if (start > elapsed) { elapsed = start; applyOffline(s,elapsed*C.time.msPerSecond); record(s,times,elapsed,'Gündelik'); }
      A.claimLogin(s,elapsed*C.time.msPerSecond);
      for (let t = 0; t < C.balance.sessionSeconds; t += C.balance.stepSeconds) {
        elapsed += C.balance.stepSeconds;
        tick(s,C.balance.stepSeconds,elapsed*C.time.msPerSecond);
        if (elapsed % C.balance.decisionSeconds === 0) decide(s,true);
        record(s,times,elapsed,'Gündelik');
        if (times[milestones.at(-1)] !== undefined) return { times, prestigeDay: day+1, level: s.level, prestigeOk: A.prestige(s).ok };
      }
    }
  }
  return { times, prestigeDay: null, level: s.level };
}
const format = seconds => seconds === undefined ? 'Ulaşılmadı' : `${(seconds/C.time.minutesPerHour).toFixed(1)} dk (${(seconds/C.time.secondsPerDay).toFixed(2)} gün)`;
const early = process.argv.includes('--early');
const a = active(early), c = early ? { times: {}, prestigeDay: null, level: 1 } : casual();
console.log('Gerçek zaman üzerinde deterministik denge simülasyonu');
console.table(milestones.map(name => ({ 'Kilometre taşı': name, 'Aktif': format(a.times[name]), 'Gündelik': format(c.times[name]) })));
console.log(`Gündelik ilk prestij günü: ${c.prestigeDay ?? 'Ulaşılmadı'} (günde ${C.balance.sessionsPerDay} x ${C.balance.sessionSeconds/C.time.minutesPerHour} dk)`);
console.log(`Aktif son seviye: ${a.level}. Gündelik son seviye: ${c.level}.`);
if (!early) console.log(`Franchise eylemi aktif: ${a.prestigeOk ? 'başarılı' : 'başarısız'}, gündelik: ${c.prestigeOk ? 'başarılı' : 'başarısız'}.`);
