// Saha Patronu prototipi: TÜM ekonomi / tempo sayıları burada. proto/tools/pace.mjs bu dosyayla ayarlanır.
export const CFG = {
  startMoney: 0,
  walkSpeed: 78,            // dünya px / sn
  teamSize: 5,
  arrival: {                // takım geliş aralığı (sn) = base / (1 + perLevel * toplamSeviye), min sınırlı
    base: 10, min: 3, perLevel: 0.02,
    otopark: 0.75,          // otopark varsa aralık çarpanı
    night: 1.8,             // gece daha seyrek gelir
    carShare: 0.6,          // otopark varsa takımların arabayla gelme oranı
  },
  backlog: { base: 2, perPitch: 2 },   // sahayı bekleyen takım sınırı; aşılırsa yeni takım geri döner
  queueMax: 16,             // bir kuyruk bundan uzunsa müşteri o istasyonu atlar
  soloWait: 9,              // tek takım bu kadar bekleyince kendi arasında maç yapar
  seatTime: 4,              // çay masasında oturma (görsel)
  mgrInterval: 2.5,         // yönetici toplama aralığı
  offlineCapH: 2,
  offlineMul: 1,            // çevrimdışı kazanç çarpanı (yöneticili istasyon gelir hızı x süre)
  day: { length: 240, start: 0.30, nightFrom: 0.80, nightTo: 0.05 }, // 0..1 gün; gece 19:12-01:12 (~%25)
  milestones: [10, 25, 50, 100],
  levelProfit: 0.22,        // her seviye +%22 taban kazanç
  levelSpeed: 0.988,        // her seviye süre x0.988
  boost: { mult: 2, dur: 300, gemCost: 10 },
  instantCash: { gemCost: 25, minutes: 30 },
  dusShare: 0.7, bufeShare: 0.6,
};

// ms: kilometre taşları (CFG.milestones sırasıyla). cap:+N kapasite, speed:xN hız, profit:xN kazanç.
export const STATIONS = {
  gise:    { name: 'Gişe', short: 'Kasa', profit: 4, time: 1.5, cap: 1, cost: 8, growth: 1.16, mgr: 120,
             ms: [{ cap: 1, txt: 'İkinci gişe camı' }, { speed: 2, txt: 'Turnike' }, { cap: 1, txt: 'Üçüncü cam' }, { speed: 2, txt: 'Kartlı geçiş' }] },
  soyunma: { name: 'Soyunma Odası', short: 'Soyunma', profit: 2, time: 4, cap: 3, cost: 18, growth: 1.11, mgr: 900,
             ms: [{ cap: 3, txt: 'Yeni dolaplar' }, { speed: 2, txt: 'Geniş oda' }, { cap: 4, txt: 'İkinci oda' }, { speed: 2, txt: 'Lüks soyunma' }] },
  saha1:   { name: 'Saha 1', short: 'Saha', profit: 6, time: 18, cap: 1, cost: 30, growth: 1.125, mgr: 2500, pitch: true,
             ms: [{ profit: 2, txt: 'Halı saha zemini' }, { speed: 1.5, lights: true, txt: 'Işıklı saha (gece maç!)' }, { profit: 3, txt: 'Tribünlü saha' }, { speed: 2, txt: 'Profesyonel saha' }] },
  cay:     { name: 'Çay Ocağı', short: 'Çay', profit: 3, time: 2.4, cap: 1, cost: 12, growth: 1.14, mgr: 600,
             ms: [{ cap: 1, txt: 'Çay kulübesi' }, { speed: 2, txt: 'Bahçe kafe' }, { cap: 1, txt: 'İkinci semaver' }, { profit: 2, txt: 'Meşhur çay' }] },
  otopark: { name: 'Otopark', short: 'Otopark', profit: 10, time: 0, cap: 4, cost: 400, growth: 1.14, mgr: 6000, build: 1500, perCar: true,
             ms: [{ profit: 2, txt: 'Asfalt zemin' }, { profit: 2, txt: 'Vale' }, { profit: 2, txt: 'Kapalı otopark' }, { profit: 2, txt: 'VIP park' }] },
  saha2:   { name: 'Saha 2', short: 'Saha 2', profit: 12, time: 18, cap: 1, cost: 300, growth: 1.12, mgr: 30000, pitch: true, build: 7000,
             ms: [{ profit: 2, txt: 'Halı saha zemini' }, { speed: 1.5, lights: true, txt: 'Işıklı saha (gece maç!)' }, { profit: 3, txt: 'Tribünlü saha' }, { speed: 2, txt: 'Profesyonel saha' }] },
  dus:     { name: 'Duşlar', short: 'Duş', profit: 8, time: 3, cap: 2, cost: 350, growth: 1.12, mgr: 20000, build: 9000,
             ms: [{ cap: 2, txt: 'Yeni kabinler' }, { speed: 2, txt: 'Sıcak su kazanı' }, { cap: 2, txt: 'Sauna' }, { profit: 2, txt: 'Spa' }] },
  bufe:    { name: 'Tost Büfesi', short: 'Büfe', profit: 18, time: 3, cap: 1, cost: 6000, growth: 1.12, mgr: 80000, build: 60000,
             ms: [{ cap: 1, txt: 'İkinci tost makinesi' }, { speed: 2, txt: 'Kaşarlı sucuklu' }, { cap: 1, txt: 'Ayran makinesi' }, { profit: 2, txt: 'Meşhur tost' }] },
};
export const ORDER = ['gise', 'soyunma', 'saha1', 'cay', 'otopark', 'saha2', 'dus', 'bufe'];

