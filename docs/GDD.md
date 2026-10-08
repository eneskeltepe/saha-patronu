# Saha Patronu — Oyun Tasarım Belgesi (v1)

Dikey öncelikli, Türkçe, idle/tycoon mobil oyun. Oyuncu küçük bir mahalle halı sahasıyla başlar, sahaları ve tesisleri geliştirir, fiyat ve personel kararları verir, olaylara tepki verir, yeni şubeler açar, sonunda markasını franchise ederek (prestij) daha güçlü baştan başlar.

Teknik: saf HTML/CSS/JS, ES modülleri, derleme yok. PWA (manifest + service worker). GitHub Pages'te yayın, ileride TWA ile Play Store (AAB).

## 1. Tasarım hedefleri
- İlk 30 saniyede para akmaya başlar, ilk 2 dakikada ilk anlamlı karar (ilk yükseltme).
- Özellikler oyuncu seviyesiyle yavaş açılır, ekran ilk anda kalabalık değil.
- Her satın alma bir seçimdir: aynı parayla farklı stratejiler (fiyatı artır mı, ışık mı al, kafeterya mı aç).
- Yükseltmeler az ama anlamlı seviyeli (en çok 10), "1.15 çarpanlı 500 seviye" tarzı anlamsız tıklama yok.
- Tempo hedefleri (aktif oyunla): 5 dk ikinci saha, 30 dk aydınlatma + kafeterya, 2-3 saat ikinci şube, ilk prestij 2-3 gün.
- Çevrimdışı kazanç var ama sınırlı (2 saat, menajerle artar), geri dönme sebebi verir.

## 2. Zaman
- 1 oyun saati = 10 gerçek saniye (1x). 1 oyun günü = 4 dakika.
- Gün içi saat görünür. Gece/gündüz renk tonu değişir.
- Maçlar 1 oyun saatlik slotlardır, saat başında başlar.
- Sahalar 09:00-02:00 açık. Aydınlatma yoksa sadece 09:00-18:00 (ışık en büyük ilk hedef, çünkü talep akşam patlar).
- Hız artırma (reklamla 2x, 10 dk) sim hızını 2 katına çıkarır.

