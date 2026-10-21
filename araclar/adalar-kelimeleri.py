"""Harf Adaları için 4 ve 6 harfli kelime listelerini hazırlar, js/adalar/sozluk.js üretir.

Kullanım (proje klasöründen, kelimeleri-hazirla.py ile aynı ortam):
    araclar/.venv/bin/python araclar/adalar-kelimeleri.py

Her uzunluk için iki liste:
- CEVAP4 / CEVAP6:   veri/adalar-cevap4.txt ve veri/adalar-cevap6.txt (elle gözden
                     geçirilmiş, en sık kullanılan başta; oyun bu sırayı kullanır,
                     ilk adalar listenin başından seçer). Dosya yoksa önce
                     veri/adalar-aday4.txt gibi bir aday listesi yazılır: Zemberek
                     sözlüğündeki yalın kelimelerden en sık geçenler. Adaylar gözden
                     geçirilip cevap dosyasına konur.
- GECERLI4 / GECERLI6: yalın kelimeler + sık kullanılan ekli haller
                     (kelimeleri-hazirla.py ile aynı yöntem).

5 harfli listeler js/kelimeler.js'de, Arada da onları kullanır.
"""

import importlib.util
import logging
import re
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("kh", KOK / "araclar" / "kelimeleri-hazirla.py")
kh = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kh)

UZUNLUKLAR = [4, 6]
ADAY_SAYISI = {4: 700, 6: 1000}
# Cevap adayı olmayacak sözcük türleri
ATLANACAK_TURLER = ("P:Pron", "P:Conj", "P:Interj", "P:Postp", "P:Ques", "P:Det", "P:Dup", "A:Abbrv")


def desen(uzunluk):
    return re.compile(f"[{kh.HARFLER}]{{{uzunluk}}}")


def sozluk_satirlari():
    for ad in ["master-dictionary.dict", "non-tdk.dict"]:
        yol = kh.indir(ad, kh.ZEMBEREK + ad)
        for satir in yol.read_text(encoding="utf-8").splitlines():
            yield ad, satir


def yasak_mi(kelime):
    return any(kelime == k or kelime.startswith(k) and len(k) >= 4 for k in kh.YASAK_KOKLER)


def siklik():
    sayilar = {}
    for satir in kh.indir("tr_full.txt", kh.SIKLIK).open(encoding="utf-8"):
        kelime, adet = satir.rsplit(" ", 1)
        adet = int(adet)
        if adet < kh.EN_AZ_SIKLIK:
            break
        sayilar[kelime] = adet
    return sayilar


def main():
    sayilar = siklik()
    logging.disable(logging.WARNING)
    import zeyrek

    cozumleyici = zeyrek.MorphAnalyzer()

    def turkce_mi(kelime):
        for c in cozumleyici._parse(kelime):
            kok = c.dict_item.lemma
            if not kok[:1].islower():
                continue
            if kok in kh.YASAK_KOKLER or kok.removesuffix("mak").removesuffix("mek") in kh.YASAK_KOKLER:
                return False
            parcalar = [m[0] for m in c.morphemes]
            if any(p.id_ == "Zero" for p in parcalar):
                continue
            if any(p.informal for p in parcalar) or len(c.stem) < 2:
                continue
            return True
        return False

    satirlar = list(sozluk_satirlari())
    js = [
        "// Bu dosya araclar/adalar-kelimeleri.py ile üretilir, elle değiştirmeyin.",
        "// Kaynaklar ve lisanslar için README.md dosyasına bakın.",
    ]
    for uzunluk in UZUNLUKLAR:
        kalip = desen(uzunluk)
        yalin, adaylar = set(), set()
        for ad, satir in satirlar:
            kelime = kh.temizle(satir.split(" [")[0])
            if not kalip.fullmatch(kelime) or yasak_mi(kelime):
                continue
            yalin.add(kelime)
            uygun_tur = not any(t in satir for t in ATLANACAK_TURLER)
            mastar = kelime.endswith(("mak", "mek"))
            if ad == "master-dictionary.dict" and uygun_tur and not mastar:
                adaylar.add(kelime)

        ekli = {k for k in sayilar if kalip.fullmatch(k) and k not in yalin and not yasak_mi(k) and turkce_mi(k)}

        cevap_yolu = KOK / "veri" / f"adalar-cevap{uzunluk}.txt"
        if cevap_yolu.exists():
            cevaplar = [
                kh.temizle(s) for s in cevap_yolu.read_text(encoding="utf-8").splitlines() if s.strip() and not s.startswith("#")
            ]
            hatali = [k for k in cevaplar if not kalip.fullmatch(k)]
            for k in hatali:
                print(f"UYARI: {uzunluk} harfli değil, atlandı: {k}")
            cevaplar = [k for k in dict.fromkeys(cevaplar) if kalip.fullmatch(k)]
        else:
            sirali = sorted((k for k in adaylar if k in sayilar), key=lambda k: -sayilar[k])[: ADAY_SAYISI[uzunluk]]
            aday_yolu = KOK / "veri" / f"adalar-aday{uzunluk}.txt"
            aday_yolu.write_text("\n".join(f"{k} {sayilar[k]}" for k in sirali) + "\n", encoding="utf-8")
            print(f"{aday_yolu.name}: {len(sirali)} aday yazıldı; gözden geçirip {cevap_yolu.name} dosyasına koy.")
            cevaplar = []

        gecerli = yalin | ekli | set(cevaplar)
        js.append(f"export const CEVAP{uzunluk} = {kh.js_listesi(cevaplar)};")
        js.append(f"export const GECERLI{uzunluk} = new Set({kh.js_listesi(sorted(gecerli))});")
        print(f"{uzunluk} harf: {len(cevaplar)} cevap, {len(yalin)} yalın, {len(ekli)} ekli, {len(gecerli)} geçerli")

    hedef = KOK / "js" / "adalar" / "sozluk.js"
    hedef.parent.mkdir(exist_ok=True)
    hedef.write_text("\n".join(js) + "\n", encoding="utf-8")
    print(f"{hedef.relative_to(KOK)} yazıldı.")


if __name__ == "__main__":
    main()