// Tek seferde tek hedef. type: level | build | manager | matches | goals
export const GOALS = [
  { type: 'level', st: 'gise', n: 3, gems: 2, txt: 'Kasayı 3. seviyeye çıkar' },
  { type: 'level', st: 'saha1', n: 5, gems: 2, txt: 'Sahayı 5. seviyeye çıkar' },
  { type: 'level', st: 'cay', n: 10, gems: 3, txt: 'Çay ocağını 10. seviyeye çıkar' },
  { type: 'manager', st: 'gise', gems: 3, txt: 'Kasaya yönetici al' },
  { type: 'level', st: 'saha1', n: 10, gems: 5, txt: 'Sahayı halı saha yap (Sv 10)' },
  { type: 'level', st: 'soyunma', n: 10, gems: 3, txt: 'Soyunma odasını 10. seviyeye çıkar' },
  { type: 'matches', n: 10, gems: 5, txt: '10 maç oynat' },
  { type: 'build', st: 'otopark', gems: 5, txt: 'Otopark inşa et' },
  { type: 'manager', st: 'cay', gems: 5, txt: 'Çay ocağına yönetici al' },
  { type: 'build', st: 'saha2', gems: 10, txt: '2. sahayı aç' },
  { type: 'level', st: 'saha1', n: 25, gems: 8, txt: 'Saha 1\'e ışık tak (Sv 25)' },
  { type: 'build', st: 'dus', gems: 8, txt: 'Duşları inşa et' },
  { type: 'level', st: 'cay', n: 25, gems: 8, txt: 'Çay ocağını kafeye çevir (Sv 25)' },
  { type: 'manager', st: 'saha1', gems: 6, txt: 'Sahaya yönetici al' },
  { type: 'level', st: 'soyunma', n: 25, gems: 6, txt: 'Soyunma odasını büyüt (Sv 25)' },
  { type: 'level', st: 'saha2', n: 10, gems: 6, txt: 'Saha 2 için halı zemin (Sv 10)' },
  { type: 'level', st: 'dus', n: 10, gems: 6, txt: 'Duşları 10. seviyeye çıkar' },
  { type: 'level', st: 'otopark', n: 10, gems: 6, txt: 'Otoparkı asfaltla (Sv 10)' },
  { type: 'matches', n: 100, gems: 8, txt: '100 maç oynat' },
  { type: 'level', st: 'saha2', n: 25, gems: 10, txt: 'Saha 2\'ye ışık tak (Sv 25)' },
  { type: 'build', st: 'bufe', gems: 10, txt: 'Tost büfesini aç' },
  { type: 'level', st: 'saha1', n: 50, gems: 20, txt: 'Saha 1\'e tribün yap (Sv 50)' },
];

export const KITS = ['blue', 'red', 'green', 'white', 'crimson', 'yellow', 'purple'];
export const HAIRS = ['black', 'blonde', 'brown'];
