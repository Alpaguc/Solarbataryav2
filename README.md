# SolarBatarya v2 - Moduler Mimari

SolarBatarya artik tek dosya monolit yerine **frontend + backend + simulation core** ayrimina sahip monorepo yapisinda calisir.

## Mimari

```text
SolarBatarya/
├─ apps/
│  ├─ api/              # Express + SQLite API (moduler katmanlar)
│  └─ web/              # React (Vite) arayuzu
├─ packages/
│  ├─ simulation-core/  # DOD/cevrim/takvim yaslanmasi motoru
│  └─ shared/           # Ortak dogrulama/sabitler
├─ data/                # SQLite dosyasi (runtime)
├─ backend/             # Legacy (eski monolit backend)
├─ index.html           # Legacy (eski monolit frontend)
└─ script.js            # Legacy (eski monolit script)
```

## Hedeflenen Akis (MVP)

1. Kullanici public ana sayfada platformu inceler.
2. Giris yapar / kayit olur.
3. Hesaba bagli tek bir proje olusturur (isim, lokasyon, kurulu guc).
4. Kullanici minimum veri girer:
   - batarya markasi + modeli
   - gunes profili
   - tarife profili
   - proje yili ve hedef SOC araligi
5. Simulasyon motoru saatlik SOC davranisini hesaplar.
6. DOD tabanli cevrim eskimesi + takvim eskimesi kapasiteye uygulanir.
7. Maliyet / kazanc / geri odeme / ROI metrikleri olusturulur.
8. Sonuclar KPI ve grafiklerle sunulur.

## Kurulum

```bash
npm install
```

## Calistirma

API:

```bash
npm run dev:api
```

Web:

```bash
npm run dev:web
```

Birlikte:

```bash
npm run dev
```

Admin hesabini lokal hazirlamak icin:

```bash
npm run admin:ensure
```

Varsayilan adresler:
- Web: `http://localhost:5173`
- API: `http://localhost:3001`

## API Endpoint Ozeti

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/projects/me`
- `POST /api/projects`
- `GET /api/catalog/brands`
- `GET /api/catalog/models?brandId=<id>`
- `GET /api/catalog/tariffs`
- `GET /api/catalog/solar-profiles`
- `POST /api/simulations`
- `GET /api/simulations/:id`
- `GET /api/admin/settings` (admin)
- `POST /api/admin/settings` (admin)

## Lokal Admin Hesabi

API baslangicinda admin kullanici otomatik kontrol edilir/olusturulur.

`.env` veya `apps/api/.env` icine su degerleri girerek degistirebilirsin:

- `ADMIN_FULL_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Varsayilanlar:

- `admin@solarbatarya.local`
- `Admin12345!`

## Not

Eski monolit dosyalar (`index.html`, `script.js`, `backend/*`) uyumluluk icin tutulmustur ancak yeni gelistirmeler `apps/*` ve `packages/*` altinda devam etmelidir.