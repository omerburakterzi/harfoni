# Sürüm 1.0.2 — mağaza rehberi

Bu sürümle uygulama ilk kez sunucuya bilgi gönderiyor (Düello). Bu yüzden
yeni sürümü göndermeden önce iki mağazadaki **gizlilik formlarını** güncellemek
gerekiyor. Aşağıdaki metinleri kopyala-yapıştır yapabilirsin.

## Yenilikler metni (iki mağaza için aynı)

```
Yeni: Düello!
• Biriyle karşılıklı oyna: aynı kelime, daha az tahminde bulan kazanır
• Hızlı (3 dk + her tahminde süre bonusu) ve Uzun (10 dk) modlar
• Rastgele rakip bul ya da arkadaşına davet linki gönder
• Rakip yoksa Kolay, Orta ya da Zor bota karşı oyna
• Satrançtaki gibi Elo puanı, her mod için ayrı
• Google ya da Apple ile bağla, puanını her cihazda koru
```

## App Store Connect

### 1. Uygulama gizliliği (App Privacy)
**Uygulama Gizliliği → Düzenle**. "Veri topluyor musunuz?" → **Evet**. Şunları seç:

| Veri türü | Ne için | Kullanıcıya bağlı mı | İzleme (tracking) |
|---|---|---|---|
| **Tanımlayıcılar → Kullanıcı Kimliği** (User ID) | Uygulama İşlevselliği | Evet | Hayır |
| **Kullanıcı İçeriği → Oyun İçeriği** (Gameplay Content) | Uygulama İşlevselliği | Evet | Hayır |
| **Kullanıcı İçeriği → Diğer Kullanıcı İçeriği** (takma ad) | Uygulama İşlevselliği | Evet | Hayır |

Başka hiçbir şeyi işaretleme (e-posta, ad, konum, kullanım verisi YOK).
Kaydedip **Yayınla**.

### 2. Yaş derecelendirmesi
**Uygulama Bilgileri → Yaş Derecelendirmesi → Düzenle**. Değişen tek cevap:
- **Kullanıcı tarafından oluşturulan içerik** (takma adlar başkalarına görünüyor): **Evet**
- Mesajlaşma / sohbet: **Hayır**

### 3. İnceleme notu (App Review Information → Notes)
```
Version 1.0.2 adds "Düello", an online two-player mode.
- To test without a second person, open Düello, choose a nickname, then tap "Kolay", "Orta" or "Zor" under "Bota karşı oyna" (play against a bot). Bot games are unrated.
- Sign in with Apple / Google is optional; it only links the nickname and rating to an account so it can be restored on another device. We do not request name or email.
- Users can report or block an opponent from the "⋯" menu next to the opponent's name (in game and on the result screen). Reports are reviewed within 24 hours; offensive nicknames are filtered.
- Profile deletion: Düello → profile icon → "Profilimi sil". This also revokes the Sign in with Apple token.
- Rules: https://harfoni.com/kurallar.html
```

### 4. Sürüm
Sol üstte **iOS Uygulaması (+)** → `1.0.2` → Yenilikler metni → **Derleme: 4** → Kaydet → İncelemeye Ekle → Gönder.

## Google Play Console

### 1. Veri güvenliği (Data safety)
**Politika ve programlar → Uygulama içeriği → Veri güvenliği → Düzenle**.

- Uygulamanız veri topluyor veya paylaşıyor mu? **Evet**
- Toplanan veriler aktarım sırasında şifreleniyor mu? **Evet**
- Hesap oluşturma: **Kullanıcı adı ve diğer kimlik doğrulama yöntemleriyle** (takma ad + isteğe bağlı Google ile giriş)
- Hesap silme bağlantısı: `https://harfoni.com/hesap-silme.html`

Veri türleri (hepsi: **Toplanıyor, paylaşılmıyor, isteğe bağlı**, amaç **Uygulama işlevselliği** ve **Hesap yönetimi**):
- **Kişisel bilgiler → Kullanıcı kimlikleri**
- **Uygulama etkinliği → Kullanıcı tarafından oluşturulan diğer içerikler** (takma ad)
- **Uygulama etkinliği → Diğer işlemler** (maç sonuçları ve puan)

### 2. İçerik derecelendirmesi
**Uygulama içeriği → İçerik derecelendirmesi → Anketi düzenle**:
- Kullanıcılar birbiriyle etkileşim kurabiliyor mu? **Evet** (birlikte oynuyorlar, takma adları görünüyor)
- Sohbet / mesaj: **Hayır**

### 3. Yeni kapalı test sürümü
**Test ve yayınla → Test → Kapalı test → Closed testing - Alpha → Yeni sürüm oluştur**
→ masaüstündeki `harfoni-1.0.2-play.aab` → sürüm notu:
```
<tr-TR>
Yeni: Düello! Biriyle karşılıklı oyna, rastgele rakip bul ya da arkadaşını davet et, rakip yoksa bota karşı oyna. Google ile bağlayıp puanını her cihazda koru.
</tr-TR>
```
→ Sonraki → Kapalı teste yayınla → Yayın özeti → İncelemeye gönder.
