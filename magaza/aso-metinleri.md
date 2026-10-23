# Mağaza görünürlüğü: yeni ekran görüntüleri ve metinler (Ekim 2026)

Amaç: arama sonuçlarında tıklanma oranını (şu an ~%4) artırmak. Arama
sonucunda sadece simge, ad, alt başlık ve ilk 2-3 ekran görüntüsü görünür.

## Ekran görüntüleri (bu klasörde)

| Sıra | Başlık | App Store | Google Play |
|---|---|---|---|
| 1 | Arkadaşına meydan oku | `appstore-ekran-1.png` | `play-ekran-1.png` |
| 2 | Her gün 4 yeni bulmaca | `appstore-ekran-2.png` | `play-ekran-2.png` |
| 3 | Klasik | `appstore-ekran-3.png` | `play-ekran-3.png` |
| 4 | Arkadaşlarınla yarış | `appstore-ekran-4.png` | `play-ekran-4.png` |
| 5 | Palavra | `appstore-ekran-5.png` | `play-ekran-5.png` |
| 6 | Arada | `appstore-ekran-6.png` | `play-ekran-6.png` |
| 7 | Muamma | `appstore-ekran-7.png` | `play-ekran-7.png` |

Eski görsellerin hepsini sil, bu 7'sini bu sırayla yükle.
App Store: 6,9 inç iPhone bölümü (1320x2868). Google Play: Telefon ekran görüntüleri (1080x1920).

## App Store Connect

**Alt başlık (Subtitle, en fazla 30)** — Uygulama Bilgileri (App Information):
```
Türkçe günlük kelime bulmacası
```

**Anahtar kelimeler (Keywords, en fazla 100)** — sürüm sayfasında. Ad ve alt
başlıktaki kelimeler (kelime, oyunları, Türkçe, günlük, bulmaca) zaten
aranıyor, tekrar yazmaya gerek yok. Başka oyunların marka adları (Wordle vb.)
yazılmaz; Apple reddediyor.
```
düello,harf,zeka,beyin,sözcük,sözlük,tahmin,bilmece,hece,alfabe,arkadaş,sıralama,yarışma,kelimeavı
```

**Tanıtım metni (Promotional Text, en fazla 170)** — sürüm göndermeden de
istediğin an değiştirilebilir:
```
Yeni: Düello! Arkadaşına meydan oku ya da rastgele rakip bul. Günlük bulmacalardan puan topla, arkadaş grubunu kur, haftalık sıralamada zirveye çık.
```

**Açıklama (Description)** — aşağıdaki "Tam açıklama" (iki mağazada aynı).

Not: Alt başlık, anahtar kelimeler, açıklama ve ekran görüntüleri yeni bir
sürümle birlikte gönderilir (sonraki sürüm 1.0.4). Tanıtım metni hemen değişir.

## Google Play Console

**Kısa açıklama (en fazla 80)** — Ana mağaza girişi (Main store listing):
```
Her gün 4 Türkçe kelime bulmacası, arkadaşlarınla düello ve haftalık sıralama!
```
Play'de bunlar sürüm beklemeden yayına girer (kısa bir incelemeden sonra).

## Tam açıklama (iki mağaza için)

```
Harfoni, Türkçe günlük kelime oyunlarını tek bir yerde toplar. Her gün her oyunda yeni bir bulmaca seni bekliyor. Tek başına çöz, puan topla, arkadaşlarınla yarış!

DÖRT GÜNLÜK OYUN

• Klasik: 5 harfli gizli kelimeyi 6 tahminde bul. Renkler hangi harflerin doğru yerde olduğunu, hangilerinin kelimede olduğunu gösterir.

• Palavra: Her satırda bir renk yalan söylüyor! Yalanı bul, 8 tahminde kelimeye ulaş.

• Arada: Gizli kelime alfabede iki kelimenin arasında. Her tahminle aralığı daralt.

• Muamma: Kaç harfin doğru olduğunu söyler, hangileri olduğunu değil. Artı-eksi bulmacasının kelimeli hali!

DÜELLO: ARKADAŞINA MEYDAN OKU

• Aynı gizli kelimeyi rakibinle aynı anda ara, daha az tahminde bulan kazanır
• Rakibinin harflerini değil, sadece renklerini görürsün
• Hızlı (3 dakika + her tahminde süre bonusu) ya da Uzun (10 dakika) mod
• Arkadaşına davet linki gönder ya da rastgele rakip bul
• Rakip yoksa Kolay, Orta ya da Zor bota karşı oyna
• Satrançtaki gibi puan: Acemi'den Efsane'ye rütbe atla, aylık sezon rozetleri topla

SIRALAMA VE ARKADAŞ GRUPLARI

• Her günlük bulmaca puan kazandırır; seri ve bonuslarla haftalık sıralamaya gir
• Arkadaş grubunu kur ("Ofis", "Aile"…), her gün kim önde görün
• Grup sıralamasını tek dokunuşla paylaş

ÖZELLİKLER

• Her gün her oyunda yeni bulmaca (Türkiye saatiyle gece yarısı)
• Sınırsız alıştırma modu
• Türkçe Q klavye; Ç, Ğ, İ, Ö, Ş, Ü harfleri tam destekli
• "Evler", "yolda" gibi ekli kelimeler de tahmin olarak kabul edilir
• Günlük oyunlar internetsiz de oynanabilir
• Sonucunu emojilerle paylaş, cevabı ele vermeden
• Reklam yok; günlük oyunlar için hesap gerekmez

Kelimeyi bulunca anlamına TDK Sözlük'ten tek dokunuşla bakabilirsin.

Önerin ya da bulduğun bir hata mı var? iletisim@harfoni.com adresine yaz.
```
