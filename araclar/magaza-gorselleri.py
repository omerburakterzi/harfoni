"""magaza/ham/ altındaki ekran görüntülerinden mağaza görselleri üretir.

Her görselin üstüne kısa bir başlık yazar, görüntüyü yuvarlatılmış köşelerle
ortalar. Çıktı: magaza/play-ekran-*.png (1080x1920, Google Play) ve
magaza/appstore-ekran-*.png (1320x2868, App Store 6,9 inç iPhone).

Kullanım:
    araclar/.venv/bin/python araclar/magaza-gorselleri.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

KOK = Path(__file__).resolve().parent.parent
HAM = KOK / "magaza" / "ham"
HEDEF = KOK / "magaza"
YAZI_TIPI = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

ZEMIN = "#121417"
VURGU = "#17a398"
BEYAZ = "#ffffff"

# (ham dosya, üst satır, alt satır). Sıra önemli: arama sonuçlarında ilk
# 2-3 görsel görünür. Ham görüntüler simülatörde örnek verilerle çekildi.
SAHNELER = [
    ("yeni-duello.png", "Arkadaşına meydan oku", "Aynı kelime, daha az tahminde bulan kazanır"),
    ("yeni-anasayfa.png", "Her gün 4 yeni bulmaca", "Puan topla, haftalık sıralamaya gir"),
    ("yeni-klasik.png", "Klasik", "Günün kelimesini 6 tahminde bul"),
    ("yeni-siralama.png", "Arkadaşlarınla yarış", "Grubunu kur, her gün kim önde görün"),
    ("yeni-palavra.png", "Palavra", "Her satırda bir renk yalan söylüyor"),
    ("yeni-arada.png", "Arada", "Kelime alfabede iki kelimenin arasında"),
    ("yeni-muamma.png", "Muamma", "Kaç harf doğru, ama hangileri?"),
]

# (ön ek, genişlik, yükseklik): Google Play 9:16, App Store 6,9 inç iPhone
BOYUTLAR = [("play-ekran", 1080, 1920), ("appstore-ekran", 1320, 2868)]


def ortali(cizim, genislik, y, metin, boyut, renk):
    # Uzun başlıklar kenarlara taşmasın diye yazı küçülür.
    while True:
        font = ImageFont.truetype(YAZI_TIPI, boyut)
        sol, _, sag, _ = cizim.textbbox((0, 0), metin, font=font)
        if sag - sol <= genislik * 0.9 or boyut <= 20:
            break
        boyut -= 2
    cizim.text(((genislik - (sag - sol)) / 2 - sol, y), metin, font=font, fill=renk)


def yuvarlak_kose(resim, yaricap):
    maske = Image.new("L", resim.size, 0)
    ImageDraw.Draw(maske).rounded_rectangle((0, 0, *resim.size), radius=yaricap, fill=255)
    resim.putalpha(maske)
    return resim


def sahne(dosya, baslik, alt_baslik, GENISLIK, YUKSEKLIK):
    olcek = GENISLIK / 1080
    ust_alan = round(360 * olcek)
    tuval = Image.new("RGB", (GENISLIK, YUKSEKLIK), ZEMIN)
    cizim = ImageDraw.Draw(tuval)
    ortali(cizim, GENISLIK, round(110 * olcek), baslik, round(84 * olcek), VURGU)
    ortali(cizim, GENISLIK, round(225 * olcek), alt_baslik, round(52 * olcek), BEYAZ)

    goruntu = Image.open(HAM / dosya).convert("RGB")
    yukseklik = YUKSEKLIK - ust_alan - round(60 * olcek)
    genislik = round(goruntu.width * yukseklik / goruntu.height)
    if genislik > GENISLIK - round(80 * olcek):  # uzun ekranlarda genişliğe sığdır
        genislik = GENISLIK - round(80 * olcek)
        yukseklik = round(goruntu.height * genislik / goruntu.width)
    goruntu = yuvarlak_kose(goruntu.resize((genislik, yukseklik), Image.LANCZOS), round(36 * olcek))
    x = (GENISLIK - genislik) // 2
    # İnce çerçeve
    cizim.rounded_rectangle(
        (x - 3, ust_alan - 3, x + genislik + 3, ust_alan + yukseklik + 3),
        radius=round(39 * olcek), outline="#2e3137", width=3,
    )
    tuval.paste(goruntu, (x, ust_alan), goruntu)
    return tuval


def main():
    for on_ek, genislik, yukseklik in BOYUTLAR:
        for i, (dosya, baslik, alt_baslik) in enumerate(SAHNELER, start=1):
            sahne(dosya, baslik, alt_baslik, genislik, yukseklik).convert("RGB").save(
                HEDEF / f"{on_ek}-{i}.png", optimize=True
            )
    print(f"{len(SAHNELER) * len(BOYUTLAR)} mağaza görseli magaza/ klasörüne yazıldı.")


if __name__ == "__main__":
    main()
