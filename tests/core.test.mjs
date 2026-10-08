import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState as initial, migrate, serialize, deserialize, tick, applyOffline, actions as A, selectors as S, config as C } from '../src/core/index.js';
import { random } from '../src/core/rng.js';
const ids = s => [s.venues[0].id,s.venues[0].pitches[0].id];
const rich = () => { const s = initial(0); s.money = 1e9; s.level = 20; return s; };

test('Başlangıç ve bütün sözleşme exportları', () => {
  const s = initial(123);
  assert.equal(s.money,1500); assert.equal(s.venues.length,1); assert.equal(s.venues[0].pitches[0].price,800); assert.equal(s.lastSavedAt,123);
  for (const k of ['buyPitch','upgradePitch','setPrice','repairPitch','upgradeFacility','hireOrUpgradeStaff','resolveEvent','startTournament','buyVenue','setActiveVenue','claimMission','claimLogin','useGems','grantReward','prestige']) assert.equal(typeof A[k],'function',k);
  for (const k of ['pitchCost','upgradeCost','facilityCost','staffCost','referencePrice','bookingChance','incomePerHour','salaryPerHour','isUnlocked','levelProgress','clock','prestigePreview','eventView']) assert.equal(typeof S[k],'function',k);
  assert.deepEqual(deserialize(serialize(s)),s);
});
test('Satın alma, yetersiz para, kilit ve maksimum seviyede durum korunur', () => {
  const s = initial(), [vid,pid] = ids(s); const before = serialize(s);
  assert.equal(A.buyPitch(s,vid).ok,false); assert.equal(serialize(s),before);
  assert.equal(A.upgradeFacility(s,vid,'cafe').ok,false); assert.equal(serialize(s),before);
  s.money = 1e8; assert.equal(A.buyPitch(s,vid).ok,true); assert.equal(s.venues[0].pitches.length,2);
  const full = serialize(s); assert.equal(A.buyPitch(s,vid).ok,false); assert.equal(serialize(s),full);
  s.venues[0].pitches[0].upgrades.turf = C.upgrades.turf.max;
  const max = serialize(s); assert.equal(A.upgradePitch(s,vid,pid,'turf').ok,false); assert.equal(serialize(s),max);
  const invalid = serialize(s); assert.equal(A.setPrice(s,vid,pid,NaN).ok,false); assert.equal(serialize(s),invalid);
});
test('Aydınlatmasız gece maçı yok, 18:00 ve 02:00 sınırları', () => {
  const s = rich(), [v,p] = ids(s);
  for (const h of [0,1,2,8,18,19,23]) assert.equal(S.bookingChance(s,v,p,h),0);
  assert.ok(S.bookingChance(s,v,p,9)>0);
  A.upgradePitch(s,v,p,'lights');
  assert.ok(S.bookingChance(s,v,p,1)>0); assert.equal(S.bookingChance(s,v,p,2),0);
  s.time.gameHours = 18; tick(s,30,30000);
  const noLight = initial(); noLight.time.gameHours = 18; const events = tick(noLight,30,30000);
  assert.equal(events.filter(e => e.type === 'match_start').length,0);
});
test('Kondisyon düşer, bakım geri yükler', () => {
  const s = rich(), [v,p] = ids(s), pitch = s.venues[0].pitches[0];
  pitch.match = { startHour: 8, endHour: 9, kind: 'match', revenue: 800 };
  tick(s,1,1000); assert.equal(pitch.condition,98);
  const money = s.money; assert.equal(A.repairPitch(s,v,p).ok,true); assert.equal(pitch.condition,100); assert.ok(s.money<money);
  pitch.condition = 20; assert.ok(S.referencePrice(s,v,p)<800);
});
test('Fiyat kaydırıcısı talebi azaltır ve sınırlandırılır', () => {
  const s = rich(), [v,p] = ids(s);
  A.setPrice(s,v,p,400); const cheap = S.bookingChance(s,v,p,12);
  A.setPrice(s,v,p,1600); assert.ok(S.bookingChance(s,v,p,12)<cheap);
  A.setPrice(s,v,p,-1); assert.equal(s.venues[0].pitches[0].price,400);
});
test('15 iki seçenekli olay var, ödeme ve varsayılan çözüm tek sefer çalışır', () => {
  assert.ok(C.eventDefinitions.length>=15); assert.ok(C.eventDefinitions.every(e => e.choices.length===2));
  const s = rich(); s.pendingEvent = { id: 'injury', venueId: s.activeVenueId, expiresAtHour: 10, data: {} };
  const money = s.money; assert.equal(S.eventView(s).choices.length,2); assert.equal(A.resolveEvent(s,0).ok,true); assert.equal(s.money,money-1300); assert.equal(s.stats.eventsResolved,1);
  assert.equal(A.resolveEvent(s,0).ok,false);
  s.pendingEvent = { id: 'injury', venueId: s.activeVenueId, expiresAtHour: 10, data: {} }; tick(s,30,30000); assert.equal(s.stats.eventsResolved,2);
});
test('Olayı çözecek para yoksa hiçbir alan değişmez', () => {
  const s = initial(); s.money = 0; s.pendingEvent = { id: 'injury', venueId: s.activeVenueId, expiresAtHour: 50, data: {} };
  const before = serialize(s); assert.equal(A.resolveEvent(s,0).ok,false); assert.equal(serialize(s),before);
});
test('Çevrimdışı sınır, tek ödül, menajer ve gelecekte kayıt', () => {
  const s = initial(0), report = applyOffline(s,24*3600000);
  assert.equal(report.seconds,7200); assert.equal(report.cappedHours,2); assert.ok(report.earned>0);
  const money = s.money; assert.equal(applyOffline(s,24*3600000).earned,0); assert.equal(s.money,money);
  assert.equal(A.grantReward(s,'offline2x').ok,true); assert.equal(A.grantReward(s,'offline2x').ok,false);
  assert.equal(applyOffline(s,1).seconds,0);
  s.venues[0].staff.manager = 2; assert.equal(applyOffline(s,48*3600000).seconds,14400);
});
test('Bozuk migrate girdileri çökmez ve bilinmeyen alanlar korunur', () => {
  for (const raw of [null,{},[],1,'x',{ time: { gameHours: Number.MAX_VALUE } },{money: NaN, gems: Infinity, level: -10, venues: [null,{}, { facilities: null, staff: [], pitches: [null,{ upgrades: null, match: {} }] }], time: null, missions: { list: [null,5] }, pendingEvent: { id: 'injury' }, activeEffects: [null,{}]}]) {
    const s = migrate(raw); assert.ok(s.venues.length>0); assert.ok(Number.isFinite(s.money)); assert.ok(s.money>=0); assert.doesNotThrow(() => tick(s,30,30000));
  }
  const s = migrate({ experimental: { keep: true }, settings: { future: 'yes' }, money: -100 }); assert.deepEqual(s.experimental,{keep:true}); assert.equal(s.settings.future,'yes'); assert.equal(s.money,0);
  assert.doesNotThrow(() => deserialize('{oops'));
});
test('Prestij run sıfırlar ve kalıcı değerleri korur', () => {
  const s = rich(); s.totalEarned = 9000000; s.lifetimeEarned = 19000000; s.brandPoints = 2; s.gems = 17; s.settings.sound = false;
  assert.equal(S.prestigePreview(s),3); assert.equal(A.prestige(s).ok,true); assert.equal(s.brandPoints,5); assert.equal(s.totalEarned,0); assert.equal(s.lifetimeEarned,19000000); assert.equal(s.venues.length,1); assert.equal(s.level,1); assert.equal(s.settings.sound,false); assert.ok(s.gems>=17);
  assert.equal(A.prestige(s).ok,false);
});
test('10.000 tohumlu rastgele tick içinde para sonlu ve negatif değil', () => {
  const s = initial(), rng = { seed: 42 };
  s.venues[0].staff.keeper = 10; s.venues[0].staff.cashier = 10; s.money = 0;
  let now = 0;
  for (let i=0;i<10000;i++) {
    const dt = random(rng)*120; now += dt*1000;
    tick(s,dt,now);
    if (s.pendingEvent) A.resolveEvent(s,1);
    assert.ok(Number.isFinite(s.money)&&s.money>=0,`tick ${i}`);
  }
});
test('Büyük tick küçük adımlarla aynı ve 120 saniye üzeri offline', () => {
  const a = initial(), b = initial(); tick(a,30,30000);
  for (let i=1;i<=30;i++) tick(b,1,i*1000);
  assert.equal(a.seed,b.seed); assert.equal(a.money,b.money); assert.equal(a.stats.matches,b.stats.matches);
  assert.ok(Math.abs(a.time.gameHours-b.time.gameHours)<1e-10);
  const c = initial(); tick(c,121,121000); assert.equal(c.lastSavedAt,121000); assert.ok(c.lastOfflineEarned>0);
});
test('Turnuva normal maçla çakışmaz ve ödülü bir kere öder', () => {
  const s = rich(), [v,p] = ids(s); A.upgradePitch(s,v,p,'stands');
  assert.equal(A.startTournament(s,v,p,'local').ok,true); assert.equal(A.startTournament(s,v,p,'local').ok,false);
  const money = s.money; const events = tick(s,40,40000); assert.equal(s.stats.tournaments,1); assert.ok(s.money>money); assert.equal(events.filter(e => e.type === 'tournament_end').length,1);
  tick(s,40,80000); assert.equal(s.stats.tournaments,1);
});
test('Giriş ve görev ödülü tekrarlanmaz, boost süresi dolar', () => {
  const s = initial(); assert.equal(A.claimLogin(s,0).ok,true); assert.equal(A.claimLogin(s,0).ok,false);
  s.missions.list[0].progress = s.missions.list[0].target;
  assert.equal(A.claimMission(s,'matches').ok,true); assert.equal(A.claimMission(s,'matches').ok,false);
  A.grantReward(s,'speed2x'); const start = s.time.gameHours; tick(s,30,30000); assert.equal(s.time.gameHours,start+6);
  for (let i=1;i<=6;i++) tick(s,100,30000+i*100000);
  assert.equal(s.time.speed,1);
});
test('Süresi dolan masraflı veya saha isteyen olay parasızken de kapanır', () => {
  for (const id of ['supplier','sponsor','celebrity']) {
    const s = initial(); s.money = 0; s.pendingEvent = { id, venueId: s.activeVenueId, expiresAtHour: 9, data: {} };
    s.venues[0].pitches[0].match = { startHour: 9, endHour: 30, kind: 'match', revenue: 0 };
    tick(s,1,1000); assert.equal(s.pendingEvent,null,id); assert.equal(s.stats.eventsResolved,1); assert.ok(s.money>=0);
  }
});
test('Çatı ve kiralık çadır yağmur cezasını kaldırır', () => {
  const s = rich(), [v,p] = ids(s); const clear = S.bookingChance(s,v,p,12);
  s.weather = { kind: 'rain', untilHour: 100 }; assert.ok(S.bookingChance(s,v,p,12)<clear);
  A.upgradePitch(s,v,p,'roof'); assert.equal(S.bookingChance(s,v,p,12),clear);
  s.venues[0].pitches[0].upgrades.roof = 0;
  s.pendingEvent = { id: 'rain', venueId: v, expiresAtHour: 20, data: {} };
  A.resolveEvent(s,0); assert.equal(S.bookingChance(s,v,p,12),clear);
});
test('Çevrimdışı biten turnuva kaybolmaz ve gelecekte biten turnuva korunur', () => {
  const s = rich(), [v,p] = ids(s); A.upgradePitch(s,v,p,'stands'); A.startTournament(s,v,p,'local');
  applyOffline(s,10000); assert.equal(s.stats.tournaments,0); assert.equal(s.venues[0].pitches[0].match.kind,'tournament');
  const gems = s.gems; applyOffline(s,60000); assert.equal(s.stats.tournaments,1); assert.ok(s.gems>=gems+C.tournaments[0].gems);
  applyOffline(s,60000); assert.equal(s.stats.tournaments,1);
});
test('Migrate istatistiklerde bilinmeyen alanı korur ve giriş serisini temizler', () => {
  const s = migrate({ stats: { future: { keep: true } }, loginStreak: { count: -3 } });
  assert.deepEqual(s.stats.future,{keep:true}); assert.equal(s.loginStreak.count,0);
});
test('Geçersiz marka anahtarı state ve para birimlerini bozmaz', () => {
  const s = initial(), before = serialize(s);
  for (const key of ['constructor','__proto__','toString','invalid']) { assert.equal(A.buyBrandUpgrade(s,key).ok,false); assert.equal(serialize(s),before); }
});
test('İlk 30 saniyede gelir vardır', () => {
  const s = initial(); tick(s,30,30000); assert.ok(s.totalEarned>0);
});
