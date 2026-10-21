// Harf Adaları'nın sabitleri: tılsımlar, iksirler, boss kuralları ve sürprizler.
// Kurallar tasarım belgesinden: https://claude.ai/artifact/NjGS4EvdLjU8hs5HJq3GNQ

export const BASLANGIC = { can: 3, murekkep: 4 };
export const YUVA = { tilsim: 5, iksir: 3 };

// Kelime uzunluğuna göre hak; Arada'da 12.
export const HAK = { 4: 6, 5: 6, 6: 7, 7: 8 };
export const ARADA_HAKKI = 12;

export const NADIRLIK = {
  yaygin: { ad: "Yaygın", fiyat: 4, agirlik: 70 },
  nadir: { ad: "Nadir", fiyat: 6, agirlik: 25 },
  efsanevi: { ad: "Efsanevi", fiyat: 9, agirlik: 5 },
};

export const TILSIMLAR = {
  cifte: { ad: "Çifte Kavrulmuş", simge: "🍬", nadirlik: "yaygin", aciklama: "Yeşil harf 10 yerine 15 taş." },
  pusula: { ad: "Sesli Pusula", simge: "🧭", nadirlik: "yaygin", aciklama: "Çözmeden önce yeşil yakaladığın her sesli harf +1 çarpan." },
  cizmeli: { ad: "Sarı Çizmeli", simge: "🥾", nadirlik: "yaygin", aciklama: "Sarı harf 4 yerine 8 taş." },
  kedi: { ad: "Meraklı Kedi", simge: "🐈", nadirlik: "yaygin", aciklama: "Çözen tahminden önce ilk kez sarı ya da yeşil olan her harf +6 taş." },
  noktali: { ad: "Noktalı", simge: "🔡", nadirlik: "yaygin", aciklama: "Kelimedeki her Ç, Ğ, İ, Ö, Ş, Ü +1 çarpan." },
  uzunsoluk: { ad: "Uzun Soluk", simge: "🫁", nadirlik: "yaygin", aciklama: "6 ve 7 harfli bulmacalarda +1 hak." },
  hamarat: { ad: "Hamarat Arı", simge: "🐝", nadirlik: "yaygin", aciklama: "Kalan her hak 1 yerine 2 mürekkep." },
  kumbara: { ad: "Kumbara", simge: "🐷", nadirlik: "yaygin", aciklama: "Faiz sınırı +5 yerine +10." },
  simitci: { ad: "Simitçi", simge: "🥯", nadirlik: "yaygin", aciklama: "Pazarda her şey 1 mürekkep ucuz." },
  esnaf: { ad: "Esnaf", simge: "⚖️", nadirlik: "yaygin", aciklama: "Pazardan çıkarken 10'dan fazla mürekkebin varsa +3." },
  yumusak: { ad: "Yumuşak G", simge: "🍮", nadirlik: "nadir", aciklama: "Ğ içeren her tahmin +40 taş." },
  ilkgorus: { ad: "İlk Görüşte", simge: "👀", nadirlik: "nadir", aciklama: "İlk tahminde en az 2 yeşil varsa puan ×2." },
  tezcanli: { ad: "Tez Canlı", simge: "⚡", nadirlik: "nadir", aciklama: "En geç 2. tahminde bulursan puan ×3." },
  tespih: { ad: "Tespih", simge: "📿", nadirlik: "nadir", aciklama: "4 ya da daha az tahminde çözdüğün her bulmaca kalıcı +1 çarpan ekler; seri bozulunca sıfırlanır (Arada sayılmaz)." },
  nazar: { ad: "Nazar Boncuğu", simge: "🧿", nadirlik: "nadir", aciklama: "Adada bir kez, kaybettiğin bulmacada can gitmez." },
  kahvefali: { ad: "Kahve Falı", simge: "☕", nadirlik: "nadir", aciklama: "Her bulmacada kelimede olmayan 2 harf baştan gri." },
  dedektif: { ad: "Dedektif", simge: "🔍", nadirlik: "nadir", aciklama: "Şahmeran'ın ilk satırdaki yalanını gösterir." },
  kirkyil: { ad: "Kırk Yıllık Hatır", simge: "🤝", nadirlik: "efsanevi", aciklama: "Can sınırı 4 olur ve 1 can yeniler." },
  altinkalem: { ad: "Altın Kalem", simge: "✒️", nadirlik: "efsanevi", aciklama: "Bütün bulmaca puanları ×1,5." },
};

