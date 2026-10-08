# Modül sözleşmesi (core ↔ UI)

Core saf JS'dir: DOM, window, localStorage kullanmaz (Node'da test edilir). UI sadece aşağıdaki exportları kullanır.

## Dosya düzeni
```
index.html  manifest.webmanifest  sw.js  icons/
src/data/config.js      tüm denge sayıları, olay tanımları, metinler (core yazar)
src/core/state.js       createInitialState, migrate, serialize/deserialize
src/core/sim.js         tick, applyOffline
src/core/actions.js     oyuncu eylemleri
src/core/selectors.js   UI için hesaplanmış değerler ve maliyetler
src/core/rng.js         tohumlu rastgele (mulberry32)
src/core/index.js       hepsini yeniden export eder (UI sadece buradan import eder)
src/monetize.js         reklam/IAP arayüzü (UI yazar)
src/storage.js          localStorage kayıt/yükleme (UI yazar)
src/main.js             açılış, oyun döngüsü (requestAnimationFrame), kayıt zamanlayıcı (UI yazar)
src/ui/*.js             HUD, canvas saha çizimi, sekmeler, modallar (UI yazar)
styles.css
tests/*.test.mjs        node --test (core yazar)
tools/balance-sim.mjs   başsız denge simülasyonu (core yazar)
```

## State şekli (core sahibi, alan eklenebilir, bunlar silinemez/yeniden adlandırılamaz)
```js
{
  version: 1,
  seed: number,
  time: { gameHours: number, speed: 1|2, speedBoostUntil: number /*ms epoch*/ },
  lastSavedAt: number,            // ms epoch
  money: number, gems: number, brandPoints: number,
  totalEarned: number, lifetimeEarned: number,
  xp: number, level: number,
  weather: { kind: 'clear'|'rain', untilHour: number },
  activeVenueId: string,
  venues: [{
    id: string, typeId: string, name: string,
    stars: number,                // 0..5, ondalıklı
    facilities: { cafe: 0, rental: 0, parking: 0, camera: 0, social: 0 },
    staff: { keeper: 0, cashier: 0, manager: 0, coach: 0 },   // 0 = yok
    pitches: [{
      id: string, name: string, price: number, condition: number /*0..100*/,
      upgrades: { turf: 0, lights: 0, lockers: 0, stands: 0, roof: 0 },
      match: null | { startHour: number, endHour: number, customerType: string,
                      colors: [string, string], revenue: number, kind: 'match'|'tournament' },
      blockedUntilHour: number
    }]
  }],
  pendingEvent: null | { id: string, venueId: string, expiresAtHour: number, data: object },
  activeEffects: [{ id: string, venueId: string|null, untilHour: number, mods: object }],
  missions: { day: string /*YYYY-MM-DD*/, list: [{ id, target, progress, reward, claimed }] },
  loginStreak: { lastDay: string, count: number, claimedToday: boolean },
  achievements: { [id]: true },
  stats: { matches: number, tournaments: number, eventsResolved: number, cafeEarned: number },
  cosmetics: { owned: string[], lineColor: string, kit: string },
  settings: { sound: true, vibration: true },
  flags: { seenUnlocks: string[], removeAds: false }
}
```

## Core API (src/core/index.js)
```js
createInitialState(nowMs) -> state
migrate(rawObj) -> state                       // eski/bozuk alanları tamamlar
tick(state, dtRealSeconds, nowMs) -> GameEvent[]   // durumu yerinde değiştirir
applyOffline(state, nowMs) -> { seconds, earned, cappedHours } // lastSavedAt'tan beri
// GameEvent: { type: 'match_start'|'match_end'|'level_up'|'event_offer'|'unlock'|'achievement'|'weather'|'tournament_end'|'mission_done', venueId?, pitchId?, amount?, payload? }

actions.buyPitch(state, venueId)
actions.upgradePitch(state, venueId, pitchId, key)       // key: turf|lights|lockers|stands|roof
actions.setPrice(state, venueId, pitchId, price)
actions.repairPitch(state, venueId, pitchId)
actions.upgradeFacility(state, venueId, key)
actions.hireOrUpgradeStaff(state, venueId, key)
actions.resolveEvent(state, choiceIndex)
actions.startTournament(state, venueId, pitchId, tournamentId)
actions.buyVenue(state, typeId)
actions.setActiveVenue(state, venueId)
actions.claimMission(state, missionId)
actions.claimLogin(state, nowMs)
actions.useGems(state, what)                  // 'timeskip'|'instantRepair:<venueId>:<pitchId>'|'cosmetic:<id>'
actions.grantReward(state, rewardId)          // reklam/IAP sonrası: 'offline2x'|'speed2x'|'gems_small'...
actions.prestige(state)
// Hepsi { ok: boolean, reason?: string /*Türkçe, kullanıcıya gösterilebilir*/ } döner.

selectors.pitchCost(state, venueId), selectors.upgradeCost(state, venueId, pitchId, key),
selectors.facilityCost(state, venueId, key), selectors.staffCost(state, venueId, key),
selectors.referencePrice(state, venueId, pitchId), selectors.bookingChance(state, venueId, pitchId, hour),
selectors.incomePerHour(state, venueId) /*beklenen*/, selectors.salaryPerHour(state, venueId),
selectors.isUnlocked(state, featureKey), selectors.levelProgress(state) -> {level, xp, next},
selectors.clock(state) -> { day, hour, minute, isNight },
selectors.prestigePreview(state) -> number, selectors.eventView(state) -> { title, text, choices:[{label, hint, cost?}] } | null
config  // config.js içeriği yeniden export
```
Tüm metinler Türkçe. Para gösterimi UI'da `formatMoney` (1.2B, 450K, 12.400₺).
