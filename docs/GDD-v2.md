# Saha Patronu – GDD v2 (yeni yön: idle tycoon)

> Önceki sürüm (sekmeli strateji simülasyonu) "çirkin, sıkıcı, karışık" bulundu. v2 tam tersini hedefler:
> **göze güzel, sürekli bir şey olan, tek parmakla anlaşılan** bir boşta-kazanç (idle tycoon) oyunu.
> Referanslar: Eatventure, Idle Miner Tycoon, My Perfect Hotel. Prototip: `proto/` (oynanabilir).

## 1. Tek cümle
Mahalle halı sahasını işletirsin: takımlar gelir, gişede öder, soyunur, maç yapar, çay içer, gider; sen paraya dokunur, istasyonları yükseltir, yeni yapılar açarsın.

## 2. Görsel dil
- 2D, tepeden bakış, Kenney "Sports Pack" + "Racing Pack" (CC0) ile aynı düz çizgi film stili: yuvarlak köşe, düz renk, koyu ince kontur, yumuşak gölge.
- Paketlerde olmayan binalar (gişe, soyunma odası, çay ocağı, duş, büfe) kodla aynı stilde çizilir; çatılar yukarıdan, tabela/tente/baca dumanı gibi küçük detaylarla.
- Dünya tek, kaydırılabilir bir sahne. Her şey **sahnede görünür**: kuyruklar, maç, para yığınları, işçiler.