export const tilsimFiyati = (id) => NADIRLIK[TILSIMLAR[id].nadirlik].fiyat;
export const satisFiyati = (id) => Math.floor(tilsimFiyati(id) / 2);

export const IKSIRLER = {
  fener: { ad: "Fener", simge: "🔦", fiyat: 6, aciklama: "Bir harfi yerinde açar; o kare taş getirmez." },
  sunger: { ad: "Sünger", simge: "🧽", fiyat: 4, aciklama: "Kelimede olmayan 4 harfi klavyede griye boyar." },
  kumsaati: { ad: "Kum Saati", simge: "⏳", fiyat: 4, aciklama: "Bu bulmacada +1 hak." },
  kurabiye: { ad: "Şans Kurabiyesi", simge: "🥠", fiyat: 3, aciklama: "Bu bulmacada taşlar ×2." },
  gozdamlasi: { ad: "Göz Damlası", simge: "💧", fiyat: 4, aciklama: "Bu bulmacada boss kuralını kaldırır." },
  kacis: { ad: "Kaçış", simge: "🏃", fiyat: 5, aciklama: "Bulmacayı atlar: can gitmez, puan ve mürekkep de yok. Boss'ta kullanılamaz." },
};

export const KURALLAR = {
  sahmeran: {
    ad: "Şahmeran",
    simge: "🐍",
    kisa: "Her satırda bir kare yalan söyler.",
    aciklama: "Her satırda bir kare gerçek rengi yerine başka bir renk gösterir. Yalan dediğin kareye dokunup işaretleyebilirsin.",
  },
  cin: {
    ad: "Cin",
    simge: "🧞",
    kisa: "Renk yok, sadece sayılar.",
    aciklama: "Kareler renklenmez; satırın yanında kaç harfin doğru yerde, başka yerde ya da yok olduğu yazar. Karelere dokunup not alabilirsin.",
  },
  karakoncolos: {
    ad: "Karakoncolos",
    simge: "👹",
    kisa: "Her tahminde bir kare sisli.",
    aciklama: "Her tahminde bir karenin rengi sisin arkasında kalır.",
  },
};

export const DUGUMLER = {
  bulmaca: { ad: "Bulmaca", simge: "" },
  arada: { ad: "Arada", simge: "↕" },
  zorlu: { ad: "Zorlu bulmaca", simge: "" },
  pazar: { ad: "Pazar", simge: "🧺" },
  cesme: { ad: "Çeşme", simge: "⛲" },
  surpriz: { ad: "Sürpriz", simge: "❔" },
  miniboss: { ad: "Mini boss", simge: "" },
  bekci: { ad: "Ada bekçisi", simge: "" },
};

export const ODUL = { miniboss: 6, bekci: 10, zorluKati: 1.5, cesme: 6, faizBolen: 5, faizSiniri: 5, kumbaraSiniri: 10 };
export const PAZAR = { tilsim: 3, iksir: 2, yenile: 2, esnafSiniri: 10, esnafOdulu: 3 };

export const OLAYLAR = {
  sahaf: {
    ad: "Sahaf",
    simge: "📚",
    metin: "Yaşlı bir sahaf tozlu bir kitabın arasından bir tılsım uzatıyor. Fiyatı 4 mürekkep; ne çıkacağını o da bilmiyor.",
  },
  kumarbaz: {
    ad: "Kumarbaz Cin",
    simge: "🪙",
    metin: "Şişesinden çıkan cin yazı tura teklif ediyor: tutarsa mürekkebin ikiye katlanır, tutmazsa yarıya iner.",
  },
  yolcu: {
    ad: "Yorgun Yolcu",
    simge: "🧳",
    metin: "Yol kenarında yorgun düşmüş bir yolcu var. Ona 1 canını verirsen heybesindeki 3 nadir tılsımdan birini sana verecek.",
  },
  kayipharf: {
    ad: "Kayıp Harf",
    simge: "✨",
    metin: "Kumların arasında parlayan bir harf buldun. Bir sonraki bulmacada bir harfi bedavaya açar, Fener gibi.",
  },
  kuyu: {
    ad: "Mürekkep Kuyusu",
    simge: "🕳️",
    metin: "Dibi görünmeyen bir mürekkep kuyusu: 8 mürekkep alabilirsin, ama bir sonraki bulmacada Karakoncolos peşine düşer.",
  },
};
