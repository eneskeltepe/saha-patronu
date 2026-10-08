import { config as C } from '../data/config.js';
import { clamp, finite, safeMoney, createInitialState, makePitch, makeVenue, dayKey, resetMissions } from './state.js';
import * as S from './selectors.js';
import { addIncome, checkAchievements, updateMission, offlineEstimate } from './sim.js';

const fail = key => ({ ok: false, reason: C.messages[key] || key });
const success = () => ({ ok: true });
const pay = (s, cost) => { s.money = safeMoney(s.money - cost); };
function purchasable(s, cost, level, max, unlock) {
  if (s.level < unlock) return fail('locked');
  if (level >= max) return fail('max');
  if (!Number.isFinite(cost) || cost < 0) return fail('invalid');
  if (s.money < cost) return fail('funds');
  return null;
}
export function buyPitch(s, vid) {
  const v = S.getVenue(s,vid);
  if (!v) return fail('missing');
  if (v.pitches.length >= S.venueType(v).capacity) return fail('capacity');
  const cost = S.pitchCost(s,vid), error = purchasable(s,cost,0,1,1);
  if (error) return error;
  pay(s,cost);
  v.pitches.push(makePitch(v,v.pitches.length+1,s.brandUpgrades));
  checkAchievements(s);
  return success();
}
export function upgradePitch(s,vid,pid,key) {
  const p = S.getPitch(s,vid,pid), data = C.upgrades[key];
  if (!p) return fail('missing');
  if (!data) return fail('invalid');
  const cost = S.upgradeCost(s,vid,pid,key), error = purchasable(s,cost,p.upgrades[key],data.max,data.unlock);
  if (error) return error;
  const ref = S.referencePrice(s,vid,pid);
  pay(s,cost); p.upgrades[key]++;
  // Kalite artarken oyuncunun seçtiği fiyat oranı korunur.
  p.price = safeMoney(p.price * S.referencePrice(s,vid,pid) / ref);
  return success();
}
export function setPrice(s,vid,pid,price) {
  const p = S.getPitch(s,vid,pid);
  if (!p) return fail('missing');
  if (!S.isUnlocked(s,'price')) return fail('locked');
  if (typeof price !== 'number' || !Number.isFinite(price)) return fail('invalid');
  const ref = S.referencePrice(s,vid,pid), mods = S.effectMods(s,vid);
  p.price = clamp(price,ref * C.economy.minPriceRatio,ref * Math.min(C.economy.maxPriceRatio,mods.priceCap));
  return success();
}
export function repairPitch(s,vid,pid) {
  const p = S.getPitch(s,vid,pid);
  if (!p) return fail('missing');
  if (p.condition >= C.initial.condition) return fail('Sahanın bakıma ihtiyacı yok.');
  const cost = S.repairCost(s,vid,pid);
  if (s.money < cost) return fail('funds');
  const ratio = p.price / S.referencePrice(s,vid,pid);
  pay(s,cost); p.condition = C.initial.condition;
  p.price = S.referencePrice(s,vid,pid) * clamp(ratio,C.economy.minPriceRatio,C.economy.maxPriceRatio);
  return success();
}
export function upgradeFacility(s,vid,key) {
  const v = S.getVenue(s,vid), data = C.facilities[key];
  if (!v) return fail('missing');
  if (!data) return fail('invalid');
  const cost = S.facilityCost(s,vid,key), error = purchasable(s,cost,v.facilities[key],C.economy.maxLevel,data.unlock);
  if (error) return error;
  pay(s,cost); v.facilities[key]++;
  return success();
}
export function hireOrUpgradeStaff(s,vid,key) {
  const v = S.getVenue(s,vid), data = C.staff[key];
  if (!v) return fail('missing');
  if (!data) return fail('invalid');
  const cost = S.staffCost(s,vid,key), error = purchasable(s,cost,v.staff[key],C.economy.maxLevel,data.unlock);
  if (error) return error;
  pay(s,cost); v.staff[key]++;
  return success();
}
export function resolveEvent(s,index,automatic = false) {
  const pending = s.pendingEvent, event = C.eventDefinitions.find(e => e.id === pending?.id);
  if (!event || !Number.isInteger(index) || !event.choices[index]) return fail('invalid');
  const v = S.getVenue(s,pending.venueId), c = event.choices[index];
  if (!v) return fail('missing');
  if (c.requiresSocial && !v.facilities.social) return fail('locked');
  const inspectionCost = c.inspectionRepair ? v.pitches.reduce((sum,p) => sum + (p.condition < C.initial.condition ? S.repairCost(s,v.id,p.id) : 0),0) : 0;
  const requestedCost = (c.cost || 0) + inspectionCost;
  const cost = automatic ? Math.min(s.money,requestedCost) : requestedCost;
  if (s.money < cost) return fail('funds');
  const blockPitch = c.block ? v.pitches.find(p => !p.match && p.blockedUntilHour <= s.time.gameHours) || (automatic ? v.pitches[0] : null) : null;
  if (c.block && !blockPitch) return fail('busy');
  pay(s,cost);
  if (c.inspectionRepair) for (const p of v.pitches) p.condition = C.initial.condition;
  if (c.inspection || c.inspectionRepair) {
    const avg = v.pitches.reduce((sum,p) => sum + p.condition,0) / v.pitches.length;
    if (avg > c.inspectionThreshold) addIncome(s,c.inspectionReward);
    else pay(s,Math.min(s.money,c.inspectionFine || 0));
  }
  if (c.earned) addIncome(s,c.earned);
  if (c.stars) v.stars = clamp(v.stars + c.stars,0,C.limits.stars);
  if (c.condition) for (const p of v.pitches) p.condition = clamp(p.condition+c.condition,0,C.initial.condition);
  if (blockPitch) blockPitch.blockedUntilHour = Math.max(s.time.gameHours,blockPitch.match?.endHour || 0,blockPitch.blockedUntilHour) + c.block;
  if (c.hours) {
    const mods = Object.fromEntries(Object.entries(c).filter(([k]) => ['demand','cafe','subscription','generator','discount','nightDemand','morningDemand','revenue','priceCap','rainProtection'].includes(k)));
    s.activeEffects.push({ id: event.id, venueId: v.id, untilHour: s.time.gameHours+c.hours, mods });
  }
  s.stats.eventsResolved++;
  updateMission(s,'events',1);
  s.pendingEvent = null;
  return success();
}
export function startTournament(s,vid,pid,id) {
  const p = S.getPitch(s,vid,pid), t = C.tournaments.find(x => x.id === id);
  if (!p) return fail('missing');
  if (!t) return fail('invalid');
  if (s.level < t.unlock || !p.upgrades.stands) return fail('locked');
  if (p.match || p.blockedUntilHour > s.time.gameHours) return fail('busy');
  if (s.money < t.cost) return fail('funds');
  pay(s,t.cost);
  p.match = { kind: 'tournament', startHour: s.time.gameHours, endHour: s.time.gameHours+t.hours, customerType: 'company', colors: C.customerColors.company, revenue: t.reward*(1+p.upgrades.stands*t.standsMultiplier)*(1+s.brandPoints*C.economy.brandIncome), gems: t.gems, stars: t.stars };
  return success();
}
export function buyVenue(s,id) {
  const t = C.venues.find(v => v.id === id);
  if (!t) return fail('invalid');
  if (s.venues.some(v => v.typeId === id)) return fail('Bu şube zaten açık.');
  if (s.level < t.unlock) return fail('locked');
  if (s.money < t.cost) return fail('funds');
  pay(s,t.cost); s.venues.push(makeVenue(t,s.brandUpgrades));
  checkAchievements(s);
  return success();
}
export function setActiveVenue(s,id) { if (!S.getVenue(s,id)) return fail('missing'); s.activeVenueId = id; return success(); }
export function claimMission(s,id) {
  const m = s.missions.list.find(m => m.id === id);
  if (!m) return fail('invalid');
  if (m.claimed) return fail('claimed');
  if (m.progress < m.target) return fail('incomplete');
  m.claimed = true; s.gems = safeMoney(s.gems+m.reward);
  return success();
}
export function claimLogin(s,nowMs) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || nowMs < 0) return fail('invalid');
  const day = dayKey(nowMs), old = s.loginStreak.lastDay;
  if (old && day <= old) return fail('claimed');
  const previous = dayKey(nowMs-C.time.secondsPerDay*C.time.msPerSecond);
  s.loginStreak = { ...s.loginStreak, lastDay: day, count: old === previous ? s.loginStreak.count % C.rewards.loginCycle + 1 : 1, claimedToday: true };
  s.gems = safeMoney(s.gems+C.rewards.loginBase*s.loginStreak.count);
  resetMissions(s,nowMs);
  return success();
}
export function useGems(s,what) {
  if (typeof what !== 'string') return fail('invalid');
  if (what === 'timeskip') {
    if (s.gems < C.rewards.timeskipGems) return fail('Yeterli elmasınız yok.');
    s.gems -= C.rewards.timeskipGems;
    addIncome(s,offlineEstimate(s,C.economy.offlineHours*C.time.secondsPerRealHour).earned);
    return success();
  }
  if (what === 'speed2x') {
    if (s.gems < C.rewards.boostGems) return fail('Yeterli elmasınız yok.');
    s.gems -= C.rewards.boostGems;
    return grantReward(s,'speed2x');
  }
  if (what.startsWith('instantRepair:')) {
    const [,vid,pid] = what.split(':'), p = S.getPitch(s,vid,pid);
    if (!p) return fail('missing');
    if (p.condition >= C.initial.condition) return fail('Sahanın bakıma ihtiyacı yok.');
    if (s.gems < C.rewards.instantRepairGems) return fail('Yeterli elmasınız yok.');
    s.gems -= C.rewards.instantRepairGems; p.condition = C.initial.condition;
    return success();
  }
  if (what.startsWith('cosmetic:')) {
    const item = C.cosmetics.find(c => c.id === what.slice('cosmetic:'.length));
    if (!item) return fail('invalid');
    if (!s.cosmetics.owned.includes(item.id)) {
      if (s.gems < C.rewards.cosmeticGems) return fail('Yeterli elmasınız yok.');
      s.gems -= C.rewards.cosmeticGems; s.cosmetics.owned.push(item.id);
    }
    if (item.lineColor) s.cosmetics.lineColor = item.lineColor;
    if (item.kit) s.cosmetics.kit = item.kit;
    return success();
  }
  return fail('invalid');
}
export function grantReward(s,id) {
  if (id === 'offline2x') {
    if (s.offlineRewardClaimed || s.lastOfflineEarned <= 0) return fail('claimed');
    addIncome(s,s.lastOfflineEarned); s.offlineRewardClaimed = true;
  } else if (id === 'speed2x') { s.time.speed = C.rewards.speed; s.time.speedBoostUntil = Math.max(s.lastSavedAt,s.time.speedBoostUntil)+C.rewards.boostSeconds*C.time.msPerSecond; }
  else if (['gems_small','gems_large'].includes(id)) s.gems = safeMoney(s.gems+C.rewards[id]);
  else if (id === 'remove_ads') s.flags.removeAds = true;
  else if (id === 'starter') { if (s.flags.starterClaimed) return fail('claimed'); addIncome(s,C.rewards.starterMoney); s.gems = safeMoney(s.gems+C.rewards.starterGems); s.flags.starterClaimed = true; }
  else if (typeof id === 'string' && id.startsWith('instantRepair:')) { const [,vid,pid] = id.split(':'); const p = S.getPitch(s,vid,pid); if (!p) return fail('missing'); p.condition = C.initial.condition; }
  else return fail('invalid');
  return success();
}
export function prestige(s) {
  if (!S.isUnlocked(s,'franchise')) return fail('locked');
  const points = S.prestigePreview(s);
  if (!points) return fail('Marka puanı kazanmak için daha fazla gelir gerekiyor.');
  const next = createInitialState(s.lastSavedAt);
  for (const key of ['gems','lifetimeEarned','cosmetics','settings','flags','achievements','loginStreak','brandUpgrades']) next[key] = structuredClone(s[key]);
  next.brandPoints = safeMoney(s.brandPoints+points); next.prestiges = s.prestiges+1; next.seed = s.seed;
  next.money = safeMoney(next.money+next.brandUpgrades.cash*C.brandShop.cash.amount);
  next.venues = [makeVenue(C.venues[0],next.brandUpgrades)];
  Object.assign(s,next);
  checkAchievements(s);
  return success();
}
export function buyBrandUpgrade(s,key) {
  if (!Object.hasOwn(C.brandShop,key)) return fail('invalid');
  const item = C.brandShop[key];
  if (!item) return fail('invalid');
  if (key === 'lights' && s.brandUpgrades.lights) return fail('max');
  if (s.brandPoints < item.cost) return fail('Yeterli marka puanınız yok.');
  s.brandPoints -= item.cost; s.brandUpgrades[key]++;
  return success();
}
export const actions = { buyPitch, upgradePitch, setPrice, repairPitch, upgradeFacility, hireOrUpgradeStaff, resolveEvent, startTournament, buyVenue, setActiveVenue, claimMission, claimLogin, useGems, grantReward, prestige, buyBrandUpgrade };
