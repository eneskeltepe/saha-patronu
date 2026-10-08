// Bütün ekonomi, zaman, kilit ve ödül değerleri burada tutulur.
export const config = {
  version: 1, seed: 7, maxMoney: Number.MAX_SAFE_INTEGER,
  limits: { stars: 5, gameHours: 1e12 },
  time: { secondsPerHour: 10, hoursPerDay: 24, startHour: 9, maxTick: 120, msPerSecond: 1000, secondsPerRealHour: 3600, secondsPerDay: 86400, minutesPerHour: 60, epsilon: 1e-8 },
  balance: { seed: 7, stepSeconds: 10, decisionSeconds: 60, activeDays: 4, earlySeconds: 10800, casualDays: 12, sessionsPerDay: 3, sessionSeconds: 1200, repairBelow: 55, priceRatios: [.5,.75,1,1.25,1.5,1.75,2], maxPurchases: 100 },
  hours: { open: 9, dayClose: 18, nightClose: 2, morningEnd: 12, eveningStart: 19, subscription: 20, nightStart: 18, nightEnd: 6 },
  customerUnlocks: { womenSocial: 3 },
  initial: { money: 1500, gems: 0, stars: 2.5, condition: 100, price: 800, lineColor: '#ffffff', kit: 'default' },
  economy: { maxLevel: 10, growth: 1.6, maxChance: .97, reputationBase: .4, reputationPerStar: .2, elasticity: 1.6, maxPriceDemand: 1.3, minPriceRatio: .5, maxPriceRatio: 2, rain: .4, players: 14, brandIncome: .1, prestigeDivisor: 1e6, wear: 2, turfWear: .06, lowCondition: 50, conditionPriceFloor: .4, starAdjustment: .035, lockersStars: .12, cameraStars: .08, conditionStars: 2, cashierIncome: .05, parkingDemand: .03, socialDemand: .04, companyDemand: .05, veteranDemand: .03, womenDemand: .04, academyDemand: .12, keeperRepair: 2.5, unpaidEfficiency: .15, repairBase: 100, repairPerCondition: 10, offlineEfficiency: .5, managerEfficiency: .03, offlineHours: 2, managerHours: 1, offlineEfficiencyMax: .9, xpPerMoney: 1, gemsPerLevel: 2 },
  hourDemand: [.5,.5,0,0,0,0,0,0,0,.25,.25,.25,.35,.35,.35,.35,.35,.6,.6,.9,.9,.9,.9,.5],
  upgrades: {
    turf: { name: 'Zemin', base: 1800, reference: .12, unlock: 1, max: 10 },
    lights: { name: 'Aydınlatma', base: 16000, reference: .05, unlock: 1, max: 10 },
    lockers: { name: 'Soyunma odası', base: 10000, reference: .08, unlock: 1, max: 10 },
    stands: { name: 'Tribün', base: 12000, reference: 0, unlock: 7, max: 10 },
    roof: { name: 'Kapalı çatı', base: 450000, reference: 0, unlock: 6, max: 1 }
  },
  facilities: {
    cafe: { name: 'Kafeterya', base: 5000, perPlayer: 14, unlock: 3 },
    rental: { name: 'Ekipman kiralama', base: 55000, perMatch: 120, unlock: 6 },
    parking: { name: 'Otopark', base: 70000, unlock: 6 },
    camera: { name: 'Maç kaydı', base: 100000, perMatch: 180, unlock: 8 },
    social: { name: 'Sosyal medya', base: 80000, unlock: 8 }
  },
  staff: {
    keeper: { name: 'Saha görevlisi', base: 20000, salary: 45, unlock: 5 },
    cashier: { name: 'Kasiyer', base: 60000, salary: 20, unlock: 5 },
    manager: { name: 'Menajer', base: 90000, salary: 15, unlock: 5 },
    coach: { name: 'Antrenör', base: 75000, salary: 25, unlock: 5 }
  },
  venues: [
    { id: 'neighborhood', name: 'Mahalle Sahası', capacity: 2, multiplier: 1, cost: 0, pitchBase: 6000, unlock: 1 },
    { id: 'district', name: 'İlçe Spor Kompleksi', capacity: 4, multiplier: 1.8, cost: 100000, pitchBase: 300000, unlock: 10 },
    { id: 'city', name: 'Şehir Arena', capacity: 6, multiplier: 3.2, cost: 9000000, pitchBase: 1500000, unlock: 15 },
    { id: 'mega', name: 'Mega Kompleks', capacity: 8, multiplier: 6, cost: 70000000, pitchBase: 8000000, unlock: 25 }
  ],
  xpThresholds: [0, 0, 1600, 7000, 18000, 50000, 100000, 180000, 300000, 400000, 550000, 1500000, 3000000, 5000000, 8000000, 12000000, 25000000, 45000000, 80000000, 150000000, 3000000000, 3500000000, 4000000000, 4500000000, 5000000000, 6000000000],
  unlocks: { price: 2, cafe: 3, events: 4, staff: 5, rental: 6, parking: 6, roof: 6, tournament: 7, stands: 7, camera: 8, social: 8, district: 10, city: 15, franchise: 20, mega: 25 },
  events: { unlock: 4, gapMin: 3, gapMax: 6, expiry: 24, rainMin: 4, rainMax: 8, weatherChance: .12, weatherInterval: 6 },
  tournaments: [
    { id: 'local', name: 'Mahalle Kupası', hours: 4, cost: 15000, reward: 30000, stars: .15, gems: 2, unlock: 7, standsMultiplier: .1 },
    { id: 'company', name: 'Şirketler Ligi', hours: 6, cost: 60000, reward: 110000, stars: .25, gems: 4, unlock: 10, standsMultiplier: .1 },
    { id: 'stars', name: 'Yıldızlar Turnuvası', hours: 8, cost: 250000, reward: 450000, stars: .4, gems: 6, unlock: 15, standsMultiplier: .1 }
  ],
  missions: [{ id: 'matches', target: 20, reward: 3 }, { id: 'cafe', target: 5000, reward: 3 }, { id: 'events', target: 1, reward: 2 }],
  achievements: [{ id: 'first_pitch', stat: 'pitches', target: 2, reward: 2 }, { id: 'matches100', stat: 'matches', target: 100, reward: 5 }, { id: 'five_stars', stat: 'stars', target: 5, reward: 5 }, { id: 'first_tournament', stat: 'tournaments', target: 1, reward: 3 }, { id: 'first_venue', stat: 'venues', target: 2, reward: 5 }, { id: 'first_franchise', stat: 'prestiges', target: 1, reward: 10 }],
  rewards: { loginCycle: 7, loginBase: 2, timeskipGems: 15, instantRepairGems: 3, cosmeticGems: 10, boostGems: 10, boostSeconds: 600, speed: 2, gems_small: 50, gems_large: 250, starterMoney: 25000, starterGems: 20 },
  cosmetics: [{ id: 'gold', lineColor: '#ffd166' }, { id: 'blue', kit: 'blue' }],
  brandShop: { cash: { cost: 3, amount: 5000 }, lights: { cost: 5 }, xp: { cost: 4, multiplier: .1 } },
  customerColors: { neighborhood: ['#ff595e','#1982c4'], company: ['#ffffff','#6a4c93'], veteran: ['#ffca3a','#8ac926'], women: ['#ff70a6','#70d6ff'], academy: ['#f77f00','#43aa8b'] },
  messages: { invalid: 'Geçersiz işlem.', funds: 'Yeterli paranız yok.', locked: 'Bu özellik henüz açılmadı.', max: 'En yüksek seviyeye ulaşıldı.', missing: 'Şube veya saha bulunamadı.', capacity: 'Bu şubenin saha kapasitesi dolu.', busy: 'Saha şu anda meşgul.', claimed: 'Bu ödül zaten alındı.', incomplete: 'Görev henüz tamamlanmadı.' }
};

const choice = (label, hint, effect) => ({ label, hint, ...effect });
export const eventDefinitions = [
  { id: 'rain', title: 'Yağmur bastırdı', text: 'Takımlar yağmurdan kaçıyor.', passive: { rain: true, hours: 6 }, choices: [choice('Çadır kirala', '6 saat talebi koru, kira öde.', { cost: 1500, rainProtection: true, hours: 6 }), choice('Bekle', 'Masraf yok, yağmur talebi düşürür.', { stars: -.08 })] },
  { id: 'derby', title: 'Derbi akşamı', text: 'Herkes büyük maçı izliyor.', passive: { demand: .5, hours: 4 }, choices: [choice('Dev ekran kur', 'Kafeterya 3 kat kazanır, ekran masrafı var.', { cost: 1500, cafe: 3, hours: 4 }), choice('Normal devam et', 'Ekran masrafı yok, müşteri memnuniyeti düşer.', { stars: -.04 })] },
  { id: 'company', title: 'Şirket turnuvası teklifi', text: 'Şirket üç saatlik saha istiyor.', choices: [choice('Kabul et', 'Saha 3 saat kapanır, ödeme ve itibar gelir.', { earned: 6000, block: 3, stars: .08 }), choice('Reddet', 'Saha açık kalır, şirketi kaybedersin.', { stars: -.03 })] },
  { id: 'subscription', title: 'Mahalle aboneliği', text: 'Takım her akşam 20:00 için indirim istiyor.', choices: [choice('Abonelik ver', '7 gün garantili slot, fiyat yüzde 30 düşük.', { subscription: .7, hours: 168 }), choice('Serbest fiyatı koru', 'Garanti yok, itibar biraz düşer.', { stars: -.03 })] },
  { id: 'inspection', title: 'Belediye denetimi', text: 'Ortalama kondisyon yüzde 60 üstündeyse ödül var.', choices: [choice('Hemen bakım yap', 'Bakım ücretini öde, denetim ödülünü al.', { inspectionRepair: true, inspectionThreshold: 60, inspectionReward: 1800 }), choice('Denetimi bekle', 'İyi durumda ödül, kötü durumda ceza.', { inspection: true, inspectionThreshold: 60, inspectionReward: 1000, inspectionFine: 1200 })] },
  { id: 'injury', title: 'Oyuncu sakatlandı', text: 'Oyuncunun tedaviye ihtiyacı var.', choices: [choice('Tedavi masrafını öde', 'Masraf karşılığında itibar korunur.', { cost: 1300, stars: .05 }), choice('Sorumluluk bizde değil', 'Para harcanmaz, itibar düşer.', { stars: -.3 })] },
  { id: 'celebrity', title: 'Ünlü futbolcu geldi', text: 'Fotoğraf çekimi için izin istiyor.', choices: [choice('Çekim düzenle', 'Çekim masrafı var, sosyal medyayla 1 gün talep artar.', { cost: 1200, demand: 1.4, requiresSocial: true, hours: 24 }), choice('Özel antrenman sat', 'Hemen ödeme, saha 2 saat kapanır.', { earned: 2200, block: 2 })] },
  { id: 'power', title: 'Elektrik kesintisi', text: 'Şebeke onarılıyor.', passive: { noLights: true, hours: 4 }, choices: [choice('Jeneratör kirala', '4 saat ışıkları koru, kira öde.', { cost: 1200, generator: true, hours: 4 }), choice('Gündüzü bekle', 'Masraf yok, gece maçları durur.', { stars: -.08 })] },
  { id: 'theft', title: 'Zemin hırsızlığı', text: 'Çim ruloları zarar gördü.', choices: [choice('Yeni çim al', 'Masraf karşılığında kondisyonu koru.', { cost: 1600, condition: 10 }), choice('Yama ile idare et', 'Masraf yok, kondisyon ve itibar düşer.', { condition: -25, stars: -.15 })] },
  { id: 'press', title: 'Yerel gazete röportajı', text: 'Muhabir tesisini tanıtmak istiyor.', choices: [choice('Tanıtım günü düzenle', '1 gün talep artar, hazırlık masrafı var.', { cost: 900, demand: 1.2, hours: 24 }), choice('Sahayı fotoğraflara ayır', 'Masraf yok, saha 2 saat kapanır.', { stars: .1, block: 2 })] },
  { id: 'supplier', title: 'Tedarikçi indirimi', text: 'Toplu sipariş için peşinat gerekiyor.', choices: [choice('Peşinat ver', '12 saat yükseltmeler indirimli, peşinat öde.', { cost: 1500, discount: .75, hours: 12 }), choice('Nakit tut', 'İndirim yok, küçük teslimat masrafı.', { cost: 200 })] },
  { id: 'fight', title: 'Kavga çıktı', text: 'İki takım arasında tartışma var.', choices: [choice('Ücreti iade et', 'İtibar korunur, iade masrafı var.', { cost: 800, stars: .03 }), choice('Takımları çıkar', 'Saha 1 saat kapanır, itibar düşer.', { block: 1, stars: -.2 })] },
  { id: 'holiday', title: 'Bayram gecesi', text: 'Mahalle gece turnuvası istiyor.', choices: [choice('Gece programı yap', 'Gece talebi artar, organizasyon masrafı var.', { cost: 1200, nightDemand: 1.5, hours: 24 }), choice('Ailelere sabah ayır', 'Sabah talebi artar, fiyatlar indirimli.', { morningDemand: 1.4, revenue: .85, hours: 24 })] },
  { id: 'rival', title: 'Yeni rakip saha', text: 'Rakip açılış kampanyası başlattı.', choices: [choice('Reklam ver', '1 gün talep korunur, reklam masrafı var.', { cost: 1400, demand: 1.15, hours: 24 }), choice('Fiyat savaşına gir', 'Talep artar, gelir yüzde 20 düşer.', { demand: 1.3, revenue: .8, hours: 24 })] },
  { id: 'sponsor', title: 'Sponsor teklifi', text: 'Sponsor tabela ve fiyat tavanı istiyor.', choices: [choice('Sponsorluğu kabul et', 'Sabit gelir gelir, 2 gün fiyat tavanı uygulanır.', { earned: 3500, priceCap: 1, hours: 48 }), choice('Bağımsız kal', 'Fiyat serbest, sponsor hazırlığı masrafı var.', { cost: 150 })] }
];
config.eventDefinitions = eventDefinitions;
export default config;
