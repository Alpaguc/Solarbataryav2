# Legacy vs V2 Dogrulama Notu

Bu dokuman gecis adiminda hizli karsilastirma icin olusturuldu.

## Karsilastirilan Kalemler

1. `Toplam depolamali gelir`
2. `Ek gelir`
3. `Kapasite kaybi trendi` (zamanla azalan olgu)
4. `SOC davranisi` (sarj/desarj hedeflerine uyum)

## Beklenen Davranis

- V2 sonucunda kapasite serisi zamanla azalir (dogrusal olmak zorunda degil).
- Geri odeme suresi sadece yillik net ek gelir pozitifse hesaplanir.
- DOD arttikca kapasite kaybi hizlanir (model specs ile uyumlu).

## Geçis Karari

- Uygulama calistirma scriptleri V2'ye alindi (`dev:api`, `dev:web`).
- Legacy dosyalar sadece referans ve acil geri donus icin tutuldu.
- Yeni gelistirme hedefleri sadece `apps/*` ve `packages/*` altinda devam etmeli.
