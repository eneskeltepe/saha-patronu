import { config as C } from '../data/config.js';
import { clamp, finite, safeMoney } from './state.js';
export const getVenue = (s, id) => s.venues.find(v => v.id === id);
export const getPitch = (s, vid, pid) => getVenue(s, vid)?.pitches.find(p => p.id === pid);
export const venueType = v => C.venues.find(t => t.id === v?.typeId);
export function effectMods(s, vid) {
  const mods = { demand: 1, revenue: 1, cafe: 1, nightDemand: 1, morningDemand: 1, discount: 1, priceCap: Infinity, subscription: 0, noLights: false, generator: false, rainProtection: false };
  for (const e of s.activeEffects) if (e.untilHour > s.time.gameHours && (e.venueId === null || e.venueId === vid)) {
    for (const [k, value] of Object.entries(e.mods)) {
      if (['noLights','generator','rainProtection'].includes(k)) mods[k] ||= value === true;
      else if (k === 'priceCap' && Number.isFinite(value) && value > 0) mods[k] = Math.min(mods[k], value);
      else if (k === 'subscription' && Number.isFinite(value)) mods[k] = clamp(value,0,1);
      else if (k in mods && Number.isFinite(value)) mods[k] *= value;
    }
  }
  return mods;
}
export function pitchCost(s, vid) { const v = getVenue(s, vid); return v ? Math.round(venueType(v).pitchBase * C.economy.growth ** Math.max(0, v.pitches.length - 1)) : Infinity; }
export function upgradeCost(s, vid, pid, key) { const p = getPitch(s, vid, pid); return p && C.upgrades[key] ? Math.round(C.upgrades[key].base * C.economy.growth ** p.upgrades[key] * effectMods(s, vid).discount) : Infinity; }
export function facilityCost(s, vid, key) { const v = getVenue(s, vid); return v && C.facilities[key] ? Math.round(C.facilities[key].base * C.economy.growth ** v.facilities[key] * effectMods(s, vid).discount) : Infinity; }
export function staffCost(s, vid, key) { const v = getVenue(s, vid); return v && C.staff[key] ? Math.round(C.staff[key].base * C.economy.growth ** v.staff[key]) : Infinity; }
export function repairCost(s, vid, pid) { const p = getPitch(s, vid, pid); return p ? Math.ceil(C.economy.repairBase + (C.initial.condition - p.condition) * C.economy.repairPerCondition) : Infinity; }
export function referencePrice(s, vid, pid) {
  const v = getVenue(s, vid), p = getPitch(s, vid, pid);
  if (!p) return 0;
  const quality = 1 + p.upgrades.turf * C.upgrades.turf.reference + Math.max(0, p.upgrades.lights - 1) * C.upgrades.lights.reference + p.upgrades.lockers * C.upgrades.lockers.reference;
  const condition = p.condition < C.economy.lowCondition ? Math.max(C.economy.conditionPriceFloor, p.condition / C.economy.lowCondition) : 1;
  return C.initial.price * venueType(v).multiplier * quality * condition;
}
function openFor(p,hour,mods) {
  const lit = p.upgrades.lights > 0 && (!mods.noLights || mods.generator);
  return lit ? hour >= C.hours.open || hour < C.hours.nightClose : hour >= C.hours.open && hour < C.hours.dayClose;
}
const hourOfDay = hour => ((Math.floor(hour) % C.time.hoursPerDay) + C.time.hoursPerDay) % C.time.hoursPerDay;
export function isOpen(s, vid, pid, hour) {
  const p = getPitch(s,vid,pid);
  return Boolean(p) && openFor(p,hourOfDay(hour),effectMods(s,vid));
}
export function bookingChance(s, vid, pid, hour) {
  const v = getVenue(s, vid), p = getPitch(s, vid, pid);
  if (!p) return 0;
  return bookingFor(s,v,p,hourOfDay(hour),effectMods(s,vid),referencePrice(s,vid,pid));
}
function bookingFor(s,v,p,h,mods,ref) {
  if (!openFor(p,h,mods)) return 0;
  const price = Math.min(p.price, ref * mods.priceCap);
  const priceDemand = clamp((ref / Math.max(1, price)) ** C.economy.elasticity, 0, C.economy.maxPriceDemand);
  const weather = s.weather.kind === 'rain' && !p.upgrades.roof && !mods.rainProtection ? C.economy.rain : 1;
  const extra = v.facilities.parking * C.economy.parkingDemand + v.facilities.social * C.economy.socialDemand + (v.facilities.parking && p.upgrades.lockers ? C.economy.companyDemand : 0) + (h < C.hours.morningEnd ? C.economy.veteranDemand : 0) + (v.facilities.social >= C.customerUnlocks.womenSocial ? C.economy.womenDemand : 0) + (h < C.hours.morningEnd ? v.staff.coach * C.economy.academyDemand * v.staffEfficiency : 0);
  return clamp((C.hourDemand[h] + extra) * (C.economy.reputationBase + C.economy.reputationPerStar * v.stars) * priceDemand * weather * mods.demand * (h >= C.hours.eveningStart || h < C.hours.nightClose ? mods.nightDemand : 1) * (h >= C.hours.open && h < C.hours.morningEnd ? mods.morningDemand : 1), 0, C.economy.maxChance);
}
export function matchIncome(s, vid, pid, subscription = false) {
  const v = getVenue(s, vid), p = getPitch(s, vid, pid);
  if (!p) return { total: 0, cafe: 0 };
  return matchFor(s,v,p,effectMods(s,vid),referencePrice(s,vid,pid),subscription);
}
function matchFor(s,v,p,mods,ref,subscription) {
  const cafe = C.economy.players * C.facilities.cafe.perPlayer * v.facilities.cafe * mods.cafe;
  const extra = C.facilities.rental.perMatch * v.facilities.rental + C.facilities.camera.perMatch * v.facilities.camera;
  const price = Math.min(p.price, ref * mods.priceCap) * (subscription ? mods.subscription : 1);
  const multiplier = (1 + v.staff.cashier * C.economy.cashierIncome * v.staffEfficiency) * (1 + s.brandPoints * C.economy.brandIncome) * mods.revenue;
  return { total: safeMoney((price + cafe + extra) * multiplier), cafe: safeMoney(cafe * multiplier) };
}
export function incomePerHour(s, vid) {
  const venues = vid === undefined ? s.venues : [getVenue(s, vid)].filter(Boolean);
  let total = 0;
  for (const v of venues) {
    const mods = effectMods(s,v.id);
    for (const p of v.pitches) {
      const ref = referencePrice(s,v.id,p.id);
      const normalIncome = matchFor(s,v,p,mods,ref,false).total;
      for (let h = 0; h < C.time.hoursPerDay; h++) {
        const subscribed = h === C.hours.subscription && p === v.pitches[0] && mods.subscription > 0 && openFor(p,h,mods);
        total += (subscribed ? matchFor(s,v,p,mods,ref,true).total : bookingFor(s,v,p,h,mods,ref)*normalIncome) / C.time.hoursPerDay;
      }
    }
  }
  return safeMoney(total);
}
export function salaryPerHour(s, vid) { const venues = vid === undefined ? s.venues : [getVenue(s, vid)].filter(Boolean); return safeMoney(venues.reduce((total, v) => total + Object.keys(C.staff).reduce((sum, k) => sum + v.staff[k] * C.staff[k].salary, 0), 0)); }
export function isUnlocked(s, feature) { const level = C.unlocks[feature] ?? C.upgrades[feature]?.unlock ?? C.staff[feature]?.unlock; return typeof level === 'number' && s.level >= level; }
export function levelProgress(s) { return { level: s.level, xp: s.xp, next: C.xpThresholds[s.level + 1] ?? C.xpThresholds.at(-1) }; }
export function clock(s) { const hour = Math.floor(s.time.gameHours) % C.time.hoursPerDay; return { day: Math.floor(s.time.gameHours / C.time.hoursPerDay) + 1, hour, minute: Math.floor((s.time.gameHours % 1) * C.time.minutesPerHour), isNight: hour >= C.hours.nightStart || hour < C.hours.nightEnd }; }
export function prestigePreview(s) { return Math.floor(Math.sqrt(safeMoney(s.totalEarned) / C.economy.prestigeDivisor)); }
export function eventView(s) { const event = C.eventDefinitions.find(e => e.id === s.pendingEvent?.id); return event ? { title: event.title, text: event.text, choices: event.choices.map(c => ({ label: c.label, hint: c.hint, ...(c.cost ? { cost: c.cost } : {}) })) } : null; }
export const selectors = { pitchCost, upgradeCost, facilityCost, staffCost, repairCost, referencePrice, bookingChance, incomePerHour, salaryPerHour, isUnlocked, levelProgress, clock, prestigePreview, eventView };
