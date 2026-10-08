import { config as C } from '../data/config.js';
import { clamp, finite, safeMoney, resetMissions } from './state.js';
import { random, randomInt } from './rng.js';
import { bookingChance, matchIncome, salaryPerHour, incomePerHour, effectMods, isOpen, economicBase } from './selectors.js';
import { resolveEvent } from './actions.js';

export function addIncome(s, amount, events = []) {
  amount = safeMoney(amount);
  s.money = safeMoney(s.money + amount);
  s.totalEarned = safeMoney(s.totalEarned + amount);
  s.lifetimeEarned = safeMoney(s.lifetimeEarned + amount);
  s.xp = safeMoney(s.xp + amount * C.economy.xpPerMoney * (1 + s.brandUpgrades.xp * C.brandShop.xp.multiplier));
  while (s.level + 1 < C.xpThresholds.length && s.xp >= C.xpThresholds[s.level + 1]) {
    s.level++;
    s.gems = safeMoney(s.gems + C.economy.gemsPerLevel);
    events.push({ type: 'level_up', payload: { level: s.level } });
    for (const [key, level] of Object.entries(C.unlocks)) if (level === s.level && !s.flags.seenUnlocks.includes(key)) { s.flags.seenUnlocks.push(key); events.push({ type: 'unlock', payload: { feature: key } }); }
  }
}
export function updateMission(s, id, amount, events = []) {
  const mission = s.missions.list.find(m => m.id === id);
  if (!mission) return;
  const before = mission.progress;
  mission.progress = Math.min(mission.target, mission.progress + amount);
  if (before < mission.target && mission.progress >= mission.target) events.push({ type: 'mission_done', payload: { id } });
}
export function checkAchievements(s, events = []) {
  const stats = { ...s.stats, pitches: s.venues.reduce((n,v) => n + v.pitches.length,0), venues: s.venues.length, stars: Math.max(...s.venues.map(v => v.stars)), prestiges: s.prestiges };
  for (const a of C.achievements) if (!s.achievements[a.id] && stats[a.stat] >= a.target) { s.achievements[a.id] = true; s.gems = safeMoney(s.gems + a.reward); events.push({ type: 'achievement', payload: { id: a.id } }); }
}
function finishMatches(s, hour, events) {
  for (const v of s.venues) for (const p of v.pitches) if (p.match && p.match.endHour <= hour) {
    const m = p.match;
    p.match = null;
    addIncome(s, m.revenue, events);
    if (m.kind === 'tournament') {
      s.stats.tournaments++;
      s.gems = safeMoney(s.gems + finite(m.gems));
      v.stars = clamp(v.stars + finite(m.stars), 0, C.limits.stars);
      events.push({ type: 'tournament_end', venueId: v.id, pitchId: p.id, amount: m.revenue });
    } else {
      s.stats.matches++;
      s.stats.cafeEarned = safeMoney(s.stats.cafeEarned + finite(m.cafeRevenue));
      updateMission(s, 'matches', 1, events);
      updateMission(s, 'cafe', finite(m.cafeRevenue), events);
      events.push({ type: 'match_end', venueId: v.id, pitchId: p.id, amount: m.revenue });
    }
    p.condition = clamp(p.condition - C.economy.wear * Math.max(0, 1 - p.upgrades.turf * C.economy.turfWear), 0, C.initial.condition);
  }
}
function hourStep(s, hour, events) {
  finishMatches(s, hour, events);
  s.activeEffects = s.activeEffects.filter(e => e.untilHour > hour);
  if (s.weather.kind === 'rain' && hour >= s.weather.untilHour) { s.weather.kind = 'clear'; events.push({ type: 'weather', payload: { kind: 'clear' } }); }
  if (hour % C.events.weatherInterval === 0 && s.weather.kind === 'clear' && random(s) < C.events.weatherChance) { s.weather = { kind: 'rain', untilHour: hour + randomInt(s, C.events.rainMin, C.events.rainMax) }; events.push({ type: 'weather', payload: s.weather }); }
  if (s.pendingEvent && hour >= s.pendingEvent.expiresAtHour) resolveEvent(s, s.pendingEvent.data.defaultChoice ?? 1,true);
  for (const v of s.venues) {
    const salary = salaryPerHour(s, v.id);
    v.staffEfficiency = s.money >= salary ? 1 : C.economy.unpaidEfficiency;
    s.money = safeMoney(s.money - Math.min(s.money, salary));
    for (const p of v.pitches) p.condition = clamp(p.condition + v.staff.keeper * C.economy.keeperRepair * v.staffEfficiency, 0, C.initial.condition);
    const avg = v.pitches.reduce((n,p) => n + p.condition,0) / v.pitches.length;
    const lockers = Math.max(...v.pitches.map(p => p.upgrades.lockers));
    const target = clamp(C.initial.stars + lockers * C.economy.lockersStars + v.facilities.camera * C.economy.cameraStars - (avg < C.economy.lowCondition ? C.economy.conditionStars * (1 - avg / C.economy.lowCondition) : 0),0,C.limits.stars);
    v.stars = clamp(v.stars + (target - v.stars) * C.economy.starAdjustment,0,C.limits.stars);
    for (const p of v.pitches) {
      if (p.match || p.blockedUntilHour > hour || !isOpen(s,v.id,p.id,hour)) continue;
      const subscription = hour % C.time.hoursPerDay === C.hours.subscription && p === v.pitches[0] && effectMods(s,v.id).subscription > 0;
      const firstBooking = s.stats.matches === 0 && v === s.venues[0] && p === v.pitches[0];
      const roll = subscription ? 0 : random(s);
      if (!firstBooking && !subscription && roll >= bookingChance(s,v.id,p.id,hour)) continue;
      const types = ['neighborhood'];
      if (v.facilities.parking && p.upgrades.lockers) types.push('company');
      if (hour % C.time.hoursPerDay < C.hours.morningEnd) types.push('veteran');
      if (v.facilities.social >= C.customerUnlocks.womenSocial) types.push('women');
      if (v.staff.coach && hour % C.time.hoursPerDay < C.hours.morningEnd) types.push('academy');
      const customerType = types[randomInt(s,0,types.length-1)];
      const income = matchIncome(s,v.id,p.id,subscription);
      p.match = { startHour: hour, endHour: hour + 1, customerType, colors: C.customerColors[customerType], revenue: income.total, cafeRevenue: income.cafe, kind: 'match' };
      events.push({ type: 'match_start', venueId: v.id, pitchId: p.id });
    }
  }
  if (s.level >= C.events.unlock && !s.pendingEvent && hour >= s.nextEventHour) {
    const v = s.venues[randomInt(s,0,s.venues.length-1)];
    const eligible = C.eventDefinitions.filter(e => e.id !== 'celebrity' || v.facilities.social > 0);
    const event = eligible[randomInt(s,0,eligible.length-1)];
    s.pendingEvent = { id: event.id, venueId: v.id, expiresAtHour: hour + C.events.expiry, data: { defaultChoice: 1, economicBase: economicBase(s,v.id) } };
    if (event.passive?.rain) { s.weather = { kind: 'rain', untilHour: hour + event.passive.hours }; events.push({ type: 'weather', payload: s.weather }); }
    else if (event.passive) s.activeEffects.push({ id: `${event.id}-passive`, venueId: v.id, untilHour: hour + event.passive.hours, mods: Object.fromEntries(Object.entries(event.passive).filter(([key]) => key !== 'hours')) });
    s.nextEventHour = hour + randomInt(s,C.events.gapMin,C.events.gapMax);
    events.push({ type: 'event_offer', venueId: v.id, payload: { id: event.id } });
  }
  checkAchievements(s,events);
}
export function tick(s, dtRealSeconds, nowMs = s.lastSavedAt) {
  const events = [];
  const dt = Math.max(0, finite(dtRealSeconds));
  const now = Math.max(s.lastSavedAt, finite(nowMs,s.lastSavedAt));
  if (dt > C.time.maxTick) { applyOffline(s,now); return events; }
  resetMissions(s,now);
  s.money = safeMoney(s.money);
  const startMs = now - dt * C.time.msPerSecond;
  const boostedSeconds = s.time.speedBoostUntil > startMs ? Math.min(dt, Math.max(0,(s.time.speedBoostUntil - startMs) / C.time.msPerSecond)) : 0;
  const speed = s.time.speedBoostUntil > startMs ? C.rewards.speed : 1;
  const hours = (dt + boostedSeconds * (speed - 1)) / C.time.secondsPerHour;
  const start = clamp(finite(s.time.gameHours,C.time.startHour),0,C.limits.gameHours);
  s.time.gameHours = start;
  const rawEnd = Math.min(C.limits.gameHours,start + hours);
  const end = Math.abs(rawEnd - Math.round(rawEnd)) < C.time.epsilon ? Math.round(rawEnd) : rawEnd;
  if (!s.started && dt > 0) { s.started = true; hourStep(s,Math.floor(start),events); }
  for (let h = Math.floor(start) + 1; h <= Math.floor(end); h++) { s.time.gameHours = h; hourStep(s,h,events); }
  s.time.gameHours = end;
  s.time.speed = s.time.speedBoostUntil > now ? C.rewards.speed : 1;
  s.lastSavedAt = now;
  s.money = safeMoney(s.money);
  return events;
}
export function offlineEstimate(s, elapsedSeconds) {
  const manager = Math.max(...s.venues.map(v => v.staff.manager));
  const cappedHours = C.economy.offlineHours + manager * C.economy.managerHours;
  const seconds = Math.min(Math.max(0,finite(elapsedSeconds)), cappedHours * C.time.secondsPerRealHour);
  let net = 0;
  for (const v of s.venues) {
    const efficiency = Math.min(C.economy.offlineEfficiencyMax, C.economy.offlineEfficiency + v.staff.manager * C.economy.managerEfficiency * v.staffEfficiency);
    net += (incomePerHour(s,v.id) * efficiency - salaryPerHour(s,v.id)) * seconds / C.time.secondsPerHour;
  }
  return { seconds, earned: safeMoney(net), cappedHours, expense: safeMoney(-net) };
}
export function applyOffline(s, nowMs) {
  const now = Math.max(s.lastSavedAt,finite(nowMs,s.lastSavedAt));
  resetMissions(s,now);
  const estimate = offlineEstimate(s,(now - s.lastSavedAt) / C.time.msPerSecond);
  const { expense, ...report } = estimate;
  if (report.seconds > 0) {
    const elapsedHours = (now - s.lastSavedAt) / C.time.msPerSecond / C.time.secondsPerHour;
    s.time.gameHours = clamp(finite(s.time.gameHours,C.time.startHour)+elapsedHours,0,C.limits.gameHours);
    // Normal maçlar beklenen değerde bulunur. Turnuvalar ayrıca sonuçlanır.
    for (const v of s.venues) for (const p of v.pitches) {
      if (p.match?.kind === 'match') p.match = null;
    }
    finishMatches(s,s.time.gameHours,[]);
    addIncome(s,report.earned);
    for (const v of s.venues) v.staffEfficiency = incomePerHour(s,v.id) >= salaryPerHour(s,v.id) ? 1 : C.economy.unpaidEfficiency;
    if (expense > 0) s.money = safeMoney(s.money - Math.min(s.money,expense));
    s.activeEffects = s.activeEffects.filter(e => e.untilHour > s.time.gameHours);
    if (s.weather.untilHour <= s.time.gameHours) s.weather.kind = 'clear';
    if (s.pendingEvent && s.pendingEvent.expiresAtHour <= s.time.gameHours) resolveEvent(s,s.pendingEvent.data.defaultChoice ?? 1,true);
    s.lastOfflineEarned = report.earned;
    s.offlineRewardClaimed = false;
    checkAchievements(s);
  }
  s.lastSavedAt = now;
  s.time.speed = s.time.speedBoostUntil > now ? C.rewards.speed : 1;
  return report;
}
