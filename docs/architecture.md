# SolarBatarya v2 Mimari Notlari

## Katmanlar

- `apps/web`: Kullanici arayuzu, minimal veri girisi, sonuc panelleri
- `apps/api`: API gateway + is kurallari + persistence
- `packages/simulation-core`: Saatlik enerji akisi + DOD/omur + ekonomik cikti
- `packages/shared`: Input dogrulama ve ortak sabitler

## Veri Akisi

1. Web kullanicidan minimal form verisini toplar.
2. API `POST /api/simulations` ile girdiyi dogrular.
3. API katalogdan batarya ve profil verisini ceker.
4. Simulasyon motoru sonuclari hesaplar.
5. Ozet ve saatlik sonuclar veritabanina kaydedilir.
6. Web KPI ve grafikleri ekrana basar.

## Baslica Tasarim Kararlari

- Simulasyon cekirdegi API disi bagimsiz paket olarak tutuldu.
- Katalog tablolari ile teknik parametreler formdan ayrildi.
- Monolit dosyalar silinmedi; yeni scriptler `apps/*` uzerine alindi.
