# 🌞 Güneş Enerjisi Depolamalı Sistem Analiz Platformu

Bu proje, güneş enerjisi santrallerinin üretim verilerini analiz eden ve depolamalı sistem senaryolarını karşılaştıran kapsamlı bir web uygulamasıdır.

## 🚀 Özellikler

### 📊 Analiz Özellikleri
- **CSV Veri Yükleme**: Saatlik üretim verilerini CSV formatında yükleme
- **EPİAŞ Fiyat Entegrasyonu**: Gerçek zamanlı elektrik fiyatları
- **Performans Analizi**: Gerçek vs tahmini üretim karşılaştırması
- **Depolamalı Sistem Karşılaştırması**: GES vs GES+BSS senaryoları
- **Gelir Hesaplamaları**: Detaylı finansal analiz

### 🎨 Kullanıcı Arayüzü
- **Modern Tasarım**: Glass morphism efektleri
- **Responsive Layout**: Mobil uyumlu tasarım
- **İnteraktif Grafikler**: Chart.js ile dinamik görselleştirme
- **Gerçek Zamanlı Güncellemeler**: Anlık hesaplama sonuçları

## 🏗️ Proje Yapısı

```
SolarBatarya/
├── backend/                 # FastAPI Backend
│   ├── main.py             # Ana API sunucusu
│   ├── analiz.py           # Analiz fonksiyonları
│   └── hesaplamalar.py     # Gelir hesaplama modülleri
├── frontend/               # React Frontend (gelecek)
├── DepolamaliSistemMahsuplasma.Core/  # .NET Core Projesi
├── DepolamaliSistemMahsuplasma.Web/   # .NET Web Projesi
├── index.html              # Ana web sayfası
├── script.js               # Frontend JavaScript
├── ornek_veri.csv          # Örnek veri dosyası
└── README.md               # Bu dosya
```

## 🛠️ Kurulum

### Gereksinimler
- Python 3.8+
- Node.js 16+ (React için)
- .NET 8.0 (C# projeleri için)

### Backend Kurulumu

1. **Python Sanal Ortam Oluştur:**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# veya
venv\Scripts\activate     # Windows
```

2. **Bağımlılıkları Yükle:**
```bash
pip install fastapi uvicorn pandas numpy openpyxl
```

3. **Backend'i Başlat:**
```bash
cd backend
python main.py
```

Backend `http://localhost:8000` adresinde çalışacak.

### Frontend Kurulumu

1. **Bağımlılıkları Yükle:**
```bash
cd frontend
npm install
```

2. **Geliştirme Sunucusunu Başlat:**
```bash
npm start
```

Frontend `http://localhost:3000` adresinde çalışacak.

## 📁 Veri Formatı

### CSV Dosya Formatı
```csv
Tarih,Saat,Üretim (kWh)
2024-01-01,08:00,0
2024-01-01,09:00,1250.5
2024-01-01,10:00,1350.2
...
```

### EPİAŞ Fiyat CSV Formatı
```csv
Tarih,Saat,Fiyat (TL/MWh)
2024-01-01,00:00,1250.50
2024-01-01,01:00,1200.30
...
```

## 🔧 API Endpoints

### Backend API (FastAPI)

- `GET /` - API bilgileri
- `GET /health` - Sağlık kontrolü
- `POST /analiz` - CSV analizi
- `POST /tahmin-hesapla` - Yıllık tahmin hesaplama
- `POST /gelir-hesapla` - Gelir hesaplama

### Örnek API Kullanımı

```javascript
// CSV Analizi
const formData = new FormData();
formData.append('csv_dosya', file);
formData.append('tahmini_mwh_yil', 1000);

const response = await fetch('http://localhost:8000/analiz', {
    method: 'POST',
    body: formData
});
```

## 📊 Hesaplama Modülleri

### Gelir Hesaplama
- **GES Senaryosu**: Direkt satış
- **GES+BSS Senaryosu**: Batarya ile optimizasyon
- **Dağıtım Bedelleri**: Görevli/Özel tedarikçi seçenekleri

### Analiz Metrikleri
- Performans oranı
- Aylık/günlük üretim analizi
- İstatistiksel veriler
- Finansal karşılaştırmalar

## 🎯 Kullanım Senaryoları

1. **Güneş Enerjisi Santrali Sahipleri**
   - Üretim performansını analiz etme
   - Depolamalı sistem yatırım kararı

2. **Enerji Danışmanları**
   - Müşteri projelerini değerlendirme
   - Teknik-fizibilite raporları

3. **Yatırımcılar**
   - ROI hesaplamaları
   - Risk analizi

## 🔮 Gelecek Özellikler

- [ ] Gerçek zamanlı veri entegrasyonu
- [ ] Makine öğrenmesi ile tahmin modelleri
- [ ] Mobil uygulama
- [ ] Çoklu dil desteği
- [ ] Gelişmiş raporlama

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Push yapın (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 İletişim

- **Proje Sahibi**: [Adınız]
- **Email**: [email@example.com]
- **GitHub**: [github.com/username]

## 🙏 Teşekkürler

- EPİAŞ veri sağlayıcısı
- Bootstrap ve Chart.js geliştiricileri
- FastAPI topluluğu

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın! 