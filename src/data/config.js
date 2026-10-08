// Bütün ekonomi, zaman, kilit ve ödül değerleri burada tutulur.
export const config = {
  version: 1, seed: 7, maxMoney: Number.MAX_SAFE_INTEGER,
  limits: { stars: 5, gameHours: 1e12 },
  time: { secondsPerHour: 10, hoursPerDay: 24, startHour: 17, maxTick: 120, msPerSecond: 1000, secondsPerRealHour: 3600, secondsPerDay: 86400, minutesPerHour: 60, epsilon: 1e-8 },
  scaling: { hourlyFloor: 800, repairBaseHours: .125, repairConditionHours: .0125 },
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
    { id: 'local', name: 'Mahalle Kupası', hours: 4, cost: 15000, reward: 30000, costHours: 18.75, rewardHours: 37.5, stars: .15, gems: 2, unlock: 7, standsMultiplier: .1 },
    { id: 'company', name: 'Şirketler Ligi', hours: 6, cost: 60000, reward: 110000, costHours: 75, rewardHours: 137.5, stars: .25, gems: 4, unlock: 10, standsMultiplier: .1 },
    { id: 'stars', name: 'Yıldızlar Turnuvası', hours: 8, cost: 250000, reward: 450000, costHours: 312.5, rewardHours: 562.5, stars: .4, gems: 6, unlock: 15, standsMultiplier: .1 }
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
  { id: 'rain', title: "Yağmur var, maç var", text: "WhatsApp grubu geldi ama bulutlar da kadroya girmiş. Çatı yoksa herkes çadır soruyor.", passive: { rain: true, hours: 6 }, choices: [choice("Çadırı kur, maça devam", "Kira öde, 6 saat yağmur talebini koru.", { costHours: 1.875, rainProtection: true, hours: 6 }), choice("Yağmurun dinmesini bekle", "Kasa korunur, ıslanan takımların memnuniyeti azalır.", { stars: -.08 })] },
  { id: 'derby', title: "Derbi çay ocağına taşındı", text: "Takımlar topu bırakmış, derbinin kadrosunu tartışıyor. Herkes aynı soruyu soruyor: Ekran var mı?", passive: { demand: .5, hours: 4 }, choices: [choice("Dev ekranı kirala", "Ekrana para ayır, 4 saat kafeterya geliri 3 kat olsun.", { costHours: 1.875, cafe: 3, hours: 4 }), choice("Kendi maçımıza bakalım", "Ekran masrafı yok, derbi bekleyenlerin gönlü kalır.", { stars: -.04 })] },
  { id: 'company', title: "Muhasebe ile satış finalde", text: "Şirket ligi üç saat saha istiyor. Formada unvan yok ama müdür yine kaptan olmuş.", choices: [choice("Şirket maçlarını kabul et", "Toplu ödeme ve itibar kazan, bir sahayı 3 saat ayır.", { earnedHours: 7.5, block: 3, stars: .08 }), choice("Mahallenin saatini koru", "Saha açık kalır, şirketin gözünde biraz puan kaybedersin.", { stars: -.03 })] },
  { id: 'subscription', title: "WhatsApp grubuna sabit saat", text: "Grup 14 kişi olmuş, yine iki kişi eksik. Yine de her akşam 20:00 için abonelik istiyorlar.", choices: [choice("Gruba abonelik ver", "7 gün garantili 20:00 slotu, saat ücreti yüzde 30 indirimli.", { subscription: .7, hours: 168 }), choice("Saatleri serbest bırak", "Tam fiyatı koru, garanti gelirden ve biraz itibardan vazgeç.", { stars: -.03 })] },
  { id: 'inspection', title: "Denetçi kramponla gelmedi", text: "Belediye tesisi kontrol ediyor. Ortalama kondisyon yüzde 60 üstündeyse temiz saha ödülü var.", choices: [choice("Önce bakımı tamamla", "Gereken bakım bedelini öde, denetim ödülünü al.", { inspectionRepair: true, inspectionThreshold: 60, inspectionRewardHours: 2.25 }), choice("Olduğu gibi göster", "İyi kondisyonda ödül, düşük kondisyonda kasaya göre ölçekli ceza.", { inspection: true, inspectionThreshold: 60, inspectionRewardHours: 1.25, inspectionFineHours: 1.5 })] },
  { id: 'injury', title: "Bir bilek, bütün takım", text: "Oyuncu bileğini burktu. Arkadaşları skoru unutup tedavi masrafında destek bekliyor.", choices: [choice("Tedaviye destek ol", "Tedavi masrafını öde, güven ve itibar kazan.", { costHours: 1.625, stars: .05 }), choice("Takım kendi karşılasın", "Kasa korunur, mahallede itibarın ciddi düşer.", { stars: -.3 })] },
  { id: 'celebrity', title: "Eski yıldız mahalleye geldi", text: "Televizyonda gördükleri futbolcu tesiste. Herkes fotoğraf istiyor, yıldız ise iki saat antrenman.", choices: [choice("Sosyal medyada çekim yap", "Çekime para ayır, sosyal medya varsa 24 saat talep yüzde 40 artsın.", { costHours: 1.5, demand: 1.4, requiresSocial: true, hours: 24 }), choice("Özel antrenmanı sat", "Hemen ödeme al, sahayı 2 saat yıldız için ayır.", { earnedHours: 2.75, block: 2 })] },
  { id: 'power', title: "Işıklar gitti, itirazlar başladı", text: "Elektrik kesildi. Karanlıkta herkes kendi golünü sayıyor, şebeke onarımı dört saat sürecek.", passive: { noLights: true, hours: 4 }, choices: [choice("Jeneratör kirala", "Kira öde, 4 saat gece aydınlatmasını koru.", { costHours: 1.5, generator: true, hours: 4 }), choice("Gündüzü bekleyelim", "Masraf yok, gece maçları ve biraz itibar kaybolur.", { stars: -.08 })] },
  { id: 'theft', title: "Çim rulosu ortadan kayboldu", text: "Depodaki çim rulolarına birileri göz dikmiş. Zemin ekleri sahada kendini belli ediyor.", choices: [choice("Yeni çim getir", "Malzeme masrafı öde, kondisyonu 10 puan artır.", { costHours: 2, condition: 10 }), choice("Yamayla idare et", "Masraf yok, kondisyon 25 puan ve itibar düşer.", { condition: -25, stars: -.15 })] },
  { id: 'press', title: "Mahallenin spor sayfası", text: "Yerel gazete tesisi tanıtmak istiyor. Mahallenin abisi fotoğrafa girmeden önce çayını istiyor.", choices: [choice("Çaylı tanıtım günü yap", "Hazırlığa para ayır, 24 saat talep yüzde 20 artsın.", { costHours: 1.125, demand: 1.2, hours: 24 }), choice("Sahayı fotoğrafa ayır", "Nakit harcama, bir sahayı 2 saat kapatıp itibar kazan.", { stars: .1, block: 2 })] },
  { id: 'supplier', title: "Topçudan toplu alım teklifi", text: "Tedarikçi top, yelek ve eldivende indirim yapıyor. Peşinat peşin, muhabbet bedava.", choices: [choice("Peşinatı yatır", "Peşinat öde, 12 saat yükseltmeler yüzde 25 indirimli olsun.", { costHours: 1.875, discount: .75, hours: 12 }), choice("Kasayı elde tut", "İndirimden vazgeç, küçük teslimat ücretini öde.", { costHours: 0.25 })] },
  { id: 'fight', title: "Yenilen öder maçında kavga", text: "Son gol ofsayt mı değil mi tartışması kasaya kadar geldi. Yenilen takım ödeme kararına itiraz ediyor.", choices: [choice("Ücreti iade et, ortamı yatıştır", "İade masrafını karşıla, itibar kazan.", { costHours: 1, stars: .03 }), choice("Takımları dışarı al", "Saha 1 saat kapanır, itibar düşer.", { block: 1, stars: -.2 })] },
  { id: 'holiday', title: "İftar sonrası bir saat daha", text: "Ramazan gecesi mahalle iftardan sonra maç istiyor. Sahurdan önce rövanş da konuşuluyor.", choices: [choice("Gece programını hazırla", "Organizasyona para ayır, 24 saat gece talebi yüzde 50 artsın.", { costHours: 1.5, nightDemand: 1.5, hours: 24 }), choice("Ailelere sabah saati ayır", "24 saat sabah talebi yüzde 40 artsın, gelir yüzde 15 azalsın.", { morningDemand: 1.4, revenue: .85, hours: 24 })] },
  { id: 'rival', title: "Yan sokağa rakip saha açıldı", text: "Yeni tesis açılış indirimi yapıyor. Mahalle grubunda fiyat ekran görüntüleri dolaşıyor.", choices: [choice("Kendi sahanı tanıt", "Reklam masrafı öde, 24 saat talep yüzde 15 artsın.", { costHours: 1.75, demand: 1.15, hours: 24 }), choice("İndirimle karşılık ver", "24 saat talep yüzde 30 artsın, gelir yüzde 20 azalsın.", { demand: 1.3, revenue: .8, hours: 24 })] },
  { id: 'sponsor', title: "Formaya değil, tabelaya sponsor", text: "Yerel esnaf tabela için peşin ödeme öneriyor. Karşılığında iki gün fiyat tavanı istiyor.", choices: [choice("Sponsorla el sıkış", "Peşin gelir al, 48 saat fiyatı referans fiyatla sınırla.", { earnedHours: 4.375, priceCap: 1, hours: 48 }), choice("Bağımsız devam et", "Fiyat serbest kalsın, küçük hazırlık masrafını öde.", { costHours: 0.1875 })] }
];
eventDefinitions.push(
  { id: 'toast_rush', title: 'Tostçuya uzatmalar çıktı', text: 'İddialı maçın ardından iki takım da kaşarlı tost istiyor. Çaylar da büyük bardakta olacakmış.', choices: [choice('Ek mutfak vardiyası aç', 'Hazırlık masrafı öde, 6 saat kafeterya geliri iki kat olsun.', { costHours: 1.5, cafe: 2, hours: 6 }), choice('Mevcut sırayla devam et', 'Masraf yok, bekleyenlerin itirazı itibarı düşürür.', { stars: -.12 })] },
  { id: 'sprinkler', title: 'Sulama sistemi kendi liginde', text: 'Sulama başlığı bozuldu. Sağ kanat kupkuru, sol kanat göl kenarı gibi.', choices: [choice('Ustayı hemen çağır', 'Onarım masrafı öde, kondisyonu 10 puan artır.', { costHours: 2, condition: 10 }), choice('Elle sulayıp idare et', 'Para harcama, kondisyon 15 puan ve 8 saat talep yüzde 15 düşer.', { condition: -15, demand: .85, hours: 8 })] },
  { id: 'school', title: 'Okul takımı saha istiyor', text: 'Beden eğitimi öğretmeni çocuklara ücretsiz antrenman saati istiyor. Veliler de tribüne geleceklermiş.', choices: [choice('Okul takımını misafir et', 'Bir sahayı 2 saat ayır, mahallede itibar kazan.', { block: 2, stars: .22 }), choice('İndirimli ücret öner', 'Ödeme al ama ücretsiz destek bekleyenlerin gönlü kalır.', { earnedHours: 1.2, stars: -.08 })] },
  { id: 'amateur_fixture', title: 'Amatör lig fikstürü geldi', text: 'Lig temsilcisi dört saatlik toplu rezervasyon istiyor. Bu kez fikstür Excel yerine peçetede.', choices: [choice('Fikstürü sahaya al', 'Toplu ödeme ve itibar kazan, bir saha 4 saat kapanır.', { earnedHours: 7, block: 4, stars: .1 }), choice('Eski takımların saatini tut', 'Düzenli müşteriye alan bırak, lig temsilcisinde itibar kaybet.', { stars: -.06 })] },
  { id: 'goalkeeper', title: 'Kaleci bulunamadı', text: 'Herkes forvet, kimse kaleye geçmiyor. Kiralık kaleci telefonu bekliyor.', choices: [choice('Kiralık kaleci getir', 'Hizmet bedeli öde, 6 saat talep yüzde 20 artsın.', { costHours: 1, demand: 1.2, hours: 6 }), choice('Takımlar sırayla kaleye geçsin', 'Masraf yok, memnuniyet ve itibar düşer.', { stars: -.1 })] },
  { id: 'storm_net', title: 'Lodos fileyi götürdü', text: 'Rüzgar kale filesini yırttı. Top artık gol olunca otoparka gidiyor.', choices: [choice('Fileyi ve bağlantıları yenile', 'Onarım masrafı öde, itibar kazan.', { costHours: 2.5, stars: .05 }), choice('Geçici bağla, maçı sürdür', 'Nakit korunur, kondisyon 12 puan ve itibar düşer.', { condition: -12, stars: -.15 })] }
);
config.texts = {
  missions: {
    matches: { name: '{target} maç oynat', description: 'Bugün sahalarında {target} maç tamamlat.' },
    cafe: { name: 'Çay ocağının bereketi', description: 'Bugün kafeteryadan {target}₺ kazan.' },
    events: { name: 'Mahallenin işini çöz', description: 'Bugün {target} olayı karara bağla.' }
  },
  achievements: {
    first_pitch: { name: 'İlk ek saha', description: 'Toplam iki sahaya ulaş.' },
    matches100: { name: '100 maç oynat', description: 'Sahalarında 100 maç tamamlat.' },
    five_stars: { name: '5 yıldız ol', description: 'Bir şubeyi 5 yıldız itibara ulaştır.' },
    first_tournament: { name: 'İlk turnuva', description: 'İlk turnuvanı tamamla.' },
    first_venue: { name: 'İlk şube', description: 'Başlangıç tesisine ek olarak yeni bir şube aç.' },
    first_franchise: { name: 'İlk franchise', description: 'Markanı ilk kez franchise ederek yeni bir başlangıç yap.' }
  },
  cosmetics: {
    gold: { name: 'Altın saha çizgileri', description: 'Çizgiler altın sarısı olur.' },
    blue: { name: 'Mavi forma seti', description: 'Takımlar mavi formayla çıkar.' }
  },
  unlocks: {
    price: 'Yeni özellik açıldı: Fiyat ayarı', cafe: 'Yeni özellik açıldı: Çay ocağı ve kafeterya',
    events: 'Yeni özellik açıldı: Mahalle olayları', staff: 'Yeni özellik açıldı: Personel',
    rental: 'Yeni özellik açıldı: Ekipman kiralama', parking: 'Yeni özellik açıldı: Otopark',
    roof: 'Yeni özellik açıldı: Kapalı çatı', tournament: 'Yeni özellik açıldı: Turnuvalar',
    stands: 'Yeni özellik açıldı: Tribün', camera: 'Yeni özellik açıldı: Maç kaydı ve kamera',
    social: 'Yeni özellik açıldı: Sosyal medya', district: 'Yeni özellik açıldı: İlçe Spor Kompleksi (ikinci şube)',
    city: 'Yeni özellik açıldı: Şehir Arena', franchise: 'Yeni özellik açıldı: Franchise', mega: 'Yeni özellik açıldı: Mega Kompleks'
  },
  customerLines: {
    neighborhood: ["Abi saat 9'a saha var mı?", 'Yenilen öder, ona göre!', 'Krampon kiralık mı?', 'Kaleci bizde, forvet sizde.', 'Rövanş haftaya, aynı saat!', 'Maç sonrası çaylar bizden.', 'Abi duşta sıcak su var mı?'],
    company: ['Muhasebe yine defans yapıyor.', 'Faturayı şirkete kesebilir miyiz?', 'Müdür kaptan ama penaltıyı biz seçelim.', 'Otoparkta yer var mı?', 'Toplantı bitti, şimdi maç zamanı.'],
    veteran: ['Önce ısınalım, acelemiz yok.', 'Bizim zamanımızda bu top daha ağırdı.', 'Sabah saati bize iyi geliyor.', 'Maç sonrası çay açık olsun.', 'Pas at evlat, koşu mesafesini koruyalım.'],
    women: ['Haftaya lig maçı burada mı?', 'Formalar tamam, sıra üç puanda.', 'Maç kaydını takımla paylaşır mısınız?', 'Soyunma odasını ayırabilir miyiz?', 'Bugün presi bırakmıyoruz!'],
    academy: ['Hocam bugün kaleye ben geçebilir miyim?', 'Annem tribünden izliyor.', 'Antrenmandan sonra su alabilir miyiz?', 'Hocam gol sevincini de çalışalım!', 'Yeni topu ilk ben deneyeyim mi?']
  },
  pitchNames: ['1 Nolu Saha', '2 Nolu Saha', '3 Nolu Saha', '4 Nolu Saha', '5 Nolu Saha', '6 Nolu Saha', '7 Nolu Saha', '8 Nolu Saha']
};
config.eventDefinitions = eventDefinitions;
export default config;
