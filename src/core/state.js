import { config as C } from '../data/config.js';

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
export const safeMoney = n => clamp(finite(n), 0, C.maxMoney);
export const dayKey = now => new Date(clamp(finite(now), 0, 8.64e15)).toISOString().slice(0, 10);
export function makePitch(venue, index, brand = {}) {
  return { id: `${venue.id}-p${index}`, name: `Saha ${index}`, price: C.initial.price * C.venues.find(v => v.id === venue.typeId).multiplier, condition: C.initial.condition, upgrades: { turf: 0, lights: brand.lights ? 1 : 0, lockers: 0, stands: 0, roof: 0 }, match: null, blockedUntilHour: 0 };
}
export function makeVenue(type, brand = {}) {
  const venue = { id: type.id, typeId: type.id, name: type.name, stars: C.initial.stars, facilities: Object.fromEntries(Object.keys(C.facilities).map(k => [k, 0])), staff: Object.fromEntries(Object.keys(C.staff).map(k => [k, 0])), pitches: [], staffEfficiency: 1 };
  venue.pitches.push(makePitch(venue, 1, brand));
  return venue;
}
export function resetMissions(state, now) {
  const day = dayKey(now);
  if (state.missions.day !== day) state.missions = { day, list: C.missions.map(m => ({ ...m, progress: 0, claimed: false })) };
  if (state.loginStreak.lastDay !== day) state.loginStreak.claimedToday = false;
}
export function createInitialState(nowMs = 0) {
  const now = Math.max(0, finite(nowMs));
  const state = {
    version: C.version, seed: C.seed, time: { gameHours: C.time.startHour, speed: 1, speedBoostUntil: 0 }, lastSavedAt: now,
    money: C.initial.money, gems: C.initial.gems, brandPoints: 0, totalEarned: 0, lifetimeEarned: 0, xp: 0, level: 1,
    weather: { kind: 'clear', untilHour: 0 }, activeVenueId: C.venues[0].id, venues: [makeVenue(C.venues[0])],
    pendingEvent: null, activeEffects: [], missions: { day: '', list: [] }, loginStreak: { lastDay: '', count: 0, claimedToday: false },
    achievements: {}, stats: { matches: 0, tournaments: 0, eventsResolved: 0, cafeEarned: 0 },
    cosmetics: { owned: [], lineColor: C.initial.lineColor, kit: C.initial.kit }, settings: { sound: true, vibration: true }, flags: { seenUnlocks: [], removeAds: false },
    started: false, nextEventHour: C.time.startHour + C.events.gapMin, lastOfflineEarned: 0, offlineRewardClaimed: true, brandUpgrades: { cash: 0, lights: 0, xp: 0 }, prestiges: 0
  };
  resetMissions(state, now);
  return state;
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function merge(defaults, raw) {
  if (!object(raw)) return structuredClone(defaults);
  const result = { ...raw };
  for (const [key, value] of Object.entries(defaults)) {
    if (object(value)) result[key] = merge(value, raw[key]);
    else if (Array.isArray(value)) result[key] = Array.isArray(raw[key]) ? raw[key] : structuredClone(value);
    else if (typeof value === 'number') result[key] = finite(raw[key], value);
    else result[key] = typeof raw[key] === typeof value ? raw[key] : value;
  }
  return result;
}
export function migrate(raw) {
  try {
    const state = merge(createInitialState(), raw);
    state.version = C.version;
    for (const k of ['money','gems','brandPoints','totalEarned','lifetimeEarned','xp','lastSavedAt','lastOfflineEarned','prestiges']) state[k] = safeMoney(state[k]);
    state.seed = state.seed >>> 0;
    state.time.gameHours = clamp(state.time.gameHours,0,C.limits.gameHours);
    state.time.speed = state.time.speed === C.rewards.speed ? C.rewards.speed : 1;
    state.level = clamp(Math.floor(state.level), 1, C.xpThresholds.length - 1);
    state.weather.kind = state.weather.kind === 'rain' ? 'rain' : 'clear';
    state.venues = state.venues.filter(object).map((rawVenue, i) => {
      const type = C.venues.find(t => t.id === rawVenue.typeId) || C.venues[0];
      const v = merge(makeVenue(type), rawVenue);
      v.id = typeof rawVenue.id === 'string' && rawVenue.id ? rawVenue.id : `${type.id}-${i}`;
      v.typeId = type.id;
      v.stars = clamp(v.stars, 0, C.limits.stars);
      v.staffEfficiency = clamp(v.staffEfficiency, 0, 1);
      for (const group of ['facilities','staff']) for (const k of Object.keys(C[group])) v[group][k] = clamp(Math.floor(v[group][k]), 0, C.economy.maxLevel);
      v.pitches = v.pitches.filter(object).slice(0, type.capacity).map((rp, j) => {
        const p = merge(makePitch(v, j + 1), rp);
        p.condition = clamp(p.condition, 0, C.initial.condition);
        p.price = Math.max(1, safeMoney(p.price));
        p.blockedUntilHour = safeMoney(p.blockedUntilHour);
        for (const k of Object.keys(C.upgrades)) p.upgrades[k] = clamp(Math.floor(p.upgrades[k]), 0, C.upgrades[k].max);
        if (object(rp.match) && Number.isFinite(rp.match.endHour) && Number.isFinite(rp.match.startHour) && rp.match.endHour > rp.match.startHour) p.match = { ...rp.match, revenue: safeMoney(rp.match.revenue), kind: rp.match.kind === 'tournament' ? 'tournament' : 'match', customerType: typeof rp.match.customerType === 'string' ? rp.match.customerType : 'neighborhood', colors: Array.isArray(rp.match.colors) ? rp.match.colors : C.customerColors.neighborhood };
        else p.match = null;
        return p;
      });
      if (!v.pitches.length) v.pitches.push(makePitch(v, 1));
      return v;
    });
    if (!state.venues.length) state.venues = [makeVenue(C.venues[0])];
    if (!state.venues.some(v => v.id === state.activeVenueId)) state.activeVenueId = state.venues[0].id;
    state.activeEffects = state.activeEffects.filter(e => object(e) && typeof e.id === 'string' && Number.isFinite(e.untilHour) && object(e.mods));
    state.pendingEvent = object(state.pendingEvent) && C.eventDefinitions.some(e => e.id === state.pendingEvent.id) && state.venues.some(v => v.id === state.pendingEvent.venueId) && Number.isFinite(state.pendingEvent.expiresAtHour) ? { ...state.pendingEvent, data: object(state.pendingEvent.data) ? state.pendingEvent.data : {} } : null;
    state.missions.list = C.missions.map(m => { const old = state.missions.list.find(x => object(x) && x.id === m.id); return { ...m, ...old, target: m.target, reward: m.reward, progress: safeMoney(old?.progress), claimed: old?.claimed === true }; });
    for (const k of Object.keys(createInitialState().stats)) state.stats[k] = safeMoney(state.stats[k]);
    state.loginStreak.count = clamp(Math.floor(state.loginStreak.count),0,C.rewards.loginCycle);
    for (const k of Object.keys(C.brandShop)) state.brandUpgrades[k] = safeMoney(state.brandUpgrades[k]);
    state.cosmetics.owned = state.cosmetics.owned.filter(x => typeof x === 'string');
    state.flags.seenUnlocks = state.flags.seenUnlocks.filter(x => typeof x === 'string');
    return state;
  } catch { return createInitialState(); }
}
export const serialize = state => JSON.stringify(state);
export function deserialize(text) { try { return migrate(JSON.parse(text)); } catch { return createInitialState(); } }