## 3. Talep ve gelir (bütün sayılar `src/data/config.js` içinde, kodda sabit sayı yok)
Her saha her saat başında boşsa rezervasyon olasılığı:
`p = saatTabanı(saat) × itibarÇarpanı × fiyatÇarpanı × havaÇarpanı × olayÇarpanı`, en çok 0.97.
- saatTabanı: 09-12: 0.25, 12-17: 0.35, 17-19: 0.60, 19-23: 0.90, 23-02: 0.50
- itibarÇarpanı = 0.4 + 0.2 × yıldız (yıldız 0-5)
- fiyatÇarpanı = clamp((referansFiyat / fiyat) ^ 1.6, 0, 1.3). Referans fiyat sahanın kalitesine göre artar (zemin, soyunma odası, kondisyon). Oyuncu fiyatı kaydırıcıyla ayarlar (referansın %50-%200'ü). Bu temel strateji kolu.
- havaÇarpanı: yağmurda 0.4 (kapalı çatılı sahada 1.0).
- Maç geliri = fiyat + ekstra harcamalar (14 oyuncu × kafeterya kişi başı + ekipman kiralama + maç videosu satışı), tesis seviyelerine göre.
- Başlangıç: 1.500₺ para, 1 saha, fiyat 800₺/saat.

## 4. Saha (pitch)
Her şubenin saha kapasitesi var. Saha yükseltmeleri (her biri 0-10 seviye, maliyet = taban × 1.6^seviye):
- **Zemin** (referans fiyat +%12/sv, aşınma -%6/sv)
- **Aydınlatma** (sv1 gece saatlerini açar, sonrakiler referans fiyat +%5/sv)
- **Soyunma odası & duş** (referans fiyat +%8/sv, itibar hedefi +)
- **Tribün** (turnuva için gerekli, turnuva geliri +)
- **Kapalı çatı** (tek seviye, pahalı: yağmur ve kış etkisini yok eder)
- **Kondisyon** %0-100: her maç %2 düşer (zemin seviyesi azaltır). %50 altında referans fiyat ve itibar düşer. "Bakım yap" butonu para karşılığı %100'e çeker. Saha görevlisi otomatik onarır.

## 5. Şube tesisleri (venue facilities, 0-10 seviye)
- **Kafeterya** (çay, tost, su; kişi başı harcama)
- **Ekipman kiralama** (krampon, forma, eldiven)
- **Otopark** (talep +%3/sv)
- **Maç kaydı & kamera** (maç başı video satışı, itibar +)
- **Sosyal medya** (talep +, olay "influencer" şansı +)

## 6. Personel (her şubede, işe al + seviye atlat, maaş gideri saatlik)
- **Saha görevlisi**: kondisyonu otomatik onarır
- **Kasiyer**: gelir +%5/sv
- **Menajer**: çevrimdışı süre sınırını +1 saat/sv uzatır, çevrimdışı verimi artırır
- **Antrenör**: çocuk akademisini açar (sabah saatlerinde ekstra talep)
- Maaşlar gerçek bir gider: kötü yönetimde para azalabilir (ama asla 0'ın altında oyun kitlenmez, borç yok, gider ödenemezse personel verimi düşer).

## 7. Müşteri türleri (görsel çeşitlilik + talep katmanları)
Mahalle gençleri (her zaman), şirket ekipleri (otopark + soyunma odası ister, yüksek fiyatı kabul eder), veteranlar (sabah), kadın ligi (sosyal medya sv3), çocuk akademisi (antrenör). Her tür farklı forma renkleriyle görünür ve küçük bir talep payı ekler.

## 8. Olaylar (senaryo kartları)
Her 3-6 oyun saatinde bir, oyuncu seviyesi 4'ten sonra. İki seçenekli, ödünleşimli kartlar. En az 15 olay. Örnekler:
- **Yağmur bastırdı**: (pasif, 4-8 saat talep düşer) çatı yoksa "Çadır kirala (para)" ya da "Bekle".
- **Derbi akşamı**: talep -%50, ama "Dev ekran kur (para)" seçilirse kafeterya geliri 3x.
- **Şirket turnuvası teklifi**: 3 saat bir sahayı kapat, büyük ödeme + itibar. Ya da reddet.
- **Mahalle takımı abonelik istiyor**: her gün 20:00 slotu indirimli ama garantili.
- **Belediye denetimi**: kondisyon ortalaması %60 üstündeyse ödül, değilse ceza. "Rüşvet" seçeneği yok (Play politikası), "Hemen bakım yap" seçeneği var.
- **Oyuncu sakatlandı**: "Hastane masrafını öde" (itibar korunur) ya da "Sorumluluk bizde değil" (itibar düşer).
- **Ünlü futbolcu geldi**: sosyal medya varsa 1 gün talep +%40.
- **Elektrik kesintisi**, **zemin hırsızlığı (!)**, **yerel gazete röportajı**, **tedarikçi indirimi**, **kavga çıktı**, **ramazan/bayram** (gece talebi değişir), **yeni rakip saha açıldı** (fiyat savaşı), **sponsor teklifi** (sabit gelir karşılığı fiyat tavanı).
Olay kartı UI'da modal olarak çıkar. Oyuncu açmazsa 1 oyun günü sonra varsayılan seçenek uygulanır.

## 9. Oyuncu seviyesi ve kilitler (onboarding temposu)
XP = kazanılan paradan ve görevlerden. Seviye kilitleri:
Sv1 saha + bakım · Sv2 fiyat kaydırıcı · Sv3 kafeterya · Sv4 olaylar · Sv5 personel · Sv6 ekipman/otopark · Sv7 turnuva · Sv8 kamera & sosyal medya · Sv10 ikinci şube · Sv15 üçüncü şube · Sv20 franchise (prestij).
Her seviye atlamada küçük elmas ödülü ve "Yeni özellik açıldı" kartı.

## 10. Şubeler (venues)
| Şube | Açılış | Saha kapasitesi | Fiyat çarpanı |
|---|---|---|---|
| Mahalle Sahası | başlangıç | 2 | 1.0 |
| İlçe Spor Kompleksi | Sv10 + para | 4 | 1.8 |
| Şehir Arena | Sv15 + para | 6 | 3.2 |
| Mega Kompleks | Sv25 + para | 8 | 6.0 |
Şubeler aynı anda çalışır. Üstte şube değiştirici.

## 11. Turnuvalar (Sv7, tribün gerekir)
Sahayı N saat kapatır, giriş masrafı var, sonunda büyük ödeme + itibar + elmas. Tribün seviyesi ödülü artırır. Mahalle Kupası, Şirketler Ligi, Yıldızlar Turnuvası.

## 12. Para birimleri
- **₺ Para**: her şey.
- **Elmas**: görevler, başarımlar, seviye atlama, günlük giriş. Harcama: zaman atlama (2 saatlik kazanç anında), hızlandırma, kozmetik (saha çizgi rengi, forma seti), anında bakım. İleride satın alınabilir.
- **Marka Puanı** (prestij): franchise satınca kazanılır = floor(sqrt(toplamKazanç / 1e6)). Her puan kalıcı +%10 gelir. Marka dükkanı: başlangıç parası, kalıcı ışık, daha hızlı XP.

## 13. Görevler ve başarımlar
- Günlük 3 görev (gerçek güne göre): "20 maç oynat", "kafeteryadan 5.000₺ kazan", "bir olayı çöz". Ödül elmas.
- Günlük giriş serisi (7 gün döngü).
- Başarımlar: ilk saha, 100 maç, 5 yıldız, ilk turnuva, ilk şube, ilk franchise...

## 14. Çevrimdışı kazanç
Uygulama kapalıyken beklenen değer üzerinden hesaplanır (slot slot sim değil): ortalama saatlik gelir × süre × %50 verim (menajer artırır), sınır 2 saat + menajer. Dönüşte "Siz yokken 12.400₺ kazandınız" kartı, "Reklam izle 2x" butonu.

## 15. Para kazanma (yayın için kancalar, v1'de sahte sağlayıcı)
`src/monetize.js` tek arayüz:
- `showRewardedAd(placement) → Promise<boolean>`: 2x çevrimdışı, 10 dk 2x hız, anında bakım, olayda ekstra seçenek.
- `purchase(sku) → Promise<boolean>`: elmas paketleri, "reklamları kaldır", başlangıç paketi.
- v1: sahte sağlayıcı (geliştirme modunda onay penceresi açıp ödülü verir). Sonra TWA'da Play Billing (Digital Goods API) ya da Capacitor + AdMob takılır. Oyun kodu bu dosya dışında sağlayıcıyı bilmez.
- Zorla reklam yok. Sadece ödüllü, isteğe bağlı reklam.

## 16. Görsel ve his
- Ana ekran: üstte HUD (para, elmas, seviye çubuğu, saat & hava), ortada şubenin sahaları kuşbakışı canvas (yeşil saha, çizgiler, kale, maç varken 14 küçük oyuncu iki renkte koşuyor, top hareket ediyor), altta sekmeli alt menü.
- Alt sekmeler: **Saha** · **Tesis** · **Personel** · **Etkinlik** (olaylar, turnuva, görevler) · **Mağaza** (elmas, reklam ödülleri, marka).
- Maç bitince sahadan yukarı süzülen "+1.240₺" yazısı, para sayacı yumuşak sayar.
- Gece: canvas kararır, ışıklı sahalarda direk ışığı halkası.
- Yağmur: canvas üstünde yağmur çizgileri.
- Satın almada kısa titreşim (`navigator.vibrate`) ve küçük WebAudio sesleri (ayarlardan kapatılabilir).
- Renk paleti: koyu lacivert arayüz, çim yeşili vurgu, altın para rengi. Büyük, başparmakla basılabilir butonlar (min 44px). Güvenli alan (notch) boşlukları.
- Yatayda: canvas solda, panel sağda.

## 17. Kayıt
localStorage, 5 saniyede bir ve `visibilitychange` ile. Kayıtta `version` alanı ve göç fonksiyonu. Bozuk kayıtta oyun çökmez, yedek anahtar (`_bak`) denenir. Ayarlar: ses, titreşim, kaydı sıfırla (onaylı).