## 3. Çekirdek döngü
1. Takımlar (5 kişi, aynı forma rengi) yürüyerek ya da (otopark varsa) arabayla gelir.
2. **Gişe** (giriş ücreti) → **Soyunma odası** (kısa duraklama) → **Saha** (iki takım 5'e 5 maç; top, gol, "GOL!", file sallanır, tezahürat) → (varsa **Duş**) → **Çay ocağı** (çay/tost/ayran, masada oturur) → (varsa **Büfe**) → ayrılır.
3. Her istasyon müşteri başına para üretir; para istasyonun yanında **banknot yığını** olarak birikir.
4. Oyuncu yığına dokunur → paralar uçarak sayaca gider (ses + titreşim).
5. Para ile istasyon yükseltilir; darboğaz değişir; yeni yapı açılır.

**Strateji sinyali = görünür kuyruk.** Hangi istasyonun önünde sıra varsa yavaş olan odur. Sahayı bekleyen takım sayısı sınırı aşarsa yeni gelenler "Saha dolu abi!" deyip geri döner (kaçan müşteri).

## 4. İstasyonlar
| İstasyon | Ne yapar | Taban kazanç | Süre | Kilometre taşları (Sv 10 / 25 / 50 / 100) |
|---|---|---|---|---|
| Gişe | giriş ücreti | 4₺/müşteri | 1.5 sn | +1 cam / Turnike (hız x2) / +1 cam / Kartlı geçiş (x2) |
| Soyunma odası | dolap ücreti | 2₺ | 4 sn, 3 kişi | +3 dolap / Geniş oda (x2) / İkinci oda (+4) / Lüks (x2) |
| Saha 1 | saha kirası (oyuncu başı) | 6₺ | 18 sn maç | **Halı saha** (kazanç x2) / **Işıklı saha** (gece maç + x1.5) / **Tribünlü** (x3) / Pro (x2) |
| Çay ocağı | çay, tost, ayran | 3₺ | 2.4 sn | **Çay kulübesi** (+1) / **Bahçe kafe** (x2, şemsiyeli masalar) / +1 semaver / Meşhur çay (x2) |
| Otopark (inşa) | park ücreti, daha sık müşteri | 10₺/araba | – | her taşta kazanç x2 |
| Saha 2 (inşa) | ikinci maç aynı anda | 12₺ | 18 sn | Saha 1 ile aynı |
| Duşlar (inşa) | maç sonrası duş | 8₺ | 3 sn, 2 kabin | +2 / x2 / Sauna (+2) / Spa (x2) |
| Tost büfesi (inşa) | tost/ayran | 18₺ | 3 sn | +1 / x2 / +1 / x2 |

- Her seviye: kazanç +%22, süre x0.988. Maliyet üstel (büyüme 1.105–1.16).
- Her kilometre taşı: konfeti + fanfar + **istasyonun görünümü değişir** (toprak → halı → projektörlü → tribünlü; tezgah → kulübe → kafe).
- Arayüz: istasyona dokun → alttan tek kart: ad, seviye, Kazanç/Süre/Kapasite (sonraki seviye farkı yeşil), kilometre taşı çubuğu, x1/x10/MAX ve büyük yeşil **Yükselt**.
- Yönetici (her istasyona bir kez, parayla): parayı otomatik toplar, çevrimdışı kazanç sağlar.
- İnşa alanları dünyada kesik çizgili "+ İnşa et (fiyat)" olarak durur; inşa anı büyük kutlama (konfeti, "AÇILDI!", kamera kayar).

## 5. Gün / gece
- Bir oyun günü ≈ 4 dk; gece ≈ %25.
- Işıksız sahada gece **maç başlamaz** ("Işık yok, maç yok!"), müşteriler "Abi ışıkları yak!" der → Sv 25 projektörleri için güçlü motivasyon.
- Işıklı gece sahnesi: projektör konileri, sokak lambası ışık havuzları, sıcak bina parıltısı.

## 6. Hedefler (tek seferde tek hedef)
Üst ortada tek kart: hedef + ilerleme çubuğu + elmas ödülü; bitince "Ödülü al!" butonu.
Prototipte 22 hedef: kasa Sv3 → saha Sv5 → çay Sv10 → kasa yöneticisi → halı saha → soyunma Sv10 → 10 maç → otopark → çay yöneticisi → **2. saha** → ışık → duş → kafe → saha yöneticisi → soyunma Sv25 → saha 2 halı → duş Sv10 → otopark Sv10 → 100 maç → saha 2 ışık → tost büfesi → **tribün**.
Hepsi bitince: "Tesis tamamlandı! Yeni tesis: İlçe Spor Kompleksi (yakında)".

## 7. Tempo (pace.mjs, açgözlü oyuncu, 3 sn'de bir toplama)
| Olay | Hedef | Simülasyon |
|---|---|---|
| İlk yükseltme | ~10 sn | 0:09 |
| İlk kilometre taşı | 2–3 dk | 1:27 (gişe Sv10), saha halı 2:03 |
| 2. saha | 8–10 dk | 10:05 |
| Tüm hedefler | 45–60 dk | 49:16 |
Gerçek oyuncu açgözlü botdan yavaştır; erken taşlar sahada biraz daha geç gelir.

## 8. Arayüz ilkeleri
- Dikey öncelikli (390×844), yatay da çalışır. HUD: sol üst para (sayarak artar, zıplar) + elmas + saat; üst orta/sağ hedef kartı; altta yalnızca 3 yuvarlak buton (Yöneticiler, Mağaza, Ayarlar).
- Sekme paneli yok, uzun liste yok. Kalın, yuvarlak, 3B basılan butonlar; konturlu yazı; her dokunuşta geri bildirim (ses, zıplama, titreşim).
- İlk açılış ipuçları (sallanan el): "Paraya dokun!" → "Kasayı yükselt!" → "Yönetici al!".
- Konuşma balonları: "Abi saha boş mu?", "Yenilen öder!", "Çaylar benden!", "Sıra ne zaman abi?".

## 9. Para kazanma kancaları
- **Ödüllü reklam**: çevrimdışı kazancı 2x al; Turbo x2 (5 dk her şey iki kat hızlı).
- **Elmas**: hedef ödülleri; Turbo (10 elmas), "Kasa dolusu para" (25 elmas = 30 dk kazanç).
- **Elmas paketleri / reklamsız paket** (IAP). Prototipte sahte.
- İleride: yeni tesisler (İlçe Spor Kompleksi, Stadyum) = prestij/sıfırlama döngüsü; sezonluk etkinlik (derbi haftası).

## 10. Çevrimdışı kazanç
Yalnızca yöneticisi olan istasyonlar, son 5 dk ortalama gelir hızıyla, en fazla 2 saat. Dönüşte "Hoş geldin patron!" + "▶ 2x Al".

## 11. Teknik (prototip)
Statik sayfa, saf ES modülleri, derleme yok. Canvas 2D, DPR ≤ 2, zemin katmanı önceden çizilip yalnızca yapı/görünüm değişince yenilenir; gece ışıkları önbellekli sprite. Ses tamamen WebAudio sentezi. Kayıt: `localStorage["sahaPatronuProto.save"]`. Tüm sayılar `proto/src/config.js`; tempo testi `node proto/tools/pace.mjs`.
