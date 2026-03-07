// === Çeviri Sistemi ===
const translations = {
    tr: {
        main: {
            title: "Güneş Enerjisi Depolamalı Sistem",
            subtitle: "EPİAŞ entegrasyonu ile gerçek zamanlı üretim ve gelir analizi"
        },
        tabs: {
            upload: "Veri Yükleme",
            results: "Analiz Sonuçları", 
            design: "Depolamalı Sistem Tasarımı",
            reports: "Raporlar",
            about: "Hakkında"
        },
        upload: {
            title: "Veri Yükleme",
            subtitle: "Dosyalarınızı yükleyin ve analizi başlatın",
            productionData: "Üretim Verileri",
            priceData: "Fiyat Verileri",
            productionDesc: "PVSYST CSV dosyanızı yükleyin",
            priceDesc: "EPİAŞ CSV dosyanızı yükleyin",
            clickToUpload: "Dosya Seçin",
            storageCapacity: "Depolama Kapasitesi",
            gridCapacity: "Şebeke Kapasitesi",
            distributionType: "Dağıtım Bedeli",
            publicSupplier: "Görevli Tedarik",
            privateSupplier: "Özel Tedarik",
            startAnalysis: "Analizi Başlat",
            needHelp: "Yardıma mı ihtiyacınız var?",
            fileFormats: "Dosya Formatları",
            fileUploaded: "yüklendi"
        }
    },
    en: {
        main: {
            title: "Solar Energy Storage System",
            subtitle: "Real-time production and revenue analysis with EPIAS integration"
        },
        tabs: {
            upload: "Data Upload",
            results: "Analysis Results",
            design: "Storage System Design", 
            reports: "Reports",
            about: "About"
        },
        upload: {
            title: "Data Upload",
            subtitle: "Upload your files and start analysis",
            productionData: "Production Data",
            priceData: "Price Data",
            productionDesc: "Upload your PVSYST CSV file",
            priceDesc: "Upload your EPIAS CSV file",
            clickToUpload: "Select File",
            storageCapacity: "Storage Capacity",
            gridCapacity: "Grid Capacity",
            distributionType: "Distribution Fee",
            publicSupplier: "Public Supplier",
            privateSupplier: "Private Supplier",
            startAnalysis: "Start Analysis",
            needHelp: "Need help?",
            fileFormats: "File Formats",
            fileUploaded: "uploaded"
        }
    }
};

let currentLanguage = localStorage.getItem('language') || 'tr';

function translate(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    for (const k of keys) {
        value = value?.[k];
    }
    return value || key;
}

function updatePageLanguage() {
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const translated = translate(key);
        if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'email')) {
            element.placeholder = translated;
        } else if (element.tagName === 'INPUT' && element.type === 'button') {
            element.value = translated;
        } else {
            element.textContent = translated;
        }
    });
    document.documentElement.lang = currentLanguage;
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updatePageLanguage();
    
    // Update language selector display
    const currentFlag = document.getElementById('currentFlag');
    const currentLang = document.getElementById('currentLang');
    if (currentFlag && currentLang) {
        currentFlag.textContent = lang === 'tr' ? '🇹🇷' : '🇬🇧';
        currentLang.textContent = lang.toUpperCase();
    }
}

// Global variables
let csvData = [];
let epiasCsvData = []; // EPİAŞ fiyat CSV verileri (eski sistem)
let epiasData = []; // EPİAŞ fiyat verileri (JavaScript entegre sistem)
let analysisResults = {};
let productionChart = null;
let epiasPrices = {}; // EPİAŞ fiyat verileri (CSV'den)
let selectedMonth = null; // Seçilen ay

// === Gelişmiş Batarya Sistemi ===
window.App = window.App || {};
App.Battery = App.Battery || {};

// Gelişmiş SOC (State of Charge) Hesaplama Sistemi
App.Battery.SOC = {
    config: {
        windowSize: 24,
        samplingRate: 1,
        ocvTable: {
            2.50: 0, 2.80: 5, 3.00: 10, 3.10: 20, 3.20: 40,
            3.25: 60, 3.30: 80, 3.40: 95, 3.65: 100
        },
        cellConfig: {
            nominalVoltage: 3.2, maxVoltage: 3.65,
            cutoffVoltage: 2.5, nominalCapacity: 280
        }
    }
};

// Kapasite faktörü için renk skalası
App.Battery.getCapacityColor = function(percentage) {
    const ratio = Math.max(0, Math.min(100, percentage)) / 100;
    if (ratio >= 0.8) return `hsl(${120 + (ratio - 0.8) * 20}, 70%, ${40 + ratio * 20}%)`;
    else if (ratio >= 0.5) {
        const hue = 120 - (0.8 - ratio) * 60 / 0.3;
        return `hsl(${hue}, 70%, 50%)`;
    } else if (ratio >= 0.2) {
        const hue = 60 - (0.5 - ratio) * 60 / 0.3;
        return `hsl(${hue}, 70%, 50%)`;
    } else return `hsl(0, 70%, ${30 + ratio * 20}%)`;
};

// Basit kapasite takvimi oluşturma
App.Battery.getDailyCapacitySchedule = function(startDate, endDate, initialMWh, retentionPerDay = 0.9999617) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const schedule = {};
    let cap = Number(initialMWh);
    if (!isFinite(cap) || cap <= 0) return schedule;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        schedule[key] = Number(cap.toFixed(4));
        cap *= retentionPerDay;
    }
    return schedule;
};

// Global kapasite takvimi
let capacitySchedule = {};
let nominalCapacity = 10;

// Kapasite döngü eskitmesi (EFC) için durum
window.CapacityState = window.CapacityState || {
    factorByDate: {},          // 'YYYY-MM-DD' -> kapasite faktörü (1.0 başlangıç)
    rPerEfc: 0.000365,         // %0.0365 kapasite kaybı / eşdeğer tam çevrim
    minFactor: 0.60,           // EOL alt sınır
    dailyRetention: 0.9999617  // %99.9617 günlük tutma oranı
};

function getPrevDateStr(dateStr) {
    // dateStr "YYYY-MM-DD" formatında olmalı
    try {
        // Eğer DD-MM-YYYY formatındaysa dönüştür
        let isoDateStr = dateStr;
        if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
            // DD-MM-YYYY -> YYYY-MM-DD dönüşümü
            const parts = dateStr.split('-');
            isoDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        const d = new Date(isoDateStr + 'T00:00:00');
        if (isNaN(d.getTime())) {
            throw new Error(`Geçersiz tarih formatı: ${dateStr}`);
        }
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    } catch (error) {
        console.warn(`Önceki tarih hesaplanırken hata: ${error.message}`);
        // İlk gün için varsayılan değer döndür
        return '1900-01-01';
    }
}

// Kapasite takvimi oluşturma fonksiyonu
function buildBatteryCapacitySchedule() {
    try {
        const startDate = document.getElementById('epiasStartDate')?.value || '1990-01-01';
        const endDate = document.getElementById('epiasEndDate')?.value || '1990-12-31';
        const initialCap = parseFloat(document.getElementById('storageLimit')?.value) || 10;
        const retention = CapacityState.dailyRetention;
        
        capacitySchedule = App.Battery.getDailyCapacitySchedule(startDate, endDate, initialCap, retention);
        nominalCapacity = initialCap;
        
        // Global değişkenleri de güncelle
        window.capacitySchedule = capacitySchedule;
        window.nominalCapacity = nominalCapacity;
        
        console.log('🔋 Günlük kapasite takvimi oluşturuldu:', {
            startDate, endDate, initialCap, retention,
            toplamGun: Object.keys(capacitySchedule).length,
            ilk3Gun: Object.keys(capacitySchedule).sort().slice(0, 3).map(k => `${k}: ${capacitySchedule[k].toFixed(4)}`),
            son3Gun: Object.keys(capacitySchedule).sort().slice(-3).map(k => `${k}: ${capacitySchedule[k].toFixed(4)}`)
        });
    } catch (error) {
        console.warn('⚠️ Kapasite takvimi oluşturulurken hata:', error);
        capacitySchedule = {};
        nominalCapacity = 10;
    }
}

function getCapacityFactorForDate(dateStr) {
    // dateStr "YYYY-MM-DD" formatında olmalı
    try {
        // Yeni sistem: Kapasite takviminden al
        if (capacitySchedule && capacitySchedule[dateStr]) {
            return capacitySchedule[dateStr] / nominalCapacity;
        }
        
        // Eski sistem: EFC degradasyon
        if (CapacityState.factorByDate[dateStr] !== undefined) {
            return CapacityState.factorByDate[dateStr];
        }
        
        // Yoksa önceki günün faktörünü al (ama bu gün için kaydetme!)
        const prevDateStr = getPrevDateStr(dateStr);
        const prev = CapacityState.factorByDate[prevDateStr] ?? 1;
        
        // Bu günün değerini kaydetme! Sadece önceki günün değerini döndür
        // applyEfcDegradation fonksiyonu bu günün değerini hesaplayıp kaydedecek
        return prev;
    } catch (error) {
        console.warn(`Kapasite faktörü hesaplanırken hata: ${error.message}, varsayılan 1.0 kullanılıyor`);
        return 1;
    }
}

function applyEfcDegradation(dateStr, dischargedMWh, nominalCapMWh) {
    // dateStr "YYYY-MM-DD" formatında olmalı
    if (!nominalCapMWh || nominalCapMWh <= 0) return;
    const prev = getCapacityFactorForDate(dateStr);
    const efc = dischargedMWh / nominalCapMWh; // eşdeğer tam çevrim
    const r = CapacityState.rPerEfc;
    let next = prev * Math.pow(1 - r, efc);
    if (!isFinite(next) || next <= 0) next = prev;
    next = Math.max(CapacityState.minFactor, next);
    CapacityState.factorByDate[dateStr] = next;
    
    // Debug: Kapasite değişimini logla
    const dateForDisplay = dateStr.split('-').reverse().join('-'); // YYYY-MM-DD -> DD-MM-YYYY
    const prevDateStr = getPrevDateStr(dateStr);
    const prevValue = CapacityState.factorByDate[prevDateStr];
    console.log(`🔋 ${dateForDisplay}: INPUT=${dateStr}, PREV=${prevDateStr}, EFC=${efc.toFixed(4)}, Önceki=${(prev*100).toFixed(4)}% (${prevValue ? (prevValue*100).toFixed(4)+'%' : 'YOK'}), Yeni=${(next*100).toFixed(4)}%`);
    
    // Test: 31 Aralık için özel debug
    if (dateStr === '1990-12-31') {
        console.log(`🔍 31 Aralık DEBUG: Input="${dateStr}", PrevDate="${prevDateStr}", Beklenen="1990-12-30"`);
        console.log(`🔍 Kayıtlı 30 Aralık: ${CapacityState.factorByDate['1990-12-30'] ? (CapacityState.factorByDate['1990-12-30']*100).toFixed(4)+'%' : 'YOK'}`);
        console.log(`🔍 Tüm Aralık kayıtları:`, Object.keys(CapacityState.factorByDate).filter(k => k.startsWith('1990-12')).slice(-5));
    }
    
    console.log(`📈 Kapasite durumu: ${Object.keys(CapacityState.factorByDate).length} gün kayıtlı`);
}

// API Configuration - Geçici Olarak Kaldırıldı
// const API_BASE_URL = 'http://localhost:8002';

// Dağıtım bedeli sabitleri (kr/kWh)
const DISTRIBUTION_FEES = {
    gorevli: 17.0239, // Görevli Tedarik Şirketinden Enerji Alan Tüketiciler
    ozel: 81.0595     // Özel Tedarikçiden Enerji Alan Tüketiciler
};

let currentDistributionFee = DISTRIBUTION_FEES.gorevli; // Varsayılan değer

// Depolama limiti (MWh)
let currentStorageLimit = 10;

// Şebekeye maksimum saatlik basma kapasitesi (MWh)
let currentGridDischargeLimit = 10;

// Initialize the application
// === Modern Upload Fonksiyonları ===
function updateUploadStatus(type, fileName, success = true) {
    const uploadCard = type === 'production' ? document.getElementById('uploadArea') : document.getElementById('epiasUploadArea');
    const statusElement = type === 'production' ? document.getElementById('productionStatus') : document.getElementById('priceStatus');
    
    if (success) {
        uploadCard.classList.add('uploaded');
        statusElement.innerHTML = `<i class="fas fa-check-circle"></i><span>${fileName} ${translate('upload.fileUploaded')}</span>`;
        statusElement.classList.add('success');
    } else {
        uploadCard.classList.remove('uploaded');
        statusElement.innerHTML = `<i class="fas fa-plus-circle"></i><span>${translate('upload.clickToUpload')}</span>`;
        statusElement.classList.remove('success');
    }
}

function showFormatInfo() {
    alert(`${translate('upload.fileFormats')}:\n\n` +
          `${translate('upload.productionData')}: PVSYST CSV\n` +
          `${translate('upload.priceData')}: EPİAŞ CSV`);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 SolarBatarya Analiz Sistemi başlatılıyor...');
    
    // Initialize language
    changeLanguage(currentLanguage);
    
    // Initialize data source toggles
    initializeDataSourceToggle();
    
    // Initialize file upload listeners
    const csvFile = document.getElementById('csvFile');
    const epiasCsvFile = document.getElementById('epiasCsvFile');
    
    if (csvFile) {
        csvFile.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                console.log('CSV dosyası seçildi:', file.name);
                updateUploadStatus('production', file.name, true);
                const reader = new FileReader();
                reader.onload = function(e) {
                    const text = e.target.result;
                    parseCSV(text);
                };
                reader.readAsText(file);
            }
        });
    }
    
    if (epiasCsvFile) {
        epiasCsvFile.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                console.log('EPİAŞ CSV dosyası seçildi:', file.name);
                updateUploadStatus('price', file.name, true);
                const reader = new FileReader();
                reader.onload = function(e) {
                    const text = e.target.result;
                    parseEpiasCSV(text);
                };
                reader.readAsText(file);
            }
        });
    }
    
    initializeUploadArea();
    initializeEpiasUploadArea();
    initializeForm();
    initializeDistributionFee();
    updateStorageLimit(); // Depolama limitini başlat
    updateGridDischargeLimit(); // Şebeke deşarj limitini başlat
    checkApiHealth();
    
    // Tab yönetimi
    initializeTabs();
    
    // Batarya tasarımını yükle
    loadBatteryDesign();
    
    // Gerçek zamanlı hesaplama için input listener'larını başlat
    initializeBatteryDesignInputs();
    
    console.log('✅ Sistem başlatıldı');
});

// Tab yönetimi
function initializeTabs() {
    const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const targetTab = this.getAttribute('data-bs-target');
            console.log(`📑 Sekme değiştirildi: ${targetTab}`);
            
            // Tüm tab panellerini gizle
            const allPanes = document.querySelectorAll('.tab-pane');
            allPanes.forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            
            // Hedef paneli göster
            const targetPane = document.querySelector(targetTab);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            
            // Aktif sidebar link göstergesi (nav-link değil sidebar-link)
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Veri raporu oluşturma fonksiyonu
function generateDataReport() {
    if (!window.currentAnalysisResults) {
        showNotification('Önce analiz yapmanız gerekiyor!', 'warning');
        return;
    }
    
    const results = window.currentAnalysisResults;
    const reportWindow = window.open('', '_blank', 'width=1200,height=800');
    
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Veri Raporu - SolarBatarya</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .section { margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .highlight { background-color: #fff3cd; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 Veri Raporu</h1>
                <p>Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
            </div>
            
            <div class="section">
                <h2>📈 Genel İstatistikler</h2>
                <table>
                    <tr><th>Metrik</th><th>Değer</th></tr>
                    <tr><td>Toplam Üretim</td><td>${results.totalProduction?.toFixed(2) || 0} MWh</td></tr>
                    <tr><td>Toplam Gelir</td><td>${results.totalRevenue?.toFixed(2) || 0} TL</td></tr>
                    <tr><td>Ortalama Günlük Gelir</td><td>${results.avgDailyRevenue?.toFixed(2) || 0} TL</td></tr>
                    <tr><td>Analiz Süresi</td><td>${results.totalDays || 0} gün</td></tr>
                </table>
            </div>
            
            <div class="section">
                <h2>🔋 Depolamalı Sistem Verileri</h2>
                <table>
                    <tr><th>Metrik</th><th>Değer</th></tr>
                    <tr><td>Depolamalı Toplam Gelir</td><td>${results.storageAnalysis?.yearly?.storageRevenue?.toFixed(2) || 0} TL</td></tr>
                    <tr><td>Ek Gelir</td><td>${results.storageAnalysis?.yearly?.additionalRevenue?.toFixed(2) || 0} TL</td></tr>
                    <tr><td>Gelir Artış Oranı</td><td>${results.storageAnalysis?.yearly?.percentageIncrease?.toFixed(2) || 0}%</td></tr>
                </table>
            </div>
        </body>
        </html>
    `);
    
    reportWindow.document.close();
    showNotification('Veri raporu oluşturuldu!', 'success');
}

// API Health Check - Geçici Olarak Kaldırıldı
async function checkApiHealth() {
    console.log('ℹ️ API özelliği geçici olarak kaldırıldı - CSV ile devam edin');
}

// SolarBatarya API'den fiyat verisi çekme
async function fetchEpiasPrices(date) {
    try {
        const response = await fetch(`${API_BASE_URL}/prices?gdate=${date}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ SolarBatarya fiyat verisi alındı: ${date}`);
            console.log(`📊 Ortalama fiyat: ${data.avgPrice} TL/MWh`);
            console.log(`📈 Min-Max: ${data.minPrice} - ${data.maxPrice} TL/MWh`);
            return data.items;
        } else {
            console.log(`❌ SolarBatarya fiyat verisi alınamadı: ${date} - Status: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ SolarBatarya API hatası: ${error.message}`);
        // API bağlantısı yoksa varsayılan fiyat verisi döndür
        return generateDefaultPrices(date);
    }
}

// Varsayılan fiyat verisi oluştur (API bağlantısı olmadığında)
function generateDefaultPrices(date) {
    const prices = [];
    for (let hour = 0; hour < 24; hour++) {
        // Gerçekçi fiyat varyasyonu (1000-3000 TL/MWh arası)
        const basePrice = 1500;
        const variation = Math.sin(hour / 24 * Math.PI) * 500 + Math.random() * 200;
        const price = Math.max(1000, Math.min(3000, basePrice + variation));
        
        prices.push({
            date: `${date}T${hour.toString().padStart(2, '0')}:00+03:00`,
            mcpTlMwh: Math.round(price)
        });
    }
    console.log(`📊 Varsayılan fiyat verisi oluşturuldu: ${date}`);
    return prices;
}

// EPİAŞ fiyat verilerini işleme
async function processEpiasApiData(startDate, endDate) {
    const prices = {};
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    showNotification('EPİAŞ fiyat verileri alınıyor...', 'info');
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayPrices = await fetchEpiasPrices(dateStr);
        
        if (dayPrices) {
            dayPrices.forEach(item => {
                const dateTime = new Date(item.date);
                const hour = dateTime.getHours();
                const key = `${dateStr}_${hour.toString().padStart(2, '0')}`;
                prices[key] = item.mcpTlMwh;
            });
        }
        
        // API rate limiting için kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    epiasPrices = prices;
    showNotification('EPİAŞ fiyat verileri başarıyla alındı!', 'success');
    console.log(`✅ Toplam ${Object.keys(prices).length} saatlik fiyat verisi alındı`);
    
    return prices;
}

// EPİAŞ API butonuna tıklandığında çağrılan fonksiyon
async function fetchEpiasApiData() {
    const startDate = document.getElementById('epiasStartDate').value;
    const endDate = document.getElementById('epiasEndDate').value;
    
    if (!startDate || !endDate) {
        showNotification('Lütfen başlangıç ve bitiş tarihlerini seçin!', 'warning');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showNotification('Başlangıç tarihi bitiş tarihinden büyük olamaz!', 'warning');
        return;
    }
    
    try {
        await processEpiasApiData(startDate, endDate);
        
        // CSV dosya adını güncelle
        const fileNameElement = document.getElementById('epiasFileName');
        if (fileNameElement) {
            fileNameElement.innerHTML = `
                <i class="fas fa-check-circle text-success me-2"></i>
                <strong>EPİAŞ API'den alınan veriler (${startDate} - ${endDate})</strong>
            `;
        }
        
    } catch (error) {
        console.error('EPİAŞ API hatası:', error);
        showNotification('EPİAŞ API\'den veri alınırken hata oluştu!', 'error');
    }
}

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Dağıtım bedeli seçimini başlat
function initializeDistributionFee() {
    updateDistributionFee();
}

// Dağıtım bedeli güncelleme fonksiyonu
function updateDistributionFee() {
    const feeTypeElement = document.getElementById('distributionFeeType');
    if (!feeTypeElement) {
        console.warn('⚠️ distributionFeeType elementi bulunamadı');
        return;
    }
    
    const feeType = feeTypeElement.value;
    currentDistributionFee = DISTRIBUTION_FEES[feeType];
    
    // Display alanını güncelle
    const displayElement = document.getElementById('distributionFeeDisplay');
    const feeDescriptions = {
        gorevli: 'Görevli Tedarik Şirketinden Enerji Alan Tüketiciler için',
        ozel: 'Özel Tedarikçiden Enerji Alan Tüketiciler için'
    };
    
    if (displayElement) {
        displayElement.innerHTML = `
            <strong>${currentDistributionFee.toFixed(4)} kr/kWh</strong>
            <br>
            <small class="text-white-50">${feeDescriptions[feeType]}</small>
        `;
    }
    
    console.log(`✅ Dağıtım bedeli güncellendi: ${currentDistributionFee} kr/kWh (${feeType})`);
    
    // Eğer analiz sonuçları mevcutsa, yeniden hesapla
    if (csvData && csvData.length > 0 && epiasData && epiasData.length > 0) {
        console.log('🔄 Dağıtım bedeli değişti, analiz sonuçları yeniden hesaplanıyor...');
        
        // Mevcut tarih aralığını al
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (startDate && endDate) {
            // Üretim verilerini filtrele ve analiz et
            const filteredProductionData = filterProductionDataByDateRange(csvData, startDate, endDate);
            if (filteredProductionData.length > 0) {
                calculateAnalysis(filteredProductionData);
                console.log('✅ Dağıtım bedeli değişikliğiyle filtrelenmiş verilerle analiz tamamlandı!');
            }
        } else {
            // Tarih aralığı seçilmemişse tüm veriyi kullan
            calculateAnalysis(csvData);
        }
    }
}

// Depolama limiti güncelleme fonksiyonu
function updateStorageLimit() {
    const limitInput = document.getElementById('storageLimit');
    
    if (limitInput) {
        currentStorageLimit = parseFloat(limitInput.value) || 10;
        console.log(`✅ Depolama limiti güncellendi: ${currentStorageLimit} MWh`);
    } else {
        console.warn('⚠️ Depolama limiti elementi bulunamadı');
    }
}

// Şebeke deşarj limiti güncelleme fonksiyonu
function updateGridDischargeLimit() {
    const limitInput = document.getElementById('gridDischargeLimit');
    
    if (limitInput) {
        currentGridDischargeLimit = parseFloat(limitInput.value) || 10;
        console.log(`✅ Şebeke deşarj limiti güncellendi: ${currentGridDischargeLimit} MWh`);
    } else {
        console.warn('⚠️ Şebeke deşarj limiti elementi bulunamadı');
    }
}

// Analiz Raporu Oluşturma Fonksiyonu
function generateAnalysisReport() {
    // Giriş zorunluluğu kaldırıldı
    if (!window.currentAnalysisResults) {
        showNotification('Önce analiz yapmanız gerekiyor!', 'warning');
        return;
    }

    const results = window.currentAnalysisResults;
    const reportDate = new Date().toLocaleDateString('tr-TR');
    
    // formatRevenue fonksiyonunu tanımla
    const formatRevenue = (amount) => {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '0,00';
        }
        return new Intl.NumberFormat('tr-TR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }).format(amount);
    };
    
    // Rapor HTML'i oluştur
    let reportHTML = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Güneş Enerjisi Depolamalı Sistem Analiz Raporu</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <script>
                function formatRevenue(amount) {
                    if (amount === null || amount === undefined || isNaN(amount)) {
                        return '0,00';
                    }
                    return new Intl.NumberFormat('tr-TR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    }).format(amount);
                }
                
                function getMonthName(monthKey) {
                    const months = {
                        '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
                        '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
                        '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
                    };
                    return months[monthKey] || monthKey;
                }
            </script>
            <style>
                @media print {
                    body { margin: 0; padding: 20px; }
                    .no-print { display: none !important; }
                    .page-break { page-break-before: always; }
                }
                
                body {
                    font-family: 'Arial', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 20px;
                    background: white;
                }
                
                .report-header {
                    text-align: center;
                    border-bottom: 3px solid #007bff;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                
                .report-title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #007bff;
                    margin-bottom: 10px;
                }
                
                .report-subtitle {
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 5px;
                }
                
                .report-date {
                    font-size: 14px;
                    color: #888;
                }
                
                .section {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }
                
                .section-title {
                    font-size: 20px;
                    font-weight: bold;
                    color: #007bff;
                    border-bottom: 2px solid #e9ecef;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .summary-card {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }
                
                .summary-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #007bff;
                    margin-bottom: 5px;
                }
                
                .summary-label {
                    font-size: 14px;
                    color: #666;
                }
                
                .comparison-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                
                .comparison-table th,
                .comparison-table td {
                    border: 1px solid #dee2e6;
                    padding: 12px;
                    text-align: center;
                }
                
                .comparison-table th {
                    background: #007bff;
                    color: white;
                    font-weight: bold;
                }
                
                .comparison-table tr:nth-child(even) {
                    background: #f8f9fa;
                }
                
                .chart-container {
                    margin: 30px 0;
                    text-align: center;
                    height: 350px;
                    position: relative;
                }
                
                .chart-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: #333;
                }
                
                .footer {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }
                
                .no-print {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                }
                
                .print-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                }
                
                .print-btn:hover {
                    background: #0056b3;
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button class="print-btn" onclick="window.print()">
                    📄 Raporu Yazdır
                </button>
            </div>
            
            <div class="report-header">
                <div class="report-title">Güneş Enerjisi Depolamalı Sistem Analiz Raporu</div>
                <div class="report-subtitle">EPİAŞ Entegrasyonu ile Gerçek Zamanlı Analiz</div>
                <div class="report-date">Rapor Tarihi: ${reportDate}</div>
            </div>
            
            <div class="section">
                <div class="section-title">📊 Analiz Özeti</div>
                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="summary-value">${formatRevenue(results.totalProduction || 0)} kWh</div>
                        <div class="summary-label">Toplam Üretim</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${formatRevenue(results.totalRevenue || 0)} TL</div>
                        <div class="summary-label">Toplam Gelir</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${results.totalDays || 0} Gün</div>
                        <div class="summary-label">Analiz Süresi</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">⚡ Depolamalı Sistem Karşılaştırması</div>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Metrik</th>
                            <th>Normal Sistem</th>
                            <th>Depolamalı Sistem</th>
                            <th>Fark</th>
                            <th>İyileştirme</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Toplam Gelir</strong></td>
                            <td>${formatRevenue(results.totalRevenue || 0)} TL</td>
                            <td>${formatRevenue((results.storageAnalysis?.yearly?.storageRevenue) || 0)} TL</td>
                            <td>${formatRevenue((results.storageAnalysis?.yearly?.profitDifference) || 0)} TL</td>
                            <td>${((results.storageAnalysis?.yearly?.profitPercentage) || 0).toFixed(2)}%</td>
                        </tr>
                        <tr>
                            <td><strong>Ortalama Günlük Gelir</strong></td>
                            <td>${formatRevenue((results.totalRevenue || 0) / (results.totalDays || 1))} TL</td>
                            <td>${formatRevenue(((results.storageAnalysis?.yearly?.storageRevenue) || 0) / (results.totalDays || 1))} TL</td>
                            <td>${formatRevenue(((results.storageAnalysis?.yearly?.profitDifference) || 0) / (results.totalDays || 1))} TL</td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">📈 Aylık Üretim Analizi</div>
                <div class="chart-container">
                    <div class="chart-title">Aylık Üretim Grafiği</div>
                    <canvas id="monthlyChartReport"></canvas>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">💰 Gelir Analizi</div>
                <div class="chart-container">
                    <div class="chart-title">Gelir Karşılaştırma Grafiği</div>
                    <canvas id="revenueChartReport"></canvas>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">⚙️ Sistem Parametreleri</div>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Parametre</th>
                            <th>Değer</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Depolama Kapasitesi</strong></td>
                            <td>${currentStorageLimit} MWh</td>
                        </tr>
                        <tr>
                            <td><strong>Şebeke Deşarj Limiti</strong></td>
                            <td>${currentGridDischargeLimit} MWh</td>
                        </tr>
                        <tr>
                            <td><strong>Dağıtım Bedeli</strong></td>
                            <td>${currentDistributionFee} kr/kWh</td>
                        </tr>
                        <tr>
                            <td><strong>Analiz Tarihi</strong></td>
                            <td>${reportDate}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="footer">
                <p><strong>Rapor Hazırlayan:</strong> Şükrü YİĞİT</p>
                <p>Bu rapor, güneş enerjisi depolamalı sistem analizi için otomatik olarak oluşturulmuştur.</p>
                <p>Daha fazla bilgi için: <a href="https://www.youtube.com/@Sukruyigit">YouTube</a> | <a href="https://tr.linkedin.com/in/şükrü-yiğit-1090661b0/tr">LinkedIn</a></p>
            </div>
        </body>
        </html>
    `;
    
    // Yeni pencerede raporu aç
    const reportWindow = window.open('', '_blank', 'width=1200,height=900');
    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    
    // Grafikleri oluştur (sayfa yüklendikten sonra)
    setTimeout(() => {
        try {
            createReportCharts(results, reportWindow);
            console.log('✅ Rapor grafikleri başarıyla oluşturuldu');
        } catch (error) {
            console.error('❌ Rapor grafikleri oluşturulurken hata:', error);
        }
    }, 1000);
}

// Rapor grafiklerini oluştur
function createReportCharts(results, reportWindow) {
    try {
        // Aylık üretim grafiği
        const monthlyCanvas = reportWindow.document.getElementById('monthlyChartReport');
        if (!monthlyCanvas) {
            console.error('❌ monthlyChartReport canvas bulunamadı');
            return;
        }
        const monthlyCtx = monthlyCanvas.getContext('2d');
        new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(results.monthlyProduction || {}).map(month => getMonthName(month)),
            datasets: [{
                label: 'Aylık Üretim (MWh)',
                data: Object.values(results.monthlyProduction || {}).map(prod => (prod || 0) / 1000),
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                title: {
                    display: true,
                    text: 'Aylık Üretim Analizi',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Üretim (MWh)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0
                    }
                }
            },
            elements: {
                bar: {
                    borderWidth: 1,
                    borderRadius: 4
                }
            }
        }
    });
    
    // Gelir karşılaştırma grafiği
    const revenueCanvas = reportWindow.document.getElementById('revenueChartReport');
    if (!revenueCanvas) {
        console.error('❌ revenueChartReport canvas bulunamadı');
        return;
    }
    const revenueCtx = revenueCanvas.getContext('2d');
    new Chart(revenueCtx, {
        type: 'bar',
        data: {
            labels: ['Normal Sistem', 'Depolamalı Sistem'],
            datasets: [{
                label: 'Toplam Gelir (TL)',
                data: [
                    results.totalRevenue || 0, 
                    (results.storageAnalysis?.yearly?.storageRevenue) || 0
                ],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(75, 192, 192, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                title: {
                    display: true,
                    text: 'Gelir Karşılaştırması',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Gelir (TL)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0
                    }
                }
            },
            elements: {
                bar: {
                    borderWidth: 1,
                    borderRadius: 4
                }
            }
        }
    });
    
    console.log('✅ Rapor grafikleri başarıyla oluşturuldu');
    } catch (error) {
        console.error('❌ Rapor grafikleri oluşturulurken hata:', error);
    }
}

// EPİAŞ CSV upload area initialization
function initializeEpiasUploadArea() {
    const uploadArea = document.getElementById('epiasUploadArea');
    const fileInput = document.getElementById('epiasCsvFile');

    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#28a745';
        uploadArea.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#28a745';
        uploadArea.style.backgroundColor = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#28a745';
        uploadArea.style.backgroundColor = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
            fileInput.files = files;
            handleEpiasFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleEpiasFileUpload(e.target.files[0]);
        }
    });
}

// Handle EPİAŞ file upload
function handleEpiasFileUpload(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        epiasCsvData = parseEpiasCSV(text);
        
        // Update upload area
        const uploadArea = document.getElementById('epiasUploadArea');
        uploadArea.innerHTML = `
            <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
            <p class="mb-2 text-success">${file.name} yüklendi</p>
            <small class="text-muted">${epiasCsvData.length} fiyat kaydı bulundu</small>
        `;
        
        // Process EPİAŞ data
        processEpiasData();
    };
    reader.readAsText(file);
}

// Parse EPİAŞ CSV data
function parseEpiasCSV(text) {
    const lines = text.split('\n');
    const data = [];
    const availableDates = new Set(); // Mevcut tarihleri takip et
    
    console.log('=== EPİAŞ CSV PARSING BAŞLADI ===');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        
        // Skip header row
        if (i === 0) {
            console.log('Header row:', values);
            continue;
        }
        
        if (values.length >= 4) {
            const dateStr = values[0];
            const timeStr = values[1];
            const priceTLStr = `${values[2]},${values[3]}`; // TL fiyatını birleştir
            
            console.log(`Satır ${i + 1}: Tarih: "${dateStr}", Saat: "${timeStr}", Fiyat: "${priceTLStr}"`);
            
            // Parse date (format: "1.01.2024")
            const dateMatch = dateStr.match(/(\d+)\.(\d+)\.(\d+)/);
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const month = dateMatch[2].padStart(2, '0');
                const year = dateMatch[3];
                
                // Parse time (format: "00:00")
                const timeMatch = timeStr.match(/(\d+):(\d+)/);
                if (timeMatch) {
                    const hour = timeMatch[1].padStart(2, '0');
                    const minute = timeMatch[2].padStart(2, '0');
                    
                    // Parse price (format: "1.299,98")
                    // "1.299,98" -> "1299.98" -> 1299.98
                    const cleanPrice = priceTLStr.replace(/\./g, '').replace(',', '.');
                    const price = parseFloat(cleanPrice);
                    
                    console.log(`Temizlenmiş fiyat: "${cleanPrice}" -> ${price}`);
                    
                    if (!isNaN(price)) {
                        const dateKey = `${year}-${month}-${day}`;
                        const timeKey = `${hour}:${minute}`;
                        
                        data.push({
                            date: dateKey,
                            time: timeKey,
                            hour: hour,
                            price: price
                        });
                        
                        availableDates.add(dateKey); // Mevcut tarihi kaydet
                        
                        console.log(`✅ EPİAŞ kayıt: ${dateKey} ${timeKey} - ${price} TL/MWh`);
                    } else {
                        console.warn(`❌ Geçersiz TL fiyatı: "${priceTLStr}" -> "${cleanPrice}" -> ${price}`);
                    }
                } else {
                    console.warn(`❌ Geçersiz saat formatı: "${timeStr}"`);
                }
            } else {
                console.warn(`❌ Geçersiz tarih formatı: "${dateStr}"`);
            }
        } else {
            console.warn(`❌ Yetersiz sütun sayısı (EPİAŞ CSV): ${values.length} (en az 4 gerekli)`);
        }
    }
    
    // Mevcut tarihleri global değişkende sakla
    window.availablePriceDates = availableDates;
    
    console.log('=== EPİAŞ CSV PARSING BİTTİ ===');
    console.log('Toplam EPİAŞ kayıt:', data.length);
    console.log('Mevcut tarihler:', Array.from(availableDates).sort());
    return data;
} 

// Process EPİAŞ data and organize by month
function processEpiasData() {
    epiasPrices = {};
    
    epiasCsvData.forEach(record => {
        const monthKey = record.date.substring(0, 7); // YYYY-MM format
        const day = record.date.substring(8, 10); // DD format
        
        if (!epiasPrices[monthKey]) {
            epiasPrices[monthKey] = {
                avgPrice: 0,
                maxPrice: 0,
                minPrice: Infinity,
                dailyPrices: {},
                hourlyPrices: {}
            };
        }
        
        const monthData = epiasPrices[monthKey];
        
        // Add to daily prices
        if (!monthData.dailyPrices[day]) {
            monthData.dailyPrices[day] = [];
        }
        monthData.dailyPrices[day].push(record.price);
        
        // Add to hourly prices
        if (!monthData.hourlyPrices[record.hour]) {
            monthData.hourlyPrices[record.hour] = [];
        }
        monthData.hourlyPrices[record.hour].push(record.price);
    });
    
    // Calculate averages
    Object.keys(epiasPrices).forEach(monthKey => {
        const monthData = epiasPrices[monthKey];
        
        // Calculate daily averages
        Object.keys(monthData.dailyPrices).forEach(day => {
            const prices = monthData.dailyPrices[day];
            monthData.dailyPrices[day] = prices.reduce((a, b) => a + b, 0) / prices.length;
        });
        
        // Calculate hourly averages
        Object.keys(monthData.hourlyPrices).forEach(hour => {
            const prices = monthData.hourlyPrices[hour];
            monthData.hourlyPrices[hour] = prices.reduce((a, b) => a + b, 0) / prices.length;
        });
        
        // Calculate monthly statistics
        const allPrices = Object.values(monthData.dailyPrices);
        monthData.avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
        monthData.maxPrice = Math.max(...allPrices);
        monthData.minPrice = Math.min(...allPrices);
    });
    
    console.log('EPİAŞ verileri işlendi:', epiasPrices);
}

// Initialize upload area
function initializeUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('csvFile');

    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#764ba2';
        uploadArea.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.backgroundColor = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.backgroundColor = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
            fileInput.files = files;
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

// Handle file upload
function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        csvData = parseCSV(text);
        
        // Update upload area
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = `
            <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
            <p class="mb-2 text-success">${file.name} yüklendi</p>
            <small class="text-muted">${csvData.length} kayıt bulundu</small>
        `;
        
        // CSV yüklendiğinde batarya tasarım hesaplamalarını güncelle
        setTimeout(() => {
            calculateBatteryDesign();
        }, 100);
    };
    reader.readAsText(file);
}

// Parse CSV data - PVSYST format için güncellendi
function parseCSV(text) {
    const lines = text.split('\n');
    const data = [];
    
    console.log('=== CSV PARSING BAŞLADI ===');
    console.log('CSV satır sayısı:', lines.length);
    console.log('İlk 20 satır:', lines.slice(0, 20));

    // 14. satırdan başla (index 13)
    for (let i = 13; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            
            console.log(`\n--- Satır ${i + 1} ---`);
            console.log('Değerler:', values);
            console.log('Sütun sayısı:', values.length);
            
            // A sütunu (index 0) tarih ve saat bilgisi
            // E sütunu (index 4) üretim değerleri (EDirUse)
            if (values.length >= 5) {
                const dateTimeStr = values[0]; // A sütunu
                const productionStr = values[4]; // E sütunu (EDirUse)
                
                console.log(`A sütunu (tarih): "${dateTimeStr}"`);
                console.log(`E sütunu (üretim): "${productionStr}"`);
                
                // Basit tarih kontrolü
                if (dateTimeStr && productionStr) {
                    // Tarih formatını kontrol et - PVSYST formatı: "DD/MM/YY HH:MM"
                    const hasDate = dateTimeStr.includes('/') && dateTimeStr.includes(':');
                    const hasProduction = !isNaN(parseFloat(productionStr));
                    
                    console.log(`Tarih formatı uygun mu: ${hasDate}`);
                    console.log(`Üretim değeri sayı mı: ${hasProduction}`);
                    
                    if (hasDate && hasProduction) {
                        // Tarih ayrıştırma - PVSYST formatı: "DD/MM/YY HH:MM"
                        const dateMatch = dateTimeStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})/);
                        
                        if (dateMatch) {
                            const day = dateMatch[1].padStart(2, '0');
                            const month = dateMatch[2].padStart(2, '0');
                            const year = '19' + dateMatch[3]; // 90 -> 1990
                            const hour = dateMatch[4].padStart(2, '0');
                            const minute = dateMatch[5];
                            
                            const date = `${year}-${month}-${day}`;
                            const time = `${hour}:${minute}`;
                            const production = parseFloat(productionStr);
                            
                            console.log(`✅ Ayrıştırılan: Tarih=${date}, Saat=${time}, Üretim=${production}`);
                            
                            // Sadece güneş enerjisi üretim saatlerini al (08:00-20:00)
                            const hourNum = parseInt(hour);
                            if (hourNum >= 8 && hourNum <= 20 && production > 0) {
                                data.push({
                                    'Tarih': date,
                                    'Saat': time,
                                    'Üretim (kWh)': production
                                });
                                console.log(`✅ Kayıt eklendi: ${date} ${time} - ${production} kWh`);
                            } else {
                                console.log(`❌ Saat dışında veya üretim 0: ${hourNum}:${minute} - ${production}`);
                            }
                        } else {
                            console.log(`❌ Tarih regex eşleşmedi: "${dateTimeStr}"`);
                        }
                    } else {
                        console.log(`❌ Tarih veya üretim formatı uygun değil`);
                    }
                } else {
                    console.log(`❌ Tarih veya üretim değeri boş`);
                }
            } else {
                console.log(`❌ Yetersiz sütun sayısı: ${values.length} (en az 5 gerekli)`);
            }
        }
    }

    console.log('\n=== CSV PARSING BİTTİ ===');
    console.log('Toplam bulunan kayıt:', data.length);
    console.log('Bulunan kayıtlar:', data);
    return data;
}

// Initialize form
function initializeForm() {
    const form = document.getElementById('analysisForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        performAnalysis();
    });
}

// Perform analysis
function performAnalysis() {
    // Giriş zorunluluğu kaldırıldı
    if (csvData.length === 0) {
        alert('Lütfen önce üretim CSV dosyası yükleyin!');
        return;
    }

    if (!epiasData || epiasData.length === 0) {
        const useDefault = confirm('EPİAŞ fiyat verileri yüklenmedi. Varsayılan 1000 TL/MWh fiyatı ile devam etmek istiyor musunuz?\n\n"Entegre Verileri Yükle" butonuna tıklayarak gerçek fiyat verilerini yükleyebilirsiniz.');
        if (!useDefault) {
            return;
        }
    }

    // "Analiz" sekmesine geç ve loading'i göster
    const resultsTab = document.getElementById('results-tab');
    if (resultsTab) {
        // Manuel tab switching
        const allPanes = document.querySelectorAll('.tab-pane');
        allPanes.forEach(pane => {
            pane.classList.remove('show', 'active');
        });
        
        const resultsPane = document.querySelector('#results');
        if (resultsPane) {
            resultsPane.classList.add('show', 'active');
        }
        
        // Aktif sidebar link
        const allTabs = document.querySelectorAll('[data-bs-toggle="tab"]');
        allTabs.forEach(tab => tab.classList.remove('active'));
        resultsTab.classList.add('active');
    }

    // Show loading indicator
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }

    // Simulate processing time
    setTimeout(() => {
        try {
            // Kapasite takvimini güncelle (analiz öncesinde)
            buildBatteryCapacitySchedule();
            
            // Seçilen tarih aralığına göre üretim verilerini filtrele
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            
            let dataToAnalyze = csvData;
            console.log(`🔍 Analiz başlıyor - csvData: ${csvData.length} kayıt`);
            console.log(`🔍 EPİAŞ veri durumu: ${epiasData ? epiasData.length : 'YOK'} kayıt`);
            
            if (startDate && endDate && epiasData && epiasData.length > 0) {
                console.log(`🔍 Tarih aralığı seçili (${startDate} - ${endDate}), üretim verileri filtreleniyor...`);
                dataToAnalyze = filterProductionDataByDateRange(csvData, startDate, endDate);
                console.log(`📊 Filtrelenmiş üretim verileri: ${dataToAnalyze.length} kayıt`);
                
                if (dataToAnalyze.length === 0) {
                    console.error('❌ Filtrelenmiş üretim verisi boş!');
                    alert('Seçilen tarih aralığında üretim verisi bulunamadı!');
                    return;
                }
            } else {
                console.warn('⚠️ Tarih aralığı belirtilmemiş veya EPİAŞ verisi yok, tüm üretim verisi kullanılıyor');
            }
            
            console.log(`🧮 calculateAnalysis çağrılıyor: ${dataToAnalyze.length} kayıt ile`);
            analysisResults = calculateAnalysis(dataToAnalyze) || {
                totalRevenue: 0,
                totalProduction: 0,
                dailyProduction: {},
                dailyRevenue: {},
                dailyPrices: {}
            };
            console.log(`📊 calculateAnalysis sonuçları:`, analysisResults);
            
            // Depolamalı sistem analizini hesapla
            analysisResults.storageAnalysis = calculateStorageAnalysis(analysisResults);
            
            // Analiz sonuçlarını global olarak sakla (rapor için)
            window.currentAnalysisResults = analysisResults;
            
            console.log(`🎯 displayResults çağrılıyor...`);
            displayResults(analysisResults);
            
            // UI elementlerini kontrol et
            const totalRevenueElement = document.getElementById('totalRevenueResult');
            if (totalRevenueElement) {
                console.log(`💰 UI'da gösterilen toplam gelir: ${totalRevenueElement.textContent}`);
            } else {
                console.warn('⚠️ totalRevenueResult elementi bulunamadı!');
            }
            
            // Başarılı analiz bildirimi
            showNotification('Analiz başarıyla tamamlandı! Sonuçlar "Analiz" sekmesinde görüntüleniyor.', 'success');
            
        } catch (error) {
            console.error('Analiz hatası:', error);
            alert('Analiz sırasında bir hata oluştu: ' + error.message);
        } finally {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
    }, 1500);
}

// Get EPİAŞ price for specific date and hour (API verileri için güncellenmiş v2.0)
function getPriceForDateTime(date, hour) {
    // API'den yüklenen veri sistemini kullan
    if (!epiasData || epiasData.length === 0) {
        console.warn('❌ EPİAŞ verileri yüklenmemiş! Önce API\'den veri yükleyin.');
        return 2500; // Varsayılan güncel ortalama fiyat
    }
    
    // Üretim tarihini API formatına çevir
    // Üretim: "2025-01-01" -> EPİAŞ: "01.01.2025"
    const dateParts = date.split('-'); // ['2025', '01', '01']
    if (dateParts.length !== 3) {
        console.warn(`❌ Geçersiz tarih formatı: ${date}`);
        return 2500;
    }
    
    let year = dateParts[0];   // YYYY
    const month = dateParts[1];  // MM  
    const day = dateParts[2];    // DD
    
    // Üretim verisinde 1990 gibi göstermelik yıl varsa, EPİAŞ için gerçek yıl kullan
    if (year === '1990' || parseInt(year) < 2020) {
        year = '2025'; // Önce 2025'i dene (log yok, hız için)
    }
    
    // EPİAŞ formatına çevir: "01.01.2025"
    const epiasDateFormat = `${day}.${month}.${year}`;
    
    // Hedef saat formatını düzelt
    const targetHour = hour.padStart(2, '0') + ':00'; // "9" -> "09:00"
    
    // EPİAŞ verilerinde tam eşleşme ara (hızlı, log yok)
    const matchingRecord = epiasData.find(record => {
        return record.Tarih === epiasDateFormat && record.Saat === targetHour;
    });
    
    if (matchingRecord) {
        const price = matchingRecord['PTF (TL/MWh)'];
        return price;
    }
    
    // Bulunamadıysa 2024 yılını dene (hızlı fallback)
    if (year === '2025') {
        const epiasDateFormat2024 = `${day}.${month}.2024`;
        const fallbackRecord2024 = epiasData.find(record => {
            return record.Tarih === epiasDateFormat2024 && record.Saat === targetHour;
        });
        
        if (fallbackRecord2024) {
            return fallbackRecord2024['PTF (TL/MWh)'];
        }
    }
    
    // Son çare: aynı gün/ay herhangi bir yıl
    const monthDay = `${day}.${month}`;
    const fallbackRecord = epiasData.find(record => {
        return record.Tarih.includes(monthDay) && record.Saat === targetHour;
    });
    
    if (fallbackRecord) {
        return fallbackRecord['PTF (TL/MWh)'];
    }
    
    // Hiç bulunamadıysa güncel ortalama fiyat
    return 2500;
}

    // Debug fonksiyonu - EPİAŞ veri eşleştirmesini test et
function debugEpiasMatching() {
    if (!epiasData || epiasData.length === 0) {
        console.error('❌ epiasData boş!');
        return;
    }
    
    console.log('🔍 EPİAŞ Debug Başlıyor...');
    console.log(`📊 Toplam EPİAŞ kayıt: ${epiasData.length}`);
    console.log(`📅 İlk 5 kayıt:`, epiasData.slice(0, 5));
    console.log(`📅 Son 5 kayıt:`, epiasData.slice(-5));
    
    // Test birkaç farklı tarih/saat eşleştirmesi
    const tests = [
        {date: "2025-01-01", hour: "9"},
        {date: "2025-01-01", hour: "12"},
        {date: "2025-01-02", hour: "8"}
    ];
    
    tests.forEach(test => {
        console.log(`\n🧪 Test: ${test.date} saat ${test.hour}`);
        const price = getPriceForDateTime(test.date, test.hour);
        console.log(`💰 Dönen fiyat: ${price} TL/MWh`);
    });
    
    // CSV verilerini de kontrol et
    if (csvData && csvData.length > 0) {
        console.log(`\n📊 Üretim verisi: ${csvData.length} kayıt`);
        console.log(`📅 İlk üretim:`, csvData[0]);
    } else {
        console.warn('⚠️ csvData boş - üretim verisi yok!');
    }
    
    // calculateAnalysis test
    if (csvData && csvData.length > 0 && epiasData && epiasData.length > 0) {
        console.log('\n🧪 Mini analiz testi...');
        const sampleData = csvData.slice(0, 10); // İlk 10 kayıt
        const results = calculateAnalysis(sampleData);
        console.log('📊 Mini analiz sonuçları:', results);
    }
}



// Show EPİAŞ CSV format info
function showEpiasInfo() {
    alert(`EPİAŞ CSV Formatı:

A Sütunu: Tarih (örn: "1.01.2024")
B Sütunu: Saat (örn: "00:00", "09:00") 
C Sütunu: PTF (TL/MWh) - Fiyat verisi
D Sütunu: PTF (USD/MWh) - Opsiyonel
E Sütunu: PTF (EUR/MWh) - Opsiyonel

Örnek:
1.01.2024,00:00,1299.98,44.16,39.91
1.01.2024,01:00,1450.25,48.50,43.20

Not: Fiyatlar virgül ile ayrılmış ondalık sayılar olmalıdır.`);
} 

// Calculate analysis with EPİAŞ prices
function calculateAnalysis(data) {
    // Giriş kontrolü kaldırıldı
    console.log('🔍 CALCULATE ANALYSIS BAŞLIYOR...');
    console.log(`📊 Üretim veri sayısı: ${data.length}`);
    console.log(`📊 EPİAŞ veri durumu: ${epiasData ? epiasData.length : 'BOŞ!'}`);
    
    // EPİAŞ verisi kontrolü
    if (!epiasData || epiasData.length === 0) {
        console.error('❌ EPİAŞ verileri yüklenmemiş! Önce "API\'den Hızlı Yükle" tıklayın!');
        alert('❌ EPİAŞ verileri yüklenmemiş! Önce "API\'den Hızlı Yükle" butonuna tıklayın!');
        return null;
    }
    
    // Calculate actual production
    let totalProduction = 0;
    let totalRevenue = 0;
    const dailyProduction = {};
    const dailyRevenue = {};
    const dailyPrices = {}; // Günlük EPİAŞ fiyatları
    const hourlyProduction = {};
    const hourlyRevenue = {};
    
    console.log(`💰 Dağıtım bedeli: ${currentDistributionFee} kr/kWh`);
    
    data.forEach(row => {
        const production = parseFloat(row['Üretim (kWh)'] || 0);
        if (!isNaN(production)) {
            const date = row['Tarih'];
            const hour = row['Saat'].split(':')[0];
            const month = date.substring(0, 7); // YYYY-MM format
            const day = date.substring(8, 10); // DD format
            
            // EPİAŞ fiyatını al
            const pricePerMWh = getPriceForDateTime(date, hour);
            
            // EPİAŞ fiyatı çok düşükse uyar ama hesaplamaya devam et
            if (pricePerMWh <= 0) {
                console.log(`⚠️ EPİAŞ fiyatı düşük/sıfır: ${date} ${hour}:00 - ${pricePerMWh} TL/MWh (${production} kWh)`);
            }
            
            totalProduction += production;
            
            // Gelir hesaplama (Doğru formül):
            // 1. EPİAŞ geliri: production(kWh) * pricePerMWh(TL/MWh) / 1000
            // 2. Dağıtım bedeli: production(kWh) * currentDistributionFee(kr/kWh) / 100
            const epiasRevenue = (production / 1000) * pricePerMWh; // TL
            const distributionCost = (production * currentDistributionFee) / 100; // TL
            const revenue = epiasRevenue - distributionCost; // Net TL
            
            totalRevenue += revenue;
            
            if (date) {
                if (!dailyProduction[date]) {
                    dailyProduction[date] = 0;
                    dailyRevenue[date] = 0;
                    dailyPrices[date] = []; // Fiyatları liste olarak tut
                }
                dailyProduction[date] += production;
                dailyRevenue[date] += revenue;
                dailyPrices[date].push(pricePerMWh); // Her saatin fiyatını ekle
            }
            
            if (hour) {
                if (!hourlyProduction[hour]) {
                    hourlyProduction[hour] = 0;
                    hourlyRevenue[hour] = 0;
                }
                hourlyProduction[hour] += production;
                hourlyRevenue[hour] += revenue;
            }
        }
    });

    // Convert to MWh
    const actualProductionMWh = totalProduction / 1000;
    
    // Calculate statistics
    const dailyValues = Object.values(dailyProduction).map(v => v / 1000);
    const avgDaily = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
    const maxDaily = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
    const minDaily = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
    
    // Revenue statistics
    const dailyRevenueValues = Object.values(dailyRevenue);
    const avgDailyRevenue = dailyRevenueValues.length > 0 ? dailyRevenueValues.reduce((a, b) => a + b, 0) / dailyRevenueValues.length : 0;
    const maxDailyRevenue = dailyRevenueValues.length > 0 ? Math.max(...dailyRevenueValues) : 0;
    const minDailyRevenue = dailyRevenueValues.length > 0 ? Math.min(...dailyRevenueValues) : 0;
    
    return {
        actual: actualProductionMWh,
        totalProduction: totalProduction, // kWh cinsinden toplam üretim
        totalRevenue: totalRevenue,
        avgDaily: avgDaily,
        maxDaily: maxDaily,
        minDaily: minDaily,
        avgDailyRevenue: avgDailyRevenue,
        maxDailyRevenue: maxDailyRevenue,
        minDailyRevenue: minDailyRevenue,
        totalDays: dailyValues.length,
        dailyProduction: dailyProduction,
        dailyRevenue: dailyRevenue,
        dailyPrices: dailyPrices, // EPİAŞ günlük fiyatları
        hourlyProduction: hourlyProduction,
        hourlyRevenue: hourlyRevenue,
        monthlyProduction: calculateMonthlyProduction(dailyProduction),
        monthlyRevenue: calculateMonthlyRevenue(dailyRevenue)
    };
}

// Calculate monthly production
function calculateMonthlyProduction(dailyProduction) {
    const monthly = {};
    
    Object.keys(dailyProduction).forEach(date => {
        const month = date.substring(0, 7); // YYYY-MM format
        if (!monthly[month]) {
            monthly[month] = 0;
        }
        monthly[month] += dailyProduction[date] / 1000; // Convert to MWh
    });
    
    return monthly;
}

// Calculate monthly revenue
function calculateMonthlyRevenue(dailyRevenue) {
    const monthly = {};
    
    Object.keys(dailyRevenue).forEach(date => {
        const month = date.substring(0, 7); // YYYY-MM format
        if (!monthly[month]) {
            monthly[month] = 0;
        }
        monthly[month] += dailyRevenue[date];
    });
    
    return monthly;
}

// Display results
function displayResults(results) {
    try {
        // Güvenli element güncelleme fonksiyonu
        function safeUpdateElement(id, value) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element bulunamadı: ${id}`);
            }
        }

        // Fiyat formatlama fonksiyonu (kompakt format)
        function formatPrice(price) {
            if (price >= 1000000) {
                return (price / 1000000).toFixed(1) + 'M';
            } else if (price >= 1000) {
                return (price / 1000).toFixed(1) + 'K';
            } else {
                return new Intl.NumberFormat('tr-TR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(price);
            }
        }

        // Update result cards (güvenli şekilde)
        safeUpdateElement('actualResult', results.actual.toFixed(2) + ' MWh');
        safeUpdateElement('totalRevenueResult', '₺' + formatPrice(results.totalRevenue));
        safeUpdateElement('totalDaysResult', results.totalDays + ' Gün');
        
        // Ortalama fiyat hesapla
    const avgPrice = (results && results.actual > 0) ? (results.totalRevenue / results.actual) : 0;
        safeUpdateElement('avgPrice', '₺' + formatPrice(avgPrice));
        
        // Update statistics with revenue (güvenli şekilde)
        safeUpdateElement('avgDaily', results.avgDaily.toFixed(2) + ' MWh');
        // maxDaily, minDaily elementleri HTML'de yok - başka yerde gösteriliyor
        // safeUpdateElement('maxDaily', results.maxDaily.toFixed(2) + ' MWh');
        // safeUpdateElement('minDaily', results.minDaily.toFixed(2) + ' MWh'); 
        // totalDays'i totalDaysResult olarak gösteriyoruz
        // safeUpdateElement('totalDays', results.totalDays);
        
        // Add revenue information to stats
        updateRevenueStats(results);
        
        // Add monthly selection
        createMonthlySelection(results);
        
        // Show sections (güvenli şekilde)
        const sections = ['resultsSection', 'statsSection', 'chartSection', 'monthlySelection'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'block';
            } else {
                console.warn(`Section bulunamadı: ${sectionId}`);
            }
        });
        
        // Create storage comparison summary
        createStorageComparisonSummary(results);
        
        // Create charts
        requestAnimationFrame(() => {
        createMonthlyChart(results);
        createRevenueChart(results);
        });
        
        // Loading'i gizle
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        console.log('✅ Analiz tamamlandı, sonuçlar gösterildi');
        
        console.log('✅ Sonuçlar başarıyla gösterildi');
        
    } catch (error) {
        console.error('❌ displayResults hatası:', error);
        alert('Sonuçları gösterme sırasında bir hata oluştu: ' + error.message);
    }
}

// Update revenue statistics
function updateRevenueStats(results) {
    try {
        // Revenue stats container'ını bul veya oluştur
        let revenueStatsContainer = document.getElementById('revenueStats');
        if (!revenueStatsContainer) {
            // Stats section'ı bul
            const statsSection = document.getElementById('statsSection');
            if (!statsSection) {
                console.warn('Stats section bulunamadı');
                return;
            }
            
            // Revenue stats row'u oluştur
            const revenueRow = document.createElement('div');
            revenueRow.className = 'row mt-4';
            // Fiyat formatlama fonksiyonu (kompakt format)
            function formatPrice(price) {
                if (price >= 1000000) {
                    return (price / 1000000).toFixed(1) + 'M';
                } else if (price >= 1000) {
                    return (price / 1000).toFixed(1) + 'K';
                } else {
                    return new Intl.NumberFormat('tr-TR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(price);
                }
            }
            
            revenueRow.innerHTML = `
                <div class="col-12">
                    <h6 class="mb-3 text-white"><i class="fas fa-money-bill-wave me-2"></i>Gelir Analizi</h6>
                    <div class="row" id="revenueStats">
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice(results.totalRevenue)}</div>
                                <div class="stats-label">Toplam Gelir</div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice(results.avgDailyRevenue)}</div>
                                <div class="stats-label">Ortalama Günlük Gelir</div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice(results.maxDailyRevenue)}</div>
                                <div class="stats-label">Maksimum Günlük Gelir</div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice(results.minDailyRevenue)}</div>
                                <div class="stats-label">Minimum Günlük Gelir</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-12 mt-4">
                    <h6 class="mb-3 text-white"><i class="fas fa-battery-full me-2"></i>Depolamalı Gelir Analizi</h6>
                    <div class="row" id="storageRevenueStats">
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice((results.storageAnalysis?.yearly?.storageRevenue) || 0)}</div>
                                <div class="stats-label">Toplam Gelir</div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice((results.storageAnalysis?.dailyStats?.avgDailyStorageRevenue) || 0)}</div>
                                <div class="stats-label">Ortalama Günlük Gelir</div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice((results.storageAnalysis?.dailyStats?.maxDailyStorageRevenue) || 0)}</div>
                                <div class="stats-label">Maksimum Günlük Gelir</div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="stats-card">
                                <div class="stats-value">₺${formatPrice((results.storageAnalysis?.dailyStats?.minDailyStorageRevenue) || 0)}</div>
                                <div class="stats-label">Minimum Günlük Gelir</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Stats section'a ekle
            statsSection.appendChild(revenueRow);
            revenueStatsContainer = document.getElementById('revenueStats');
        } else {
            // Mevcut revenue stats'i güncelle
            const statsCards = revenueStatsContainer.querySelectorAll('.stats-card .stats-value');
            if (statsCards.length >= 4) {
                statsCards[0].textContent = `${results.totalRevenue.toFixed(2)} TL`;
                statsCards[1].textContent = `${results.avgDailyRevenue.toFixed(2)} TL`;
                statsCards[2].textContent = `${results.maxDailyRevenue.toFixed(2)} TL`;
                statsCards[3].textContent = `${results.minDailyRevenue.toFixed(2)} TL`;
            }
        }
        
        console.log('✅ Revenue stats güncellendi');
        
    } catch (error) {
        console.error('❌ updateRevenueStats hatası:', error);
    }
}

// Create storage comparison summary
function createStorageComparisonSummary(results) {
    // Depolamalı sistem karşılaştırma tablosu container'ını bul veya oluştur
    let storageComparisonContainer = document.getElementById('storageComparisonSection');
    if (!storageComparisonContainer) {
        const resultsSection = document.getElementById('resultsSection');
        
        // Storage comparison section oluştur
        const storageSection = document.createElement('div');
        storageSection.className = 'row mt-4';
        storageSection.id = 'storageComparisonSection';
        storageSection.innerHTML = `
            <div class="col-12">
                <div class="card" style="background: linear-gradient(45deg, #FFD700, #FFA500); color: white;">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="fas fa-battery-full me-2"></i>Depolamalı Sistem Karşılaştırma Analizi</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive" style="margin-bottom: 20px;">
                            <table class="table table-bordered table-hover" style="background-color: white; color: black; margin-bottom: 0;">
                                <thead class="table-dark">
                                    <tr>
                                        <th>Dönem</th>
                                        <th>Depolamasız Gelir (TL)</th>
                                        <th>Depolamalı Gelir (TL)</th>
                                        <th>Kar Farkı (TL)</th>
                                        <th>Kar Artışı (%)</th>
                                    </tr>
                                </thead>
                                <tbody id="storageComparisonTableBody">
                                    <!-- Tablo içeriği dinamik olarak doldurulacak -->
                                </tbody>
                            </table>
                        </div>
                        <div class="row" style="margin-top: 20px;">
                            <div class="col-12">
                                <div class="alert alert-info" style="margin-bottom: 0; position: relative;">
                                    <h6><i class="fas fa-info-circle me-2"></i>Depolamalı Sistem Stratejisi:</h6>
                                    <ul class="mb-0">
                                        <li><strong>Şarj Stratejisi:</strong> Üretim saatlerinde en düşük 2 Epiaş fiyatına sahip saatlerde üretimi depolama</li>
                                        <li><strong>Deşarj Stratejisi:</strong> Mevsimsel satış aralıklarında en yüksek fiyatlı üretim olmayan saatte satış</li>
                                        <li><strong>Mevsimsel Satış Aralıkları:</strong></li>
                                        <li style="margin-left: 20px;">• Ocak-Şubat, Kasım-Aralık: 17:00-23:00 (Üretim 16:00'da biter)</li>
                                        <li style="margin-left: 20px;">• Mart, Eylül-Ekim: 18:00-23:00 (Üretim 17:00'da biter)</li>
                                        <li style="margin-left: 20px;">• Nisan-Ağustos: 19:00-23:00 (Üretim 18:00'da biter)</li>
                                        <li><strong>Optimizasyon:</strong> Dinamik üretim aralığı ve mevsimsel satış stratejisi ile maksimum kar</li>
                                    </ul>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Results section'a ekle
        resultsSection.appendChild(storageSection);
        storageComparisonContainer = document.getElementById('storageComparisonSection');
    }
    
    // Depolamalı sistem hesaplamalarını yap
    const storageAnalysis = calculateStorageAnalysis(results);
    
    // Tablo içeriğini güncelle
    const tableBody = document.getElementById('storageComparisonTableBody');
    tableBody.innerHTML = '';
    
    // Gelir formatlama fonksiyonu (binlik ayırıcılar ile)
    function formatRevenue(amount) {
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
    
    // Yıllık karşılaştırma
    const yearlyRow = tableBody.insertRow();
    yearlyRow.innerHTML = `
        <td><strong>Yıllık Toplam</strong></td>
        <td>${formatRevenue(storageAnalysis.yearly.normalRevenue)}</td>
        <td>${formatRevenue(storageAnalysis.yearly.storageRevenue)}</td>
        <td class="${storageAnalysis.yearly.profitDifference >= 0 ? 'text-success' : 'text-danger'}">
            ${storageAnalysis.yearly.profitDifference >= 0 ? '+' : ''}${formatRevenue(storageAnalysis.yearly.profitDifference)}
        </td>
        <td class="${storageAnalysis.yearly.profitPercentage >= 0 ? 'text-success' : 'text-danger'}">
            ${storageAnalysis.yearly.profitPercentage.toFixed(2)}%
        </td>
    `;
    
    // Aylık karşılaştırmalar
    Object.keys(storageAnalysis.monthly).sort().forEach(month => {
        const monthData = storageAnalysis.monthly[month];
        const monthRow = tableBody.insertRow();
        monthRow.innerHTML = `
            <td><strong>${getMonthName(month)}</strong></td>
            <td>${formatRevenue(monthData.normalRevenue)}</td>
            <td>${formatRevenue(monthData.storageRevenue)}</td>
            <td class="${monthData.profitDifference >= 0 ? 'text-success' : 'text-danger'}">
                ${monthData.profitDifference >= 0 ? '+' : ''}${formatRevenue(monthData.profitDifference)}
            </td>
            <td class="${monthData.profitPercentage >= 0 ? 'text-success' : 'text-danger'}">
                ${monthData.profitPercentage.toFixed(2)}%
            </td>
        `;
    });
}

// Depolamalı sistem analizi hesapla
function calculateStorageAnalysis(results) {
    // Koruma: results boş ise default yapıyı oluştur
    if (!results || typeof results !== 'object') {
        results = { totalRevenue: 0, dailyRevenue: {}, dailyProduction: {}, dailyPrices: {} };
    }
    results.totalRevenue = results.totalRevenue || 0;
    results.dailyRevenue = results.dailyRevenue || {};
    results.dailyProduction = results.dailyProduction || {};
    results.dailyPrices = results.dailyPrices || {};
    // Kapasite durumunu sıfırla (sadece boşsa)
    if (Object.keys(CapacityState.factorByDate).length === 0) {
        console.log('🔄 Kapasite durumu sıfırlandı, analiz başlıyor...');
    } else {
        console.log('🔄 Mevcut kapasite durumu korunuyor, analiz devam ediyor...');
    }
    console.log('📊 Başlangıç parametreleri: rPerEfc=', CapacityState.rPerEfc, 'minFactor=', CapacityState.minFactor);
    
    const analysis = {
        yearly: {
            normalRevenue: 0,
            storageRevenue: 0,
            profitDifference: 0,
            profitPercentage: 0
        },
        monthly: {}
    };
    
    // Yıllık normal gelir
    analysis.yearly.normalRevenue = results.totalRevenue;
    
    // Aylık ve yıllık depolamalı gelir hesapla
    let totalStorageRevenue = 0;
    const dailyStorageRevenues = []; // Günlük depolamalı gelirleri sakla
    
    Object.keys(results.dailyRevenue).forEach(date => {
        const dailyRevenue = results.dailyRevenue[date];
        const dailyProduction = results.dailyProduction[date] / 1000; // kWh -> MWh
        const dailyPrices = results.dailyPrices[date] || [];
        
        // Depolamalı sistem geliri hesapla
        const storageRevenue = calculateStorageRevenue(date, dailyProduction, dailyPrices);
        totalStorageRevenue += storageRevenue;
        dailyStorageRevenues.push(storageRevenue); // Günlük geliri listeye ekle
        
        // Aylık analiz için ay bilgisini al
        const month = date.substring(0, 7); // YYYY-MM format
        if (!analysis.monthly[month]) {
            analysis.monthly[month] = {
                normalRevenue: 0,
                storageRevenue: 0,
                profitDifference: 0,
                profitPercentage: 0
            };
        }
        
        analysis.monthly[month].normalRevenue += dailyRevenue;
        analysis.monthly[month].storageRevenue += storageRevenue;
    });
    
    // Günlük depolamalı gelir istatistikleri
    analysis.dailyStats = {
        maxDailyStorageRevenue: dailyStorageRevenues.length > 0 ? Math.max(...dailyStorageRevenues) : 0,
        minDailyStorageRevenue: dailyStorageRevenues.length > 0 ? Math.min(...dailyStorageRevenues) : 0,
        avgDailyStorageRevenue: dailyStorageRevenues.length > 0 ? dailyStorageRevenues.reduce((a, b) => a + b, 0) / dailyStorageRevenues.length : 0
    };
    
    // Yıllık depolamalı gelir
    analysis.yearly.storageRevenue = totalStorageRevenue;
    
    // Kar farkları ve yüzdeleri hesapla
    analysis.yearly.profitDifference = analysis.yearly.storageRevenue - analysis.yearly.normalRevenue;
    
    // Yüzde hesaplaması - normal gelir negatifse mutlak değer al
    if (analysis.yearly.normalRevenue > 0) {
        const percentage = (analysis.yearly.profitDifference / analysis.yearly.normalRevenue) * 100;
        analysis.yearly.profitPercentage = percentage;
    } else if (analysis.yearly.normalRevenue < 0) {
        // Normal gelir negatifse, mutlak değer alarak pozitif yüzde hesapla
        const percentage = (analysis.yearly.profitDifference / Math.abs(analysis.yearly.normalRevenue)) * 100;
        analysis.yearly.profitPercentage = percentage;
    } else {
        analysis.yearly.profitPercentage = 0;
    }
    
    // Aylık kar farkları ve yüzdeleri hesapla
    Object.keys(analysis.monthly).forEach(month => {
        const monthData = analysis.monthly[month];
        monthData.profitDifference = monthData.storageRevenue - monthData.normalRevenue;
        
        // Yüzde hesaplaması - normal gelir negatifse mutlak değer al
        if (monthData.normalRevenue > 0) {
            const percentage = (monthData.profitDifference / monthData.normalRevenue) * 100;
            monthData.profitPercentage = percentage;
        } else if (monthData.normalRevenue < 0) {
            // Normal gelir negatifse, mutlak değer alarak pozitif yüzde hesapla
            const percentage = (monthData.profitDifference / Math.abs(monthData.normalRevenue)) * 100;
            monthData.profitPercentage = percentage;
        } else {
            monthData.profitPercentage = 0;
        }
    });
    
    return analysis;
}

// Create monthly chart
function createMonthlyChart(results) {
    try {
        // Canvas elementini güvenli şekilde bul
        const canvas = document.getElementById('monthlyChart');
        if (!canvas) {
            console.warn('Monthly chart canvas bulunamadı');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Canvas context oluşturulamadı');
            return;
        }
        
        // Mevcut chart'ı temizle
        if (window.monthlyChart && typeof window.monthlyChart.destroy === 'function') {
            window.monthlyChart.destroy();
        }
        
        const monthlyData = results.monthlyProduction;
        const labels = Object.keys(monthlyData).sort();
        const data = labels.map(label => monthlyData[label]);
        
        // Yeni chart oluştur
        window.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Aylık Üretim (MWh)',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Aylık Üretim Trendi'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Üretim (MWh)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Ay'
                        }
                    }
                }
            }
        });
        
        console.log('✅ Monthly chart oluşturuldu');
        
    } catch (error) {
        console.error('❌ createMonthlyChart hatası:', error);
    }
}

// Create daily chart


// Create revenue chart
function createRevenueChart(results) {
    try {
        // Canvas elementini güvenli şekilde bul
        const canvas = document.getElementById('revenueChart');
        if (!canvas) {
            console.warn('Revenue chart canvas bulunamadı');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Revenue chart canvas context oluşturulamadı');
            return;
        }
        
        // Mevcut chart'ı temizle
        if (window.revenueChart && typeof window.revenueChart.destroy === 'function') {
            window.revenueChart.destroy();
        }
        
        const monthlyRevenue = results.monthlyRevenue;
        const labels = Object.keys(monthlyRevenue).sort();
        
        // Normal gelir verisi
        const normalRevenue = labels.map(label => monthlyRevenue[label]);
        
        // Depolamalı sistem gelir verisi hesapla
        const storageRevenue = labels.map(month => {
            if (results.storageAnalysis && results.storageAnalysis.monthly && results.storageAnalysis.monthly[month]) {
                return results.storageAnalysis.monthly[month].storageRevenue || 0;
            }
            
            // Eğer depolamalı sistem verisi yoksa, manuel hesaplama yap
            const monthData = results.monthlyProduction ? results.monthlyProduction[month] : 0;
            const dailyProduction = monthData / 1000; // kWh'den MWh'ye
            const avgPrice = results.monthlyPrices && results.monthlyPrices[month] ? 
                            results.monthlyPrices[month] : 1000; // Varsayılan fiyat
            
            // Basit depolamalı sistem geliri tahmini (%15-20 artış)
            const storageMultiplier = 1.18;
            return (dailyProduction * avgPrice * storageMultiplier);
        });
        
        // Yeni chart oluştur
        window.revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Normal Sistem Geliri (TL)',
                        data: normalRevenue,
                        backgroundColor: 'rgba(255, 193, 7, 0.8)',
                        borderColor: '#FFC107',
                        borderWidth: 1
                    },
                    {
                        label: 'Depolamalı Sistem Geliri (TL)',
                        data: storageRevenue,
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        borderColor: '#22C55E',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Aylık Gelir Karşılaştırması (Normal vs Depolamalı)'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Gelir (TL)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Ay'
                        }
                    }
                }
            }
        });
        
        console.log('✅ Revenue comparison chart oluşturuldu');
        
    } catch (error) {
        console.error('❌ createRevenueChart hatası:', error);
    }
}

// Create monthly selection dropdown
function createMonthlySelection(results) {
    try {
        // Monthly selection container'ını bul
        const monthlySelectionContainer = document.getElementById('monthlySelection');
        if (!monthlySelectionContainer) {
            console.warn('Monthly selection container bulunamadı');
            return;
        }
        
        // Monthly selection içeriğini oluştur
        monthlySelectionContainer.innerHTML = `
            <div class="glass-card">
                <h5 class="text-white mb-3">
                    <i class="fas fa-calendar-alt me-2"></i>
                    Aylık Detay Analizi
                </h5>
                <div class="row">
                    <div class="col-md-6">
                        <label for="monthSelect" class="form-label text-white">Ay Seçin:</label>
                        <select class="form-select" id="monthSelect" onchange="showMonthlyDetails()">
                            <option value="">Ay seçin...</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <div class="mt-4">
                            <small class="text-white-50">
                                <i class="fas fa-info-circle me-1"></i>
                                Seçilen ayın günlük üretim ve gelir analizini görüntüleyin
                            </small>
                        </div>
                    </div>
                </div>
                <div id="monthlyDetails" class="mt-3" style="display: none;">
                    <!-- Aylık detaylar buraya gelecek -->
                </div>
            </div>
        `;
        
        // Ay seçeneklerini doldur
        const monthSelect = document.getElementById('monthSelect');
        if (monthSelect) {
            monthSelect.innerHTML = '<option value="">Ay seçin...</option>';
            
            Object.keys(results.monthlyProduction).sort().forEach(month => {
                const monthName = getMonthName(month);
                const option = document.createElement('option');
                option.value = month;
                option.textContent = `${monthName} (${results.monthlyProduction[month].toFixed(2)} MWh)`;
                monthSelect.appendChild(option);
            });
        }
        
        console.log('✅ Monthly selection oluşturuldu');
        
    } catch (error) {
        console.error('❌ createMonthlySelection hatası:', error);
    }
}

// Ay adını al
function getMonthName(monthKey) {
    const month = parseInt(monthKey.split('-')[1]);
    const monthNames = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return monthNames[month - 1];
}

// Aylık detayları göster
function showMonthlyDetails() {
    try {
        const monthSelect = document.getElementById('monthSelect');
        const monthlyDetails = document.getElementById('monthlyDetails');
        
        if (!monthSelect || !monthlyDetails) {
            console.warn('Monthly selection elementleri bulunamadı');
            return;
        }
        
        const selectedMonth = monthSelect.value;
        
        if (!selectedMonth || !analysisResults || !analysisResults.dailyProduction) {
            monthlyDetails.style.display = 'none';
            return;
        }
        
        // Seçilen ayın verilerini filtrele
        const monthlyData = filterMonthlyData(selectedMonth);
        
        // Detayları göster
        monthlyDetails.innerHTML = createMonthlyDetailsHTML(monthlyData, selectedMonth);
        monthlyDetails.style.display = 'block';
        
        // Günlük detay grafiğini oluştur
        createDailyDetailChart(monthlyData, selectedMonth);
        
        console.log('✅ Monthly details gösterildi:', selectedMonth);
        
    } catch (error) {
        console.error('❌ showMonthlyDetails hatası:', error);
    }
}

// Aylık verileri filtrele
function filterMonthlyData(selectedMonth) {
    const monthlyData = {
        dailyProduction: {},
        dailyRevenue: {},
        dailyPrices: {},
        epiasPrices: {}
    };
    
    Object.keys(analysisResults.dailyProduction).forEach(date => {
        if (date.startsWith(selectedMonth)) {
            monthlyData.dailyProduction[date] = analysisResults.dailyProduction[date];
            monthlyData.dailyRevenue[date] = analysisResults.dailyRevenue[date];
            monthlyData.dailyPrices[date] = analysisResults.dailyPrices[date];
        }
    });
    
    // EPİAŞ fiyat verilerini al
    const epiasMonthData = epiasPrices[selectedMonth];
    if (epiasMonthData && epiasMonthData.dailyPrices) {
        monthlyData.epiasPrices = epiasMonthData.dailyPrices;
    }
    
    return monthlyData;
}

// Depolamalı sistem gelir hesaplama fonksiyonu
function calculateStorageRevenue(date, production, prices) {
    // O günün saatlik üretim verilerini al
    const dailyProductionData = csvData.filter(row => row['Tarih'] === date);
    
    if (dailyProductionData.length === 0) {
        return production * 1200; // Varsayılan fiyat
    }
    
    // O günün kapasite faktörünü al (degradasyon)
    const dailyCapMWh = (capacitySchedule && capacitySchedule[date]) ? capacitySchedule[date] : nominalCapacity;
    const dailyCapFactor = dailyCapMWh / nominalCapacity;
    
    // O günün satılabilecek maksimum depolamalı üretim miktarını hesapla (kapasite faktörü ile sınırlı)
    const maxStorageProduction = Math.min(production, dailyCapMWh);
    
    // Debug: Günlük kapasite durumunu logla
    console.log(`🔋 ${date}: Günlük kapasite: ${dailyCapMWh.toFixed(3)} MWh (${(dailyCapFactor*100).toFixed(2)}%), Max depolamalı üretim: ${maxStorageProduction.toFixed(3)} MWh`);
    
    // 24 saatlik veri yapısı oluştur
    const hourlyData = {};
    for (let hour = 0; hour < 24; hour++) {
        hourlyData[hour] = {
            production: 0,
            price: getPriceForDateTime(date, hour.toString().padStart(2, '0')),
            normalRevenue: 0,
            storageProduction: 0,
            storageRevenue: 0,
            isStored: false,
            isDischarged: false
        };
    }
    
    // Gerçek üretim verilerini yerleştir
    dailyProductionData.forEach(row => {
        const hour = parseInt(row['Saat'].split(':')[0]);
        const production = parseFloat(row['Üretim (kWh)']) / 1000; // MWh'a çevir
        
        if (hourlyData[hour]) {
            // EPİAŞ fiyatı 0 ise bu üretimi dikkate alma
            if (hourlyData[hour].price === 0) {
                console.log(`⚠️ Depolamalı sistem: EPİAŞ fiyatı 0: ${date} ${hour}:00 - Üretim dikkate alınmıyor (${production} MWh)`);
                return; // Bu üretimi atla
            }
            
            hourlyData[hour].production = production;
            // Dağıtım bedelini düş
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh (1 TL = 10 kr, 1 MWh = 1000 kWh)
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            hourlyData[hour].normalRevenue = production * netPrice;
        }
    });
    
    // Depolamalı sistem stratejisi uygula
    let storedProduction = 0;
    
    // 1. O günün gerçek üretim saat aralığını belirle (dinamik)
    let productionStartHour = 24;
    let productionEndHour = -1;
    for (let hour = 0; hour < 24; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production > 0) {
            if (hour < productionStartHour) productionStartHour = hour;
            if (hour > productionEndHour) productionEndHour = hour;
        }
    }
    // Eğer üretim bulunamazsa varsayılan değerler kullan
    if (productionStartHour === 24) productionStartHour = 8;
    if (productionEndHour === -1) productionEndHour = 18;
    
    // 2. Depolama stratejisi: En düşük fiyatlı ve negatif gelirli saatleri depola
    const productionHours = [];
    for (let hour = productionStartHour; hour <= productionEndHour; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production > 0) {
            // Dağıtım bedelini düşerek net fiyatı hesapla
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            
            productionHours.push({
                hour: hour,
                price: hourlyData[hour].price,
                netPrice: netPrice,
                production: hourlyData[hour].production,
                revenue: hourlyData[hour].production * netPrice
            });
        }
    }
    
    // Önce negatif gelirli saatleri bul
    const negativeRevenueHours = productionHours.filter(h => h.revenue < 0);
    const positiveRevenueHours = productionHours.filter(h => h.revenue >= 0);
    
    // Depolama verimliliği sabiti (%7 dönüşüm kaybı)
    const STORAGE_EFFICIENCY = 0.93; // DC→AC→DC dönüşüm verimliliği
    
    // Tüm üretim saatlerini fiyata göre sırala (negatif gelirli önce, sonra en düşük fiyatlı)
    const allProductionHours = negativeRevenueHours.concat(positiveRevenueHours.sort((a, b) => a.price - b.price));
    
    // Günlük tam kapasite hedefini hesapla
    const targetCapacity = maxStorageProduction; // Günlük kapasite faktörü ile
    
    console.log(`🎯 ${date} - Hedef kapasite: ${targetCapacity.toFixed(3)} MWh, Toplam üretim saatleri: ${allProductionHours.length}, Kapasite faktörü: %${((targetCapacity/nominalCapacity)*100).toFixed(2)}`);
    
    // Kapasite tam dolana kadar saatleri seç (dinamik slot sayısı)
    let hoursToStore = [];
    let estimatedStoredCapacity = 0;
    
    for (const hourData of allProductionHours) {
        // Bu saati eklediğimizde kapasite dolacak mı?
        const efficientProduction = hourData.production * STORAGE_EFFICIENCY;
        
        if (estimatedStoredCapacity + efficientProduction <= targetCapacity) {
            // Tam sığıyor, ekle
            hoursToStore.push(hourData);
            estimatedStoredCapacity += efficientProduction;
            console.log(`✅ ${date} ${hourData.hour}:00 - Eklendi: Ham=${hourData.production.toFixed(3)} MWh → Verimli=${efficientProduction.toFixed(3)} MWh, Fiyat=${hourData.price.toFixed(2)} TL/MWh, Toplam: ${estimatedStoredCapacity.toFixed(3)}/${targetCapacity.toFixed(3)} MWh`);
        } else if (estimatedStoredCapacity < targetCapacity) {
            // Kısmi olarak sığıyor, kalan alanı doldurmak için ekle
            hoursToStore.push(hourData);
            const neededCapacity = targetCapacity - estimatedStoredCapacity;
            console.log(`⚡ ${date} ${hourData.hour}:00 - Kısmi eklendi: ${neededCapacity.toFixed(3)} MWh eksik, Ham=${hourData.production.toFixed(3)} MWh mevcut, Fiyat=${hourData.price.toFixed(2)} TL/MWh`);
            break; // Kapasite tam dolu
        } else {
            // Kapasite zaten dolu
            break;
        }
    }
    
    console.log(`📊 ${date} - Seçilen saatler: ${hoursToStore.length}, Tahmini depolanan: ${estimatedStoredCapacity.toFixed(3)}/${targetCapacity.toFixed(3)} MWh (%${((estimatedStoredCapacity/targetCapacity)*100).toFixed(1)} doluluk)`);
    
    // Depolama işlemini uygula (verimlilik kayıpları ve kapasiten limiti ile)
    let totalEnergyLoss = 0; // Toplam kayıp enerji (hiçbir yerde satılmaz)
    
    for (const hourData of hoursToStore) {
        const hour = hourData.hour;
        const rawProduction = hourData.production; // Ham üretim miktarı
        
        // Günlük kullanılabilir kapasite faktörü uygula
        const dayStr = date.replace(/\./g,'-');
        const isoDay = dayStr.split('-').reverse().join('-');
        const dailyLimit = maxStorageProduction; // Kapasite faktörü ile sınırlı maksimum depolamalı üretim
        
        // Depolama verimliliği ile gerçek depolanabilir miktarı hesapla
        const efficientProduction = rawProduction * STORAGE_EFFICIENCY;
        const energyLoss = rawProduction - efficientProduction; // Kayıp olan enerji
        
        // Depolama limitini kontrol et (maxStorageProduction ile sınırlı)
        if (storedProduction + efficientProduction <= maxStorageProduction) {
            // Limit aşılmıyorsa verimli miktarı depola
            storedProduction += efficientProduction;
            totalEnergyLoss += energyLoss;
            hourlyData[hour].isStored = true;
            hourlyData[hour].storageProduction = 0; // Depolanan üretim satılmaz
            hourlyData[hour].storageRevenue = 0;
            hourlyData[hour].energyLoss = energyLoss; // Kayıp enerjiyi takip et
            
            // Debug: Verimlilik kaybını logla
            console.log(`⚡ ${date} ${hour}:00 - Ham üretim: ${rawProduction.toFixed(3)} MWh, Depolanan: ${efficientProduction.toFixed(3)} MWh, Kayıp: ${energyLoss.toFixed(3)} MWh (%${((energyLoss/rawProduction)*100).toFixed(1)})`);
            
        } else {
            // Limit aşılacaksa, sadece kalan alanı doldur
            const remainingSpace = maxStorageProduction - storedProduction;
            if (remainingSpace > 0) {
                // Kalan alanı doldurmak için gereken ham üretim miktarını hesapla
                const requiredRawProduction = remainingSpace / STORAGE_EFFICIENCY;
                
                if (requiredRawProduction <= rawProduction) {
                    // Kalan alanı doldur
                    storedProduction = maxStorageProduction; // Tam dolu
                    const usedRawProduction = Math.min(requiredRawProduction, rawProduction);
                    const partialEnergyLoss = usedRawProduction - remainingSpace;
                    totalEnergyLoss += partialEnergyLoss;
                    
                    hourlyData[hour].isStored = true;
                    hourlyData[hour].storageProduction = 0;
                    hourlyData[hour].storageRevenue = 0;
                    hourlyData[hour].energyLoss = partialEnergyLoss;
                    
                    // Fazla üretim varsa satış yap
                    const excessProduction = rawProduction - usedRawProduction;
                    if (excessProduction > 0) {
                        hourlyData[hour].storageProduction = excessProduction;
                        const distributionFeePerMWh = currentDistributionFee * 10;
                        const netPrice = hourlyData[hour].price - distributionFeePerMWh;
                        hourlyData[hour].storageRevenue = excessProduction * netPrice;
                    }
                    
                    console.log(`⚡ ${date} ${hour}:00 - Depolama tamamlandı: ${remainingSpace.toFixed(3)} MWh, Kayıp: ${partialEnergyLoss.toFixed(3)} MWh, Fazla satış: ${(excessProduction || 0).toFixed(3)} MWh`);
                } else {
                    // Tüm üretimi depola ama yetmez
                    storedProduction += efficientProduction;
                    totalEnergyLoss += energyLoss;
                    hourlyData[hour].isStored = true;
                    hourlyData[hour].storageProduction = 0;
                    hourlyData[hour].storageRevenue = 0;
                    hourlyData[hour].energyLoss = energyLoss;
                    
                    console.log(`⚡ ${date} ${hour}:00 - Kısmi depolama: ${efficientProduction.toFixed(3)} MWh, Kayıp: ${energyLoss.toFixed(3)} MWh`);
                }
            } else {
                // Depolama dolu, tamamını doğrudan sat
                hourlyData[hour].storageProduction = rawProduction;
                const distributionFeePerMWh = currentDistributionFee * 10;
                const netPrice = hourlyData[hour].price - distributionFeePerMWh;
                hourlyData[hour].storageRevenue = rawProduction * netPrice;
                
                console.log(`💰 ${date} ${hour}:00 - Depolama dolu, doğrudan satış: ${rawProduction.toFixed(3)} MWh`);
            }
        }
    }
    

    
    // Toplam kayıp enerjisini logla
    console.log(`💥 ${date} - Toplam dönüşüm kayıpları: ${totalEnergyLoss.toFixed(3)} MWh (Hiçbir yerde satılmaz)`);
    console.log(`🔋 ${date} - Gerçek depolanan: ${storedProduction.toFixed(3)} MWh / ${maxStorageProduction.toFixed(3)} MWh (${((storedProduction/maxStorageProduction)*100).toFixed(1)}% dolu)`);
    
    // Kayıp enerji bilgisini global olarak sakla
    window.dailyEnergyLoss = totalEnergyLoss;
    
    // Depolanmayan üretim saatlerini doğrudan sat (dağıtım bedeli düşülerek)
    for (let hour = productionStartHour; hour <= productionEndHour; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production > 0 && !hourlyData[hour].isStored) {
            hourlyData[hour].storageProduction = hourlyData[hour].production;
            // Dağıtım bedelini düş
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            hourlyData[hour].storageRevenue = hourlyData[hour].production * netPrice;
        }
    }
    
    // 3. Yüksek fiyatlı saatlerde depolanan üretimi sat
    // Üretim olmayan saatlerin en yüksek fiyatlı olanını bul
    let bestDischargeHour = -1;
    let maxDischargePrice = -1;
    
    // Mevsimsel satış aralıklarını belirle
    const dateObj = new Date(date.split('.').reverse().join('-'));
    const month = dateObj.getMonth() + 1; // 1-12 arası ay
    
    let dischargeStartHour, dischargeEndHour;
    
    // Mevsimsel satış aralıklarını belirle
    if (month === 1) {
        // Ocak: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    } else if (month === 2) {
        // Şubat: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    } else if (month === 3) {
        // Mart: Üretim 17:00'da bitiyor, 18:00-23:00 arası satış
        dischargeStartHour = 18;
        dischargeEndHour = 23;
    } else if (month === 4) {
        // Nisan: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 5) {
        // Mayıs: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 6) {
        // Haziran: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 7) {
        // Temmuz: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 8) {
        // Ağustos: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 9) {
        // Eylül: Üretim 17:00'da bitiyor, 18:00-23:00 arası satış
        dischargeStartHour = 18;
        dischargeEndHour = 23;
    } else if (month === 10) {
        // Ekim: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    } else if (month === 11) {
        // Kasım: Üretim 15:00'da bitiyor, 16:00-23:00 arası satış
        dischargeStartHour = 16;
        dischargeEndHour = 23;
    } else if (month === 12) {
        // Aralık: Üretim 15:00'da bitiyor, 16:00-23:00 arası satış
        dischargeStartHour = 16;
        dischargeEndHour = 23;
    }
    
    // Deşarj saatlerinde en yüksek fiyatlı olanını bul
    for (let hour = dischargeStartHour; hour <= dischargeEndHour; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production === 0 && hourlyData[hour].price > maxDischargePrice) {
            maxDischargePrice = hourlyData[hour].price;
            bestDischargeHour = hour;
        }
    }
    
    // Depolanan üretimi sat
    if (storedProduction > 0 && bestDischargeHour !== -1) {
        // En yüksek fiyatlı üretim olmayan saatte sat
        hourlyData[bestDischargeHour].isDischarged = true;
        hourlyData[bestDischargeHour].storageProduction = storedProduction;
        // Dağıtım bedelini düş
        const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
        const netPrice = hourlyData[bestDischargeHour].price - distributionFeePerMWh;
        hourlyData[bestDischargeHour].storageRevenue = storedProduction * netPrice;
        
        // EFC degradasyonu uygula
        const dayStr = date.replace(/\./g,'-');
        const isoDay = dayStr.split('-').reverse().join('-'); // DD-MM-YYYY -> YYYY-MM-DD
        const dischargedMWh = storedProduction;
        applyEfcDegradation(isoDay, Math.max(0, dischargedMWh), dailyCapMWh);
        
        // Debug: Günlük kapasite durumunu logla (EFC uygulandıktan SONRA)
        const finalCapFactor = CapacityState.factorByDate[isoDay]; // EFC uygulandıktan sonraki faktör
        console.log(`📊 ${date}: Depolanan=${storedProduction.toFixed(3)} MWh, Satılan=${dischargedMWh.toFixed(3)} MWh, Kapasite=${dailyCapMWh.toFixed(3)} MWh (${(dailyCapFactor*100).toFixed(2)}%)`);
        
        storedProduction = 0; // Tüm depolanan üretim satıldı
    } else if (storedProduction > 0 && bestDischargeHour === -1) {
        // Eğer uygun deşarj saati bulunamazsa, mevsimsel aralığın ilk saatinde sat
        if (hourlyData[dischargeStartHour]) {
            hourlyData[dischargeStartHour].isDischarged = true;
            hourlyData[dischargeStartHour].storageProduction = storedProduction;
            // Dağıtım bedelini düş
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
            const netPrice = hourlyData[dischargeStartHour].price - distributionFeePerMWh;
            hourlyData[dischargeStartHour].storageRevenue = storedProduction * netPrice;
            
            // EFC degradasyonu uygula
            const dayStr = date.replace(/\./g,'-');
            const isoDay = dayStr.split('-').reverse().join('-');
            const dischargedMWh = storedProduction;
            applyEfcDegradation(isoDay, Math.max(0, dischargedMWh), dailyCapMWh);
            
            storedProduction = 0;
        }
    }
    
    // Toplam depolamalı geliri hesapla
    const totalStorageRevenue = Object.values(hourlyData).reduce((sum, hour) => {
        return sum + hour.storageRevenue;
    }, 0);
    
    // Saatlik veriyi global olarak sakla (showDailyDetails için)
    window.hourlyStorageData = hourlyData;
    
    return totalStorageRevenue;
}

// Detaylı saatlik veri oluştur (normal ve depolamalı sistem için)
function generateDetailedHourlyData(date) {
    const dailyProductionData = csvData.filter(row => row['Tarih'] === date);
    
    // 24 saatlik veri yapısı oluştur
    const hourlyData = {};
    for (let hour = 0; hour < 24; hour++) {
        const hourStr = hour.toString().padStart(2, '0');
        hourlyData[hour] = {
            hour: hourStr,
            production: 0,
            price: getPriceForDateTime(date, hourStr),
            normalRevenue: 0,
            storageProduction: 0,
            storageRevenue: 0,
            isStored: false,
            isDischarged: false
        };
    }
    
    // Gerçek üretim verilerini yerleştir
    dailyProductionData.forEach(row => {
        const hour = parseInt(row['Saat'].split(':')[0]);
        const production = parseFloat(row['Üretim (kWh)']) / 1000; // MWh'a çevir
        
        if (hourlyData[hour]) {
            // EPİAŞ fiyatı 0 ise bu üretimi dikkate alma
            if (hourlyData[hour].price === 0) {
                console.log(`⚠️ Detaylı veri: EPİAŞ fiyatı 0: ${date} ${hour}:00 - Üretim dikkate alınmıyor (${production} MWh)`);
                return; // Bu üretimi atla
            }
            
            hourlyData[hour].production = production;
            // Dağıtım bedelini düş
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh (1 TL = 10 kr, 1 MWh = 1000 kWh)
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            hourlyData[hour].normalRevenue = production * netPrice;
        }
    });
    
    // O günün toplam üretimini hesapla
    const production = dailyProductionData.reduce((sum, row) => {
        const hour = parseInt(row['Saat'].split(':')[0]);
        const hourData = hourlyData[hour];
        if (hourData && hourData.price > 0) { // EPİAŞ fiyatı 0 olmayan saatler
            return sum + (parseFloat(row['Üretim (kWh)']) / 1000);
        }
        return sum;
    }, 0);
    
    // 1. O günün gerçek üretim saat aralığını belirle (dinamik)
    let productionStartHour = 24;
    let productionEndHour = -1;
    for (let hour = 0; hour < 24; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production > 0) {
            if (hour < productionStartHour) productionStartHour = hour;
            if (hour > productionEndHour) productionEndHour = hour;
        }
    }
    // Eğer üretim bulunamazsa varsayılan değerler kullan
    if (productionStartHour === 24) productionStartHour = 8;
    if (productionEndHour === -1) productionEndHour = 18;
    // 2. Depolama stratejisi: En düşük fiyatlı ve negatif gelirli saatleri depola
    const productionHours = [];
    for (let hour = productionStartHour; hour <= productionEndHour; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production > 0) {
            // Dağıtım bedelini düşerek net fiyatı hesapla
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            
            productionHours.push({
                hour: hour,
                price: hourlyData[hour].price,
                netPrice: netPrice,
                production: hourlyData[hour].production,
                revenue: hourlyData[hour].production * netPrice
            });
        }
    }
    
    // Önce negatif gelirli saatleri bul
    const negativeRevenueHours = productionHours.filter(h => h.revenue < 0);
    const positiveRevenueHours = productionHours.filter(h => h.revenue >= 0);
    
    // Depolama verimliliği sabiti (%7 dönüşüm kaybı)
    const STORAGE_EFFICIENCY = 0.93; // DC→AC→DC dönüşüm verimliliği
    
    // Günlük kapasite faktörünü al (capacitySchedule'dan)
    const dayStr = date.replace(/\./g,'-');
    const isoDay = dayStr.split('-').reverse().join('-');
    
    // Global capacitySchedule değişkenine erişim sağla
    const globalCapacitySchedule = window.capacitySchedule || capacitySchedule;
    const globalNominalCapacity = window.nominalCapacity || nominalCapacity;
    
    // Tarih formatını capacitySchedule anahtarları ile uyumlu hale getir
    const capacityScheduleKey = date.replace(/\./g, '-'); // 31.12.1990 -> 31-12-1990
    
    const dailyCapMWh = (globalCapacitySchedule && globalCapacitySchedule[capacityScheduleKey]) ? globalCapacitySchedule[capacityScheduleKey] : globalNominalCapacity;
    const dailyStorageLimit = Math.min(production, dailyCapMWh); // Kapasite faktörü ile sınırlı
    
    // Tüm üretim saatlerini fiyata göre sırala (negatif gelirli önce, sonra en düşük fiyatlı)
    const allProductionHours = negativeRevenueHours.concat(positiveRevenueHours.sort((a, b) => a.price - b.price));
    
    // Günlük tam kapasite hedefini hesapla
    const targetCapacity = dailyStorageLimit; // Kapasite faktörü ile
    
    console.log(`🎯 [TABLO] ${date} - Hedef kapasite: ${targetCapacity.toFixed(3)} MWh, Toplam üretim saatleri: ${allProductionHours.length}`);
    
    // Kapasite tam dolana kadar saatleri seç (dinamik slot sayısı)
    let hoursToStore = [];
    let estimatedStoredCapacity = 0;
    
    for (const hourData of allProductionHours) {
        // Bu saati eklediğimizde kapasite dolacak mı?
        const efficientProduction = hourData.production * STORAGE_EFFICIENCY;
        
        if (estimatedStoredCapacity + efficientProduction <= targetCapacity) {
            // Tam sığıyor, ekle
            hoursToStore.push(hourData);
            estimatedStoredCapacity += efficientProduction;
            console.log(`✅ [TABLO] ${date} ${hourData.hour}:00 - Eklendi: Ham=${hourData.production.toFixed(3)} MWh → Verimli=${efficientProduction.toFixed(3)} MWh, Toplam: ${estimatedStoredCapacity.toFixed(3)}/${targetCapacity.toFixed(3)} MWh`);
        } else if (estimatedStoredCapacity < targetCapacity) {
            // Kısmi olarak sığıyor, kalan alanı doldurmak için ekle
            hoursToStore.push(hourData);
            const neededCapacity = targetCapacity - estimatedStoredCapacity;
            console.log(`⚡ [TABLO] ${date} ${hourData.hour}:00 - Kısmi eklendi: ${neededCapacity.toFixed(3)} MWh eksik, Ham=${hourData.production.toFixed(3)} MWh mevcut`);
            break; // Kapasite tam dolu
        } else {
            // Kapasite zaten dolu
            break;
        }
    }
    
    console.log(`📊 [TABLO] ${date} - Seçilen saatler: ${hoursToStore.length}, Tahmini depolanan: ${estimatedStoredCapacity.toFixed(3)}/${targetCapacity.toFixed(3)} MWh`);
    
    // Debug: Tarih formatını kontrol et
    console.log(`🔍 [TABLO] Tarih format kontrolü:`, {
        originalDate: date,
        dayStr: dayStr,
        isoDay: isoDay,
        capacityScheduleKey: capacityScheduleKey,
        capacityScheduleValue: globalCapacitySchedule ? globalCapacitySchedule[capacityScheduleKey] : 'YOK'
    });
    
    // Debug: Kapasite durumunu logla
    console.log(`🔍 [TABLO] generateDetailedHourlyData ${date}:`, {
        isoDay,
        dailyCapMWh,
        production,
        dailyStorageLimit,
        globalCapacityScheduleExists: !!globalCapacitySchedule,
        globalCapacityScheduleKeys: globalCapacitySchedule ? Object.keys(globalCapacitySchedule) : [],
        capacityScheduleExists: !!capacitySchedule,
        capacityScheduleKeys: capacitySchedule ? Object.keys(capacitySchedule) : []
    });
    
    // Depolama işlemini uygula (verimlilik kayıpları ve kapasiten limiti ile)
    let totalEnergyLoss = 0; // Toplam kayıp enerji (hiçbir yerde satılmaz)
    let storedProduction = 0; // Depolanan üretim miktarı
    
    for (const hourData of hoursToStore) {
        const hour = hourData.hour;
        const rawProduction = hourData.production; // Ham üretim miktarı
        
        // Depolama verimliliği ile gerçek depolanabilir miktarı hesapla
        const efficientProduction = rawProduction * STORAGE_EFFICIENCY;
        const energyLoss = rawProduction - efficientProduction; // Kayıp olan enerji
        
        // Depolama limitini kontrol et (dailyStorageLimit ile sınırlı)
        if (storedProduction + efficientProduction <= dailyStorageLimit) {
            // Limit aşılmıyorsa verimli miktarı depola
            storedProduction += efficientProduction;
            totalEnergyLoss += energyLoss;
            hourlyData[hour].isStored = true;
            hourlyData[hour].storageProduction = 0; // Depolanan üretim satılmaz
            hourlyData[hour].storageRevenue = 0;
            hourlyData[hour].energyLoss = energyLoss; // Kayıp enerjiyi takip et
            
            console.log(`⚡ [TABLO] ${date} ${hour}:00 - Ham üretim: ${rawProduction.toFixed(3)} MWh, Depolanan: ${efficientProduction.toFixed(3)} MWh, Kayıp: ${energyLoss.toFixed(3)} MWh`);
            
        } else {
            // Limit aşılacaksa, sadece kalan alanı doldur
            const remainingSpace = dailyStorageLimit - storedProduction;
            if (remainingSpace > 0) {
                // Kalan alanı doldurmak için gereken ham üretim miktarını hesapla
                const requiredRawProduction = remainingSpace / STORAGE_EFFICIENCY;
                
                if (requiredRawProduction <= rawProduction) {
                    // Kalan alanı doldur
                    storedProduction = dailyStorageLimit; // Tam dolu
                    const usedRawProduction = Math.min(requiredRawProduction, rawProduction);
                    const partialEnergyLoss = usedRawProduction - remainingSpace;
                    totalEnergyLoss += partialEnergyLoss;
                    
                    hourlyData[hour].isStored = true;
                    hourlyData[hour].energyLoss = partialEnergyLoss;
                    
                    // Fazla üretim varsa satış yap
                    const excessProduction = rawProduction - usedRawProduction;
                    if (excessProduction > 0) {
                        hourlyData[hour].storageProduction = excessProduction;
                        const distributionFeePerMWh = currentDistributionFee * 10;
                        const netPrice = hourlyData[hour].price - distributionFeePerMWh;
                        hourlyData[hour].storageRevenue = excessProduction * netPrice;
                    }
                    
                    console.log(`⚡ [TABLO] ${date} ${hour}:00 - Depolama tamamlandı: ${remainingSpace.toFixed(3)} MWh, Fazla satış: ${(excessProduction || 0).toFixed(3)} MWh`);
                } else {
                    // Tüm üretimi depola ama yetmez
                    storedProduction += efficientProduction;
                    totalEnergyLoss += energyLoss;
                    hourlyData[hour].isStored = true;
                    hourlyData[hour].storageProduction = 0;
                    hourlyData[hour].storageRevenue = 0;
                    hourlyData[hour].energyLoss = energyLoss;
                    
                    console.log(`⚡ [TABLO] ${date} ${hour}:00 - Kısmi depolama: ${efficientProduction.toFixed(3)} MWh, Kayıp: ${energyLoss.toFixed(3)} MWh`);
                }
            } else {
                // Depolama dolu, tamamını doğrudan sat
                hourlyData[hour].storageProduction = rawProduction;
                const distributionFeePerMWh = currentDistributionFee * 10;
                const netPrice = hourlyData[hour].price - distributionFeePerMWh;
                hourlyData[hour].storageRevenue = rawProduction * netPrice;
                
                console.log(`💰 [TABLO] ${date} ${hour}:00 - Depolama dolu, doğrudan satış: ${rawProduction.toFixed(3)} MWh`);
            }
        }
    }
    
    // Toplam kayıp enerjisini logla
    console.log(`💥 [TABLO] ${date} - Toplam dönüşüm kayıpları: ${totalEnergyLoss.toFixed(3)} MWh`);
    console.log(`🔋 [TABLO] ${date} - Gerçek depolanan: ${storedProduction.toFixed(3)} MWh / ${dailyStorageLimit.toFixed(3)} MWh (${((storedProduction/dailyStorageLimit)*100).toFixed(1)}% dolu)`);
    
    // Kayıp enerji bilgisini global olarak sakla
    window.dailyEnergyLoss = totalEnergyLoss;
    
    // Depolanmayan üretim saatlerini doğrudan sat (dağıtım bedeli düşülerek)
    for (let hour = productionStartHour; hour <= productionEndHour; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production > 0 && !hourlyData[hour].isStored) {
            hourlyData[hour].storageProduction = hourlyData[hour].production;
            // Dağıtım bedelini düş
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            hourlyData[hour].storageRevenue = hourlyData[hour].production * netPrice;
        }
    }
    
    // 2. Yüksek fiyatlı saatlerde depolanan üretimi sat (19:00-23:00)
    // Üretim olmayan saatlerin en yüksek fiyatlı olanını bul
    let bestDischargeHour = -1;
    let maxDischargePrice = -1;
    
    // Mevsimsel satış aralıklarını belirle
    const dateObj = new Date(date.split('.').reverse().join('-'));
    const month = dateObj.getMonth() + 1; // 1-12 arası ay
    
    let dischargeStartHour, dischargeEndHour;
    
    // Mevsimsel satış aralıklarını belirle
    if (month === 1) {
        // Ocak: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    } else if (month === 2) {
        // Şubat: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    } else if (month === 3) {
        // Mart: Üretim 17:00'da bitiyor, 18:00-23:00 arası satış
        dischargeStartHour = 18;
        dischargeEndHour = 23;
    } else if (month === 4) {
        // Nisan: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 5) {
        // Mayıs: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 6) {
        // Haziran: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 7) {
        // Temmuz: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 8) {
        // Ağustos: Üretim 18:00'da bitiyor, 19:00-23:00 arası satış
        dischargeStartHour = 19;
        dischargeEndHour = 23;
    } else if (month === 9) {
        // Eylül: Üretim 17:00'da bitiyor, 18:00-23:00 arası satış
        dischargeStartHour = 18;
        dischargeEndHour = 23;
    } else if (month === 10) {
        // Ekim: Üretim 17:00'da bitiyor, 18:00-23:00 arası satış
        dischargeStartHour = 18;
        dischargeEndHour = 23;
    } else if (month === 11) {
        // Kasım: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    } else if (month === 12) {
        // Aralık: Üretim 16:00'da bitiyor, 17:00-23:00 arası satış
        dischargeStartHour = 17;
        dischargeEndHour = 23;
    }
    
    console.log(`${date} tarihi (${month}. ay) için satış aralığı: ${dischargeStartHour}:00 - ${dischargeEndHour}:00`);
    
    // Belirlenen aralıkta en yüksek fiyatlı saati bul
    for (let hour = dischargeStartHour; hour <= dischargeEndHour; hour++) {
        if (hourlyData[hour] && hourlyData[hour].production === 0) { // Üretim olmayan saat
            const price = hourlyData[hour].price;
            if (price > maxDischargePrice) {
                maxDischargePrice = price;
                bestDischargeHour = hour;
            }
        }
    }
    
    // Depolanan üretimi sat (şebeke deşarj limiti ile)
    // Depolama limitini aşan kısmı kaldır
    const actualStoredProduction = Math.min(storedProduction, dailyStorageLimit);
    
    if (actualStoredProduction > 0) {
        let remainingStoredProduction = actualStoredProduction;
        
        // En yüksek fiyatlı saatleri bul (birden fazla saat gerekebilir)
        const dischargeHours = [];
        for (let hour = dischargeStartHour; hour <= dischargeEndHour; hour++) {
            if (hourlyData[hour] && hourlyData[hour].production === 0) {
                dischargeHours.push({
                    hour: hour,
                    price: hourlyData[hour].price
                });
            }
        }
        
        // Fiyata göre sırala (en yüksekten en düşüğe)
        dischargeHours.sort((a, b) => b.price - a.price);
        
        // Her saat için şebeke deşarj limitini uygula (kapasite faktörü ile)
        const dayStrForDetail = date.replace(/\./g,'-');
        const isoDayForDetail = dayStrForDetail.split('-').reverse().join('-');
        
        // Global capacitySchedule değişkenine erişim sağla
        const globalCapacityScheduleForDetail = window.capacitySchedule || capacitySchedule;
        const globalNominalCapacityForDetail = window.nominalCapacity || nominalCapacity;
        
        // Debug: Tarih formatını kontrol et (deşarj kısmı)
        console.log(`🔍 Deşarj tarih format kontrolü:`, {
            originalDate: date,
            isoDayForDetail: isoDayForDetail,
            capacityScheduleKey: '1990-12-31',
            capacityScheduleValue: globalCapacityScheduleForDetail ? globalCapacityScheduleForDetail['1990-12-31'] : 'YOK'
        });
        
        // Tarih formatını capacitySchedule anahtarları ile uyumlu hale getir
        const capacityScheduleKeyForDetail = date.replace(/\./g, '-'); // 31.12.1990 -> 31-12-1990
        const dailyCapMWhForDetail = (globalCapacityScheduleForDetail && globalCapacityScheduleForDetail[capacityScheduleKeyForDetail]) ? globalCapacityScheduleForDetail[capacityScheduleKeyForDetail] : globalNominalCapacityForDetail;
        const dailyGridLimitForDetail = currentGridDischargeLimit * (dailyCapMWhForDetail / globalNominalCapacityForDetail);
        
        for (const dischargeHour of dischargeHours) {
            if (remainingStoredProduction <= 0) break;
            
            const hour = dischargeHour.hour;
            const dischargeAmount = Math.min(remainingStoredProduction, dailyGridLimitForDetail);
            
            hourlyData[hour].isDischarged = true;
            hourlyData[hour].storageProduction = dischargeAmount;
            
            // Dağıtım bedelini düş
            const distributionFeePerMWh = currentDistributionFee * 10; // kr/kWh -> TL/MWh
            const netPrice = hourlyData[hour].price - distributionFeePerMWh;
            hourlyData[hour].storageRevenue = dischargeAmount * netPrice;
            
            remainingStoredProduction -= dischargeAmount;
        }
        
        storedProduction = 0; // Tüm depolanan üretim satıldı
    }
    
    return hourlyData;
}

// Aylık detay HTML'i oluştur
function createMonthlyDetailsHTML(monthlyData, selectedMonth) {
    try {
        const monthName = getMonthName(selectedMonth);
        const dates = Object.keys(monthlyData.dailyProduction).sort();
        
        let html = `
            <div class="row">
                <div class="col-12">
                    <h6 class="text-white mb-3">
                        <i class="fas fa-calendar-day me-2"></i>
                        ${monthName} 1990 - Günlük Detay Analizi
                    </h6>
                    <div class="table-responsive">
                        <table class="table table-dark table-hover">
                            <thead>
                                <tr>
                                    <th><i class="fas fa-calendar me-1"></i>Tarih</th>
                                    <th><i class="fas fa-bolt me-1"></i>Üretim (MWh)</th>
                                    <th><i class="fas fa-money-bill me-1"></i>EPİAŞ Fiyatı (TL/MWh)</th>
                                    <th><i class="fas fa-chart-line me-1"></i>Günlük Gelir (TL)</th>
                                    <th><i class="fas fa-battery-three-quarters me-1"></i>Depolamalı Sistem ile Gelir (TL)</th>
                                    <th><i class="fas fa-battery-half me-1"></i>Batarya Kapasite Faktörü (%)</th>
                                    <th><i class="fas fa-eye me-1"></i>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
    
    let cumulativeRevenue = 0;
    let cumulativeStorageRevenue = 0;
    dates.forEach(date => {
        const production = monthlyData.dailyProduction[date] / 1000; // kWh -> MWh
        const prices = monthlyData.dailyPrices[date] || [];
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 1000;
        const dailyRevenue = monthlyData.dailyRevenue[date] || 0;
        
        // Depolamalı sistem gelirini hesapla
        const storageRevenue = calculateStorageRevenue(date, production, prices);
        
        cumulativeRevenue += dailyRevenue;
        cumulativeStorageRevenue += storageRevenue;
        
        const day = date.substring(8, 10);
        const month = date.substring(5, 7);
        
        // Depolama sistemi kapasite faktörünü hesapla (günlük mevcut kapasite / nominal kapasite)
        const dailyCapMWh = (capacitySchedule && capacitySchedule[date]) ? capacitySchedule[date] : nominalCapacity;
        const capacityPercent = ((dailyCapMWh / nominalCapacity) * 100).toFixed(2);
        const capacityColor = App.Battery.getCapacityColor(parseFloat(capacityPercent));
        
        // O günün satılabilecek depolamalı üretim miktarını hesapla (kapasite faktörü ile orantılı)
        const maxStorageProduction = Math.min(production, dailyCapMWh);
        
        // Debug: 31.12.1990 için özel log
        if (date === '1990-12-31') {
            console.log('🔍 31.12.1990 Debug:', {
                date, dailyCapMWh, nominalCapacity, production, maxStorageProduction,
                capacityPercent: capacityPercent + '%',
                scheduleExists: !!capacitySchedule,
                scheduleKeys: Object.keys(capacitySchedule || {}).length
            });
        }
        
        html += `
            <tr>
                <td><strong>${day}.${month}.1990</strong></td>
                <td>${production.toFixed(2)}</td>
                <td>${avgPrice.toFixed(2)} (${prices.length} saat)</td>
                <td>${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dailyRevenue)}</td>
                <td>${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(storageRevenue)}</td>
                <td><span class="badge" style="background-color: ${capacityColor}; color: white; font-weight: bold;">${capacityPercent}%</span></td>
                <td>
                    <button class="btn btn-sm" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.7)); color: #ffffff; border: none; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);" onclick="showDailyDetails('${date}')">
                        <i class="fas fa-eye"></i> Saatlik
                    </button>
                </td>
            </tr>
        `;
    });
    
    // Toplam satırı ekle
    html += `
            <tr style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.15)); border-top: 2px solid #60A5FA;">
                <td><strong style="color: #60A5FA; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">TOPLAM</strong></td>
                <td><strong style="color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">${(Object.values(monthlyData.dailyProduction).reduce((a, b) => a + b, 0) / 1000).toFixed(2)}</strong></td>
                <td><strong style="color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">-</strong></td>
                <td><strong style="color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cumulativeRevenue)}</strong></td>
                <td><strong style="color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cumulativeStorageRevenue)}</strong></td>
                <td><strong style="color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">-</strong></td>
                <td><strong style="color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">Fark: ${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cumulativeStorageRevenue - cumulativeRevenue)} TL</strong></td>
            </tr>
        `;
    
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Batarya Kapasite Faktörü:</strong> Bu değer, her gün için mevcut batarya kapasitesinin (MWh) nominal kapasiteye (10 MWh) oranını gösterir. Günlük tutma oranı (%99.9617) nedeniyle her geçen gün kapasite azalır. %100 = ilk gün, %99.96 = ikinci gün, vb. <strong>O günün satılabilecek depolamalı üretim miktarı da bu kapasite faktörü ile orantılı olarak hesaplanır.</strong>
                </div>
                <div class="alert alert-warning mt-2">
                    <h6><i class="fas fa-exclamation-triangle me-2"></i>Dönüşüm Verimliliği Kayıpları:</h6>
                    <ul class="mb-0">
                        <li><strong>⚡ DC↔AC Dönüşüm Kaybı:</strong> Depolamaya aktarılan enerjide %7 verimlilik kaybı uygulanır</li>
                        <li><strong>📉 Kayıp Hesaplaması:</strong> Örnek: 10 MWh üretim → 9.3 MWh depolanır, 0.7 MWh kaybolur</li>
                        <li><strong>💔 Kayıp Enerji:</strong> Dönüşüm sırasında kaybolan enerji hiçbir yerde satış geliri oluşturmaz</li>
                        <li><strong>🔧 Teknik Neden:</strong> AC→DC (şarj) ve DC→AC (deşarj) inverter dönüşüm kayıpları</li>
                        <li><strong>📊 Gerçekçi Yaklaşım:</strong> Endüstri standardı %93 round-trip verimliliği</li>
                    </ul>
                </div>
                <div class="chart-container" style="height: 400px;">
                    <canvas id="dailyDetailChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    return html;
    
    } catch (error) {
        console.error('❌ createMonthlyDetailsHTML hatası:', error);
        return '<div class="alert alert-danger">Aylık detaylar oluşturulurken hata oluştu.</div>';
    }
}

// Günlük saatlik detayları göster
function showDailyDetails(date) {
    const day = date.substring(8, 10);
    const month = date.substring(5, 7);
    const year = date.substring(0, 4);
    
    // Detaylı saatlik veriyi oluştur
    const hourlyData = generateDetailedHourlyData(date);
    
    let detailHtml = `
        <div class="modal fade" id="dailyDetailModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content" style="background-color: white !important;">
                    <div class="modal-header" style="background-color: white !important;">
                        <h5 class="modal-title">${day}.${month}.${year} - Saatlik Detaylar (Normal vs Depolamalı Sistem)</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="background-color: white !important;">
                        <div class="table-responsive">
                            <table class="table table-sm table-bordered" style="background-color: white !important; color: black !important;">
                                <thead style="background-color: #f8f9fa; color: black;">
                                    <tr>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Saat</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">EPİAŞ Fiyatı (TL/MWh)</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Normal Üretim (MWh)</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Normal Gelir (TL)</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Normal Durum</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Depolamalı Üretim (MWh)</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Depolamalı Gelir (TL)</th>
                                        <th class="text-center" style="color: black; border: 1px solid #dee2e6; font-weight: bold;">Depolamalı Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
    `;
    
    let totalNormalRevenue = 0;
    let totalStorageRevenue = 0;
    
    // 24 saatlik veriyi göster (00:00-23:00)
    for (let hour = 0; hour < 24; hour++) {
        const hourData = hourlyData[hour];
        const hourStr = hour.toString().padStart(2, '0');
        
        totalNormalRevenue += hourData.normalRevenue;
        totalStorageRevenue += hourData.storageRevenue;
        
        // Durum belirleme
        let normalStatus = '';
        let storageStatus = '';
        
        if (hourData.production > 0) {
            normalStatus = 'Üretim + Satış';
        } else {
            normalStatus = 'Üretim Yok';
        }
        
        if (hourData.isStored) {
            storageStatus = 'Depolama';
        } else if (hourData.isDischarged) {
            storageStatus = 'Depolamadan Satış';
        } else if (hourData.storageProduction > 0) {
            storageStatus = 'Doğrudan Satış';
        } else {
            storageStatus = 'Üretim Yok';
        }
        
        // Renk kodlaması
        let normalRowClass = '';
        let storageRowClass = '';
        let storageRowStyle = '';
        
        if (hourData.isStored) {
            storageRowClass = 'table-warning'; // Depolama - sarı
            storageRowStyle = 'background-color: #ffeb3b !important; color: #000 !important;'; // Sarı arka plan
        } else if (hourData.isDischarged) {
            storageRowClass = 'table-success'; // Depolamadan satış - yeşil
            storageRowStyle = 'background-color: #4caf50 !important; color: #fff !important;'; // Yeşil arka plan
        }
        
        detailHtml += `
            <tr class="${normalRowClass}" style="background-color: white !important; color: #212529 !important;">
                <td class="text-center" style="background-color: white !important; color: #212529 !important; border: 1px solid #dee2e6;"><strong>${hourStr}:00</strong></td>
                <td class="text-center" style="background-color: white !important; color: #212529 !important; border: 1px solid #dee2e6;">${hourData.price.toFixed(2)}</td>
                <td class="text-center" style="background-color: white !important; color: #212529 !important; border: 1px solid #dee2e6;">${hourData.production.toFixed(3)}</td>
                <td class="text-center" style="background-color: white !important; color: #212529 !important; border: 1px solid #dee2e6;">${hourData.normalRevenue.toFixed(2)}</td>
                <td class="text-center" style="background-color: white !important; color: #212529 !important; border: 1px solid #dee2e6;"><small>${normalStatus}</small></td>
                <td class="text-center ${storageRowClass}" style="${storageRowStyle} border: 1px solid #dee2e6 !important;">${hourData.storageProduction.toFixed(3)}</td>
                <td class="text-center ${storageRowClass}" style="${storageRowStyle} border: 1px solid #dee2e6 !important;">${hourData.storageRevenue.toFixed(2)}</td>
                <td class="text-center ${storageRowClass}" style="${storageRowStyle} border: 1px solid #dee2e6 !important;"><small>${storageStatus}</small></td>
            </tr>
        `;
    }
    
    // Toplam satırı
    detailHtml += `
                                </tbody>
                                <tfoot style="background-color: #cce7ff; color: #004085;">
                                    <tr>
                                        <th colspan="3" class="text-center" style="color: #004085;">TOPLAM</th>
                                        <th class="text-center" style="color: #004085;">${totalNormalRevenue.toFixed(2)} TL</th>
                                        <th style="color: #004085;"></th>
                                        <th class="text-center" style="color: #004085;">${totalStorageRevenue.toFixed(2)} TL</th>
                                        <th style="color: #004085;"></th>
                                    </tr>
                                    <tr>
                                        <th colspan="3" class="text-center" style="color: #004085;">FARK</th>
                                        <th colspan="2" class="text-center" style="color: #004085;">${(totalStorageRevenue - totalNormalRevenue).toFixed(2)} TL</th>
                                        <th colspan="2" class="text-center" style="color: #004085;">%${totalNormalRevenue > 0 ? ((totalStorageRevenue - totalNormalRevenue) / totalNormalRevenue * 100).toFixed(1) : totalNormalRevenue < 0 ? ((totalStorageRevenue - totalNormalRevenue) / Math.abs(totalNormalRevenue) * 100).toFixed(1) : '0.0'}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <div class="alert alert-info">
                                    <h6>Renk Açıklaması:</h6>
                                    <ul class="mb-0">
                                        <li><span class="badge bg-warning" style="background-color: #ffeb3b !important; color: #000 !important;">Sarı</span> = Depolama sistemine giden değerler</li>
                                        <li><span class="badge bg-success" style="background-color: #4caf50 !important; color: #fff !important;">Yeşil</span> = Depolamadan Satış</li>
                                        <li><span class="badge bg-secondary">Beyaz</span> = Normal satış</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="alert alert-warning">
                                    <h6>Depolamalı Sistem Stratejisi:</h6>
                                    <ul class="mb-0">
                                        <li><strong>Şarj:</strong> En düşük 2 Epiaş fiyatına sahip üretim saatlerinde depolama</li>
                                        <li><strong>Deşarj:</strong> Mevsimsel satış aralıklarında en yüksek fiyatlı saatte satış</li>
                                        <li><strong>Mevsimsel Aralıklar:</strong></li>
                                        <li style="margin-left: 15px;">• Kış (Ocak-Şubat, Kasım-Aralık): 17:00-23:00</li>
                                        <li style="margin-left: 15px;">• İlkbahar/Sonbahar (Mart, Eylül-Ekim): 18:00-23:00</li>
                                        <li style="margin-left: 15px;">• Yaz (Nisan-Ağustos): 19:00-23:00</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eski modal varsa kaldır
    const existingModal = document.getElementById('dailyDetailModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Yeni modal ekle ve göster
    document.body.insertAdjacentHTML('beforeend', detailHtml);
    
    // Modal'ı güvenli şekilde göster
    const modalElement = document.getElementById('dailyDetailModal');
    if (modalElement && typeof bootstrap !== 'undefined') {
        try {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        } catch (error) {
            console.error('Modal gösterme hatası:', error);
            // Fallback: Modal'ı manuel olarak göster
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
        }
    } else {
        console.warn('Modal elementi bulunamadı veya Bootstrap yüklenmedi');
    }
}

// Günlük detay grafiği oluştur
function createDailyDetailChart(monthlyData, selectedMonth) {
    const dates = Object.keys(monthlyData.dailyProduction).sort();
    const monthName = getMonthName(selectedMonth);
    
    // Mevcut grafiği temizle
    const existingChart = Chart.getChart('dailyDetailChart');
    if (existingChart) {
        existingChart.destroy();
    }
    
    const ctx = document.getElementById('dailyDetailChart').getContext('2d');
    
    const labels = dates.map(date => {
        const day = date.substring(8, 10);
        const month = date.substring(5, 7);
        return `${day}.${month}`;
    });
    
    const productionData = dates.map(date => monthlyData.dailyProduction[date] / 1000);
    const revenueData = dates.map(date => monthlyData.dailyRevenue[date]);
    const storageRevenueData = dates.map(date => {
        const production = monthlyData.dailyProduction[date] / 1000;
        const prices = monthlyData.dailyPrices[date] || [];
        return calculateStorageRevenue(date, production, prices);
    });
    const priceData = dates.map(date => {
        const avgPrice = monthlyData.dailyRevenue[date] / (monthlyData.dailyProduction[date] / 1000);
        return avgPrice;
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Günlük Üretim (MWh)',
                    data: productionData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y',
                    tension: 0.3
                },
                {
                    label: 'Normal Gelir (TL)',
                    data: revenueData,
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1',
                    tension: 0.3
                },
                {
                    label: 'Depolamalı Sistem Gelir (TL)',
                    data: storageRevenueData,
                    borderColor: '#FFA500',
                    backgroundColor: 'rgba(255, 165, 0, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1',
                    tension: 0.3
                },
                {
                    label: 'EPİAŞ Fiyat (TL/MWh)',
                    data: priceData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y2',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            backgroundColor: 'white',
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: `${monthName} 1990 - Günlük Üretim ve Gelir Analizi (Depolamalı Sistem)`
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Günlük Üretim (MWh)') {
                                return `Üretim: ${context.parsed.y.toFixed(2)} MWh`;
                            } else if (context.dataset.label === 'Normal Gelir (TL)') {
                                return `Normal Gelir: ${context.parsed.y.toFixed(2)} TL`;
                            } else if (context.dataset.label === 'Depolamalı Sistem Gelir (TL)') {
                                return `Depolamalı Gelir: ${context.parsed.y.toFixed(2)} TL`;
                            } else {
                                return `Fiyat: ${context.parsed.y.toFixed(2)} TL/MWh`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    backgroundColor: 'white',
                    title: {
                        display: true,
                        text: 'Üretim (MWh)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    backgroundColor: 'white',
                    title: {
                        display: true,
                        text: 'Gelir (TL)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    backgroundColor: 'white',
                    title: {
                        display: true,
                        text: 'Fiyat (TL/MWh)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                x: {
                    backgroundColor: 'white',
                    title: {
                        display: true,
                        text: 'Gün'
                    }
                }
            }
        }
    });
} 

// Gerçek zamanlı batarya tasarım hesaplamaları
function calculateBatteryDesign() {
    // Giriş zorunluluğu kaldırıldı
    try {
        // Hücre özelliklerini al
        const cellNominalVoltage = parseFloat(document.getElementById('cellNominalVoltage').value) || 3.2;
        const cellMaxVoltage = parseFloat(document.getElementById('cellMaxVoltage').value) || 3.65;
        const cellCutoffVoltage = parseFloat(document.getElementById('cellCutoffVoltage').value) || 2.5;
        const cellCapacity = parseFloat(document.getElementById('cellCapacity').value) || 100;

        // 12S1P konfigürasyonu
        const seriesCells = parseInt(document.getElementById('seriesCells').value) || 12;
        const parallelCells = parseInt(document.getElementById('parallelCells').value) || 1;
        const cRate = parseFloat(document.getElementById('cRate').value) || 1;

        // Konteyner tasarımı
        const containerSeriesPacks = parseInt(document.getElementById('containerSeriesPacks').value) || 32;
        const containerParallelPacks = parseInt(document.getElementById('containerParallelPacks').value) || 3;
        const containerCount = parseInt(document.getElementById('containerCount').value) || 4;

        // 12S1P hesaplamaları (Formül: Hücre değeri x Seri/Paralel sayısı)
        const packNominalVoltage = cellNominalVoltage * seriesCells;
        const packMaxVoltage = cellMaxVoltage * seriesCells;
        const packCutoffVoltage = cellCutoffVoltage * seriesCells;
        const packCapacity = cellCapacity * parallelCells;

        // Konteyner hesaplamaları (Formül: Pack değeri x Seri/Paralel pack sayısı)
        const containerNominalVoltage = packNominalVoltage * containerSeriesPacks;
        const containerMaxVoltage = packMaxVoltage * containerSeriesPacks;
        const containerCutoffVoltage = packCutoffVoltage * containerSeriesPacks;
        const containerCapacity = packCapacity * containerParallelPacks;

        // Sistem hesaplamaları
        const storedEnergy = (containerNominalVoltage * containerCapacity * 0.8) / 1000; // kWh (80% DOD)
        const maxDischargeCurrent = containerCapacity * cRate;
        
        // Şarj ve deşarj süreleri (dinamik hesaplama)
        let chargingTime = 0;
        
        // C-Rate'e göre deşarj akımını hesapla
        const actualDischargeCurrent = containerCapacity * cRate; // C-Rate'e göre gerçek deşarj akımı
        const dischargePower = actualDischargeCurrent * containerNominalVoltage / 1000; // kW cinsinden deşarj gücü
        let dischargeTime = 0; // Şarj süresi hesaplandıktan sonra doldurulacak
        
        // CSV verilerinden şarj süresini hesapla
        if (csvData && csvData.length > 0) {
            // Günlük üretim verilerini hesapla
            const dailyProductions = {};
            
            csvData.forEach(record => {
                const date = record['Tarih'];
                const production = record['Üretim (kWh)'];
                
                if (!dailyProductions[date]) {
                    dailyProductions[date] = 0;
                }
                dailyProductions[date] += production;
            });
            
            // Günlük ortalama üretim hesapla
            const totalDailyProduction = Object.values(dailyProductions).reduce((sum, daily) => sum + daily, 0);
            const averageDailyProduction = totalDailyProduction / Object.keys(dailyProductions).length;
            
            console.log('📊 Günlük üretim hesaplamaları:', {
                toplamGun: Object.keys(dailyProductions).length,
                toplamGunlukUretim: totalDailyProduction,
                ortalamaGunlukUretim: averageDailyProduction,
                depolananEnerji: storedEnergy,
                konteynerSayisi: containerCount
            });
            
            // Şarj süresi = (Depolanan enerji × Konteyner sayısı) / Günlük ortalama üretim = Saat cinsinden
            if (averageDailyProduction > 0) {
                const totalStoredEnergy = storedEnergy * containerCount; // Tüm konteynerlerin toplam enerjisi
                chargingTime = totalStoredEnergy / averageDailyProduction; // Saat cinsinden şarj süresi
                console.log(`🔋 Şarj süresi hesaplandı: (${storedEnergy.toFixed(2)} kWh × ${containerCount} konteyner) / ${averageDailyProduction.toFixed(2)} kWh = ${chargingTime.toFixed(2)} saat`);
                
                // Deşarj süresi = Şarj süresi / C-rate
                dischargeTime = chargingTime / cRate;
                console.log(`🔋 Deşarj süresi hesaplandı: ${chargingTime.toFixed(2)} saat / ${cRate}C = ${dischargeTime.toFixed(2)} saat`);
            }
        }

        // Sonuçları güncelle
        document.getElementById('packNominalVoltage').textContent = packNominalVoltage.toFixed(1) + ' V';
        document.getElementById('packMaxVoltage').textContent = packMaxVoltage.toFixed(1) + ' V';
        document.getElementById('packCutoffVoltage').textContent = packCutoffVoltage.toFixed(1) + ' V';
        document.getElementById('packCapacity').textContent = packCapacity.toFixed(0) + ' Ah';

        document.getElementById('containerNominalVoltage').textContent = containerNominalVoltage.toFixed(1) + ' V';
        document.getElementById('containerMaxVoltage').textContent = containerMaxVoltage.toFixed(1) + ' V';
        document.getElementById('containerCutoffVoltage').textContent = containerCutoffVoltage.toFixed(1) + ' V';
        document.getElementById('containerCapacity').textContent = containerCapacity.toFixed(0) + ' Ah';

        // Depolanan enerji = Tek konteyner enerjisi × Konteyner sayısı
        const totalStoredEnergy = storedEnergy * containerCount;
        document.getElementById('storedEnergy').textContent = totalStoredEnergy.toFixed(2) + ' kWh';
        
        // Şarj süresini güncelle (zaten saat cinsinden)
        if (csvData && csvData.length > 0 && chargingTime > 0) {
            document.getElementById('chargingTime').textContent = chargingTime.toFixed(1) + ' Saat';
        } else {
            document.getElementById('chargingTime').textContent = 'CSV yüklenmedi';
        }
        
        document.getElementById('dischargeTime').textContent = dischargeTime.toFixed(2) + ' Saat';
        // Maksimum deşarj akımını C-Rate'e göre göster
        document.getElementById('maxDischargeCurrent').textContent = actualDischargeCurrent.toFixed(1) + ' A';

        // Uyumluluk kontrolü
        updateCompatibilityCheck(containerMaxVoltage, containerCutoffVoltage, actualDischargeCurrent);

        // Local storage'a kaydet
        const batteryDesign = {
            cellParams: { cellNominalVoltage, cellMaxVoltage, cellCutoffVoltage, cellCapacity },
            packParams: { seriesCells, parallelCells, cRate },
            containerParams: { containerSeriesPacks, containerParallelPacks, containerCount },
            calculations: { storedEnergy, chargingTime, dischargeTime, actualDischargeCurrent }
        };
        localStorage.setItem('solarBataryaBatteryDesign', JSON.stringify(batteryDesign));

        console.log('🔋 Batarya tasarım hesaplamaları güncellendi:', batteryDesign);

    } catch (error) {
        console.error('❌ Batarya tasarım hesaplamalarında hata:', error);
    }
}

// Veri kaynağı geçişi
function toggleDataSource() {
    const builtinSelected = document.getElementById('builtinData').checked;
    const builtinSection = document.getElementById('builtinDataSection');
    const uploadSection = document.getElementById('uploadDataSection');
    
    if (builtinSelected) {
        builtinSection.classList.remove('d-none');
        uploadSection.classList.add('d-none');
        console.log('🔄 Entegre veri modu seçildi');
    } else {
        builtinSection.classList.add('d-none');
        uploadSection.classList.remove('d-none');
        console.log('🔄 Dosya yükleme modu seçildi');
    }
}

// Veri kaynağı toggle'ını başlat
function initializeDataSourceToggle() {
    const builtinRadio = document.getElementById('builtinData');
    const uploadRadio = document.getElementById('uploadData');
    
    if (builtinRadio) {
        builtinRadio.addEventListener('change', toggleDataSource);
    }
    if (uploadRadio) {
        uploadRadio.addEventListener('change', toggleDataSource);
    }
    
    // İlk durumu ayarla
    toggleDataSource();
}

// Tarih aralığını güncelle ve kontrol et
function updateDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            // Bitiş tarihi başlangıçtan küçükse düzelt
            document.getElementById('endDate').value = startDate;
            console.log('⚠️ Bitiş tarihi düzeltildi');
        }
        
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        console.log(`📅 Seçilen tarih aralığı: ${startDate} - ${endDate} (${daysDiff} gün)`);
    }
}

// API'den EPİAŞ verilerini yükle (yeni sistem)
async function loadEpiasDataFromAPI() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const statusDiv = document.getElementById('builtinDataStatus');
    const infoSpan = document.getElementById('builtinDataInfo');
    
    if (!startDate || !endDate) {
        alert('Lütfen başlangıç ve bitiş tarihlerini seçin!');
        return;
    }
    
    console.log(`🚀 API'den EPİAŞ verileri yükleniyor: ${startDate} - ${endDate}`);
    
    try {
        // Loading durumunu göster
        if (statusDiv) {
            statusDiv.classList.remove('d-none');
            infoSpan.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>API\'den veriler yükleniyor (çok hızlı!)...';
        }
        
        // Giriş kontrolü kaldırıldı – herkes yükleyebilir
        
        // API'den veri çek - full URL kullan (CORS çözümü)
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3001' : '';
        const apiUrl = `${baseUrl}/api/epias-data?startDate=${startDate}&endDate=${endDate}`;
        console.log(`📡 API çağrısı: ${apiUrl}`);
        console.log('🔑 Token gönderilmeyecek (public erişim).');
        
        const response = await fetch(apiUrl, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`API hatası: ${response.status} ${response.statusText}`);
        }
        
        const apiResult = await response.json();
        
        if (!apiResult.success) {
            throw new Error(apiResult.error || 'API\'den veri çekme başarısız');
        }
        
        console.log(`✅ API'den ${apiResult.count} kayıt çekildi (${apiResult.startDate} - ${apiResult.endDate})`);
        
        // Global EPİAŞ verilerini güncelle
        epiasData = apiResult.data;
        
        // Başarı mesajını göster
        if (statusDiv && infoSpan) {
            infoSpan.innerHTML = `<i class="fas fa-check-circle me-1"></i>${apiResult.count} kayıt yüklendi (⚡ API) (${startDate} - ${endDate})`;
            
            if (infoSpan.parentElement) {
                infoSpan.parentElement.className = 'text-success small';
            }
        }
        
        console.log(`✅ API EPİAŞ verileri başarıyla yüklendi: ${apiResult.count} kayıt`);
        
        // Üretim verileri de varsa analizi başlat
        if (csvData && csvData.length > 0) {
            console.log('🔄 Üretim verileri mevcut, seçilen tarih aralığına göre filtreleyip analiz başlatılıyor...');
            
            const filteredProductionData = filterProductionDataByDateRange(csvData, startDate, endDate);
            console.log(`📊 Filtrelenmiş üretim verileri: ${filteredProductionData.length} kayıt (toplam ${csvData.length} kayıttan)`);
            
            if (filteredProductionData.length > 0) {
                calculateAnalysis(filteredProductionData);
                console.log('✅ API verileriyle analiz tamamlandı!');
            } else {
                console.warn('⚠️ Seçilen tarih aralığında üretim verisi bulunamadı!');
            }
        }
        
    } catch (error) {
        console.error('❌ API EPİAŞ verileri yüklenirken hata:', error);
        
        if (statusDiv && infoSpan) {
            infoSpan.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>API Hatası: ${error.message}`;
            
            if (infoSpan.parentElement) {
                infoSpan.parentElement.className = 'text-danger small';
            }
        }
        
        alert(`API EPİAŞ veri yükleme hatası: ${error.message}`);
    }
}

// Built-in EPİAŞ verilerini yükle (eski sistem - fallback)
async function loadBuiltinEpiasData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const statusDiv = document.getElementById('builtinDataStatus');
    const infoSpan = document.getElementById('builtinDataInfo');
    
    if (!startDate || !endDate) {
        alert('Lütfen başlangıç ve bitiş tarihlerini seçin!');
        return;
    }
    
    console.log(`📥 Built-in EPİAŞ verileri yükleniyor: ${startDate} - ${endDate}`);
    
    try {
        // Loading durumunu göster
        if (statusDiv) {
            statusDiv.classList.remove('d-none');
            infoSpan.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Veriler yükleniyor...';
        }
        
        let allData = [];
        
        // Direk JavaScript verilerini kullan (CORS problemi yok!)
        console.log('📦 JavaScript dosyasından veri yükleniyor...');
        
        if (typeof getFullEpiasData !== 'function') {
            throw new Error('EPİAŞ verisi bulunamadı!');
        }
        
        allData = getFullEpiasData();
        console.log(`✅ JavaScript verilerden ${allData.length} kayıt yüklendi`);
        
        // Tarih aralığına göre filtrele
        console.log(`🔍 Filtreleme öncesi toplam veri: ${allData.length} kayıt`);
        console.log(`🔍 Filtreleme kriterleri: ${startDate} - ${endDate}`);
        
        const filteredData = filterDataByDateRange(allData, startDate, endDate);
        console.log(`🔍 Filtreleme sonrası veri: ${filteredData.length} kayıt`);
        
        if (filteredData.length === 0) {
            throw new Error('Seçilen tarih aralığında veri bulunamadı!');
        }
        
        // Global EPİAŞ verilerini güncelle
        epiasData = filteredData;
        
        // Başarı mesajını göster
        if (statusDiv && infoSpan) {
            infoSpan.innerHTML = `<i class="fas fa-check-circle me-1"></i>${filteredData.length} kayıt yüklendi (${startDate} - ${endDate})`;
            
            // Class'ı güvenli şekilde güncelle - infoSpan'i direkt güncelle
            if (infoSpan.parentElement) {
                infoSpan.parentElement.className = 'text-success small';
            }
        }
        
        console.log(`✅ Built-in EPİAŞ verileri başarıyla yüklendi: ${filteredData.length} kayıt`);
        
        // Üretim verileri de varsa analizi başlat - ancak aynı tarih aralığına göre filtrele
        if (csvData && csvData.length > 0) {
            console.log('🔄 Üretim verileri mevcut, seçilen tarih aralığına göre filtreleyip analiz başlatılıyor...');
            
            // Üretim verilerini de aynı tarih aralığına göre filtrele
            const filteredProductionData = filterProductionDataByDateRange(csvData, startDate, endDate);
            console.log(`📊 Filtrelenmiş üretim verileri: ${filteredProductionData.length} kayıt (toplam ${csvData.length} kayıttan)`);
            
            if (filteredProductionData.length > 0) {
                calculateAnalysis(filteredProductionData);
                console.log('✅ Seçilen tarih aralığındaki verilerle analiz tamamlandı!');
            } else {
                console.warn('⚠️ Seçilen tarih aralığında üretim verisi bulunamadı!');
            }
        }
        
    } catch (error) {
        console.error('❌ Built-in EPİAŞ verileri yüklenirken hata:', error);
        
        if (statusDiv && infoSpan) {
            infoSpan.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>Hata: ${error.message}`;
            
            // Class'ı güvenli şekilde güncelle - infoSpan'i direkt güncelle
            if (infoSpan.parentElement) {
                infoSpan.parentElement.className = 'text-danger small';
            }
        }
        
        alert(`EPİAŞ verileri yüklenirken hata: ${error.message}`);
    }
}

// CSV dosyası yükleme fonksiyonu (artık kullanılmıyor - JS verilerinden çekiyoruz)
// Bu fonksiyon geriye uyumluluk için korundu
async function loadCSVFile(filename) {
    console.warn('⚠️ CSV dosyası yükleme çağrıldı, ama artık JS verilerini kullanıyoruz:', filename);
    throw new Error('CSV dosyası yükleme artık desteklenmiyor - JavaScript verileri kullanılıyor');
}

// EPİAŞ CSV verilerini parse et
function parseEpiasCSVData(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    
    // İlk satırı atla (header)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length >= 3) {
            const tarih = parts[0].trim();
            const saat = parts[1].trim();
            const ptf = parts[2].trim().replace(',', '.');
            
            if (tarih && saat && ptf) {
                data.push({
                    'Tarih': tarih,
                    'Saat': saat,
                    'PTF (TL/MWh)': parseFloat(ptf)
                });
            }
        }
    }
    
    return data;
}

// Üretim verilerini tarih aralığına göre filtrele (akıllı yıl eşleştirme ile)
function filterProductionDataByDateRange(data, startDateStr, endDateStr) {
    console.log(`🔍 Üretim verileri filtreleme başlıyor: ${startDateStr} - ${endDateStr}`);
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    console.log(`🔍 Başlangıç: ${startDate.toLocaleDateString('tr-TR')}, Bitiş: ${endDate.toLocaleDateString('tr-TR')}`);
    
    // İlk kayıttan üretim veri formatını anla
    const sampleDate = data[0]?.Tarih; // "1990-01-01" formatında
    const isLegacyYear = sampleDate && sampleDate.startsWith('1990');
    
    if (isLegacyYear) {
        console.log(`🔄 Üretim verilerinde legacy yıl (1990) tespit edildi, akıllı filtreleme yapılıyor...`);
        
        // Legacy yıl (1990) durumunda: ay/gün bazında filtreleme yap
        const filteredData = data.filter(row => {
            const dateStr = row['Tarih']; // "1990-MM-DD"
            const dateParts = dateStr.split('-'); // ['1990', 'MM', 'DD']
            
            if (dateParts.length !== 3) return false;
            
            const month = dateParts[1]; // MM
            const day = dateParts[2];   // DD
            
            // Hedef tarih aralığındaki ay/gün ile karşılaştır
            const startMonth = startDate.getMonth() + 1; // 1-12
            const startDay = startDate.getDate();
            const endMonth = endDate.getMonth() + 1; // 1-12  
            const endDay = endDate.getDate();
            
            const rowMonth = parseInt(month);
            const rowDay = parseInt(day);
            
            // Basit ay/gün aralığı kontrolü (aynı yıl içinde)
            if (startMonth === endMonth) {
                return rowMonth === startMonth && rowDay >= startDay && rowDay <= endDay;
            } else {
                // Ay geçişi olan durum
                return (rowMonth === startMonth && rowDay >= startDay) || 
                       (rowMonth > startMonth && rowMonth < endMonth) ||
                       (rowMonth === endMonth && rowDay <= endDay);
            }
        });
        
        console.log(`✅ Akıllı filtreleme: ${filteredData.length} kayıt`);
        return filteredData;
        
    } else {
        // Normal yıl durumunda: standart tarih filtreleme
        const filteredData = data.filter(row => {
            const dateStr = row['Tarih']; // YYYY-MM-DD formatında
            const rowDate = new Date(dateStr);
            
            const isInRange = rowDate >= startDate && rowDate <= endDate;
            return isInRange;
        });
        
        console.log(`✅ Standart filtreleme: ${filteredData.length} kayıt`);
        return filteredData;
    }
}

// EPİAŞ verilerini tarih aralığına göre filtrele
function filterDataByDateRange(data, startDateStr, endDateStr) {
    console.log(`🔍 Filtreleme başlıyor: ${startDateStr} - ${endDateStr}`);
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    console.log(`🔍 Başlangıç tarihi: ${startDate.toISOString()} (${startDate.toLocaleDateString('tr-TR')})`);
    console.log(`🔍 Bitiş tarihi: ${endDate.toISOString()} (${endDate.toLocaleDateString('tr-TR')})`);
    
    let debugCount = 0;
    const filteredData = data.filter(row => {
        const rowDateParts = row['Tarih'].split('.');
        if (rowDateParts.length !== 3) {
            console.warn(`⚠️ Geçersiz tarih formatı: ${row['Tarih']}`);
            return false;
        }
        
        // DD.MM.YYYY formatını YYYY-MM-DD'ye çevir
        const rowDate = new Date(`${rowDateParts[2]}-${rowDateParts[1]}-${rowDateParts[0]}`);
        const isInRange = rowDate >= startDate && rowDate <= endDate;
        
        // İlk birkaç ve örnekleme karşılaştırmalarını logla
        if (debugCount < 5 || (isInRange && debugCount % 500 === 0)) {
            console.log(`🔍 ${row['Tarih']} -> ${rowDate.toLocaleDateString('tr-TR')} | Aralıkta: ${isInRange ? '✅' : '❌'}`);
            console.log(`    Karşılaştırma: ${rowDate.getTime()} >= ${startDate.getTime()} && ${rowDate.getTime()} <= ${endDate.getTime()}`);
        }
        debugCount++;
        
        return isInRange;
    });
    
    console.log(`🔍 Filtreleme tamamlandı: ${filteredData.length} kayıt bulundu (toplam ${data.length} kayıttan)`);
    
    // İlk ve son kayıtları göster
    if (filteredData.length > 0) {
        console.log(`📅 Filtrelenen ilk kayıt: ${filteredData[0].Tarih} ${filteredData[0].Saat}`);
        console.log(`📅 Filtrelenen son kayıt: ${filteredData[filteredData.length - 1].Tarih} ${filteredData[filteredData.length - 1].Saat}`);
    } else {
        console.warn(`❌ Hiç kayıt filtrelenmedi! Örnek kayıtlar:`);
        for (let i = 0; i < Math.min(5, data.length); i++) {
            console.warn(`    ${data[i].Tarih} ${data[i].Saat}`);
        }
    }
    
    return filteredData;
}

// Konfigürasyon başlığını güncelle
function updateConfigurationTitle() {
    try {
        const seriesCells = parseInt(document.getElementById('seriesCells').value) || 12;
        const parallelCells = parseInt(document.getElementById('parallelCells').value) || 1;
        const configTitle = document.getElementById('configTitle');
        const configCalculationsTitle = document.getElementById('configCalculationsTitle');
        
        const configName = `${seriesCells}S${parallelCells}P`;
        
        if (configTitle) {
            configTitle.textContent = `${configName} Konfigürasyonu`;
        }
        
        if (configCalculationsTitle) {
            configCalculationsTitle.textContent = `${configName} Hesaplamaları`;
        }
        
        console.log(`🔧 Konfigürasyon başlıkları güncellendi: ${configName}`);
    } catch (error) {
        console.error('❌ Konfigürasyon başlığı güncellenirken hata:', error);
    }
}

// Gerçek zamanlı hesaplama için input event listener'ları
function initializeBatteryDesignInputs() {
    const inputIds = [
        'cellNominalVoltage', 'cellMaxVoltage', 'cellCutoffVoltage', 'cellCapacity',
        'seriesCells', 'parallelCells', 'cRate',
        'containerSeriesPacks', 'containerParallelPacks', 'containerCount'
    ];

    inputIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', function() {
                // Konfigürasyon başlığını güncelle (seri/paralel değişiklikleri için)
                if (id === 'seriesCells' || id === 'parallelCells') {
                    updateConfigurationTitle();
                }
                
                // Kısa bir gecikme ile hesaplamaları güncelle (performans için)
                clearTimeout(window.batteryCalculationTimeout);
                window.batteryCalculationTimeout = setTimeout(() => {
                    calculateBatteryDesign();
                }, 300);
            });
        }
    });
    
    // İlk yüklemede başlığı güncelle
    updateConfigurationTitle();
}

// Uyumluluk kontrolü güncelleme
function updateCompatibilityCheck(maxVoltage, minVoltage, maxCurrent) {
    // Limit değerleri
    const voltageMaxLimit = 1500;
    const voltageMinLimit = 915;
    const currentMaxLimit = 4014;
    const dcInputLimit = 24;

    // Kontroller
    const voltageMaxCheck = maxVoltage <= voltageMaxLimit;
    const voltageMinCheck = minVoltage >= voltageMinLimit;
    const currentMaxCheck = maxCurrent <= currentMaxLimit;
    const dcInputCheck = 24 <= dcInputLimit; // Sabit değer

    // Sonuçları güncelle
    document.getElementById('actualVoltageMax').textContent = maxVoltage.toFixed(0) + ' V';
    document.getElementById('actualVoltageMin').textContent = minVoltage.toFixed(0) + ' V';
    document.getElementById('actualCurrentMax').textContent = maxCurrent.toFixed(0) + ' A';

    // Badge'leri güncelle
    updateCompatibilityBadge('voltageMaxCheck', voltageMaxCheck);
    updateCompatibilityBadge('voltageMinCheck', voltageMinCheck);
    updateCompatibilityBadge('currentMaxCheck', currentMaxCheck);
    updateCompatibilityBadge('dcInputCheck', dcInputCheck);
}

// Uyumluluk badge güncelleme
function updateCompatibilityBadge(elementId, isCompatible) {
    const row = document.getElementById(elementId);
    if (row) {
        const badge = row.querySelector('.badge');
        if (badge) {
            if (isCompatible) {
                badge.className = 'badge bg-success';
                badge.textContent = 'Uygun';
            } else {
                badge.className = 'badge bg-danger';
                badge.textContent = 'Uygun Değil';
            }
        }
    }
}

// Batarya tasarım raporu oluşturma
function exportBatteryDesign() {
    // Giriş zorunluluğu kaldırıldı
    try {
        const batteryDesign = localStorage.getItem('solarBataryaBatteryDesign');
        if (!batteryDesign) {
            showNotification('Önce hesaplama yapmanız gerekiyor!', 'warning');
            return;
        }

        const design = JSON.parse(batteryDesign);
        const reportWindow = window.open('', '_blank', 'width=1200,height=800');
        
        reportWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Batarya Tasarım Raporu - SolarBatarya</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #ffffff; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .section { margin-bottom: 30px; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
                    th { background-color: rgba(255,215,0,0.1); color: #FFD700; }
                    .highlight { background-color: rgba(255,215,0,0.1); }
                    .success { color: #28a745; }
                    .danger { color: #dc3545; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔋 Batarya Tasarım Raporu</h1>
                    <p>Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
                </div>
                
                <div class="section">
                    <h2>📊 Hücre Özellikleri</h2>
                    <table>
                        <tr><th>Parametre</th><th>Değer</th></tr>
                        <tr><td>Nominal Hücre Voltajı</td><td>${design.cellParams.cellNominalVoltage} V</td></tr>
                        <tr><td>Maksimum Hücre Voltajı</td><td>${design.cellParams.cellMaxVoltage} V</td></tr>
                        <tr><td>Kesme Hücre Voltajı</td><td>${design.cellParams.cellCutoffVoltage} V</td></tr>
                        <tr><td>Hücre Kapasitesi</td><td>${design.cellParams.cellCapacity} Ah</td></tr>
                    </table>
                </div>
                
                <div class="section">
                    <h2>🔗 12S1P Konfigürasyonu</h2>
                    <table>
                        <tr><th>Parametre</th><th>Değer</th></tr>
                        <tr><td>Seri Hücre Sayısı</td><td>${design.packParams.seriesCells}</td></tr>
                        <tr><td>Paralel Hücre Sayısı</td><td>${design.packParams.parallelCells}</td></tr>
                        <tr><td>C-Rate</td><td>${design.packParams.cRate}</td></tr>
                    </table>
                </div>
                
                <div class="section">
                    <h2>📦 Konteyner Tasarımı</h2>
                    <table>
                        <tr><th>Parametre</th><th>Değer</th></tr>
                        <tr><td>Seri Pack Sayısı</td><td>${design.containerParams.containerSeriesPacks}</td></tr>
                        <tr><td>Paralel Pack Sayısı</td><td>${design.containerParams.containerParallelPacks}</td></tr>
                        <tr><td>Konteyner Sayısı</td><td>${design.containerParams.containerCount}</td></tr>
                    </table>
                </div>
                
                <div class="section">
                    <h2>⚡ Sistem Hesaplamaları</h2>
                    <table>
                        <tr><th>Parametre</th><th>Değer</th></tr>
                        <tr><td>Depolanan Enerji (80% DOD)</td><td>${(design.calculations.storedEnergy * design.containerParams.containerCount).toFixed(2)} kWh</td></tr>
                        <tr><td>Tam Güneşte Şarj Süresi</td><td>${design.calculations.chargingTime.toFixed(1)} Saat</td></tr>
                        <tr><td>Maksimum Yük Deşarj Süresi</td><td>${design.calculations.dischargeTime.toFixed(2)} Saat</td></tr>
                        <tr><td>Maksimum Deşarj Akımı (${design.packParams.cRate}C)</td><td>${design.calculations.actualDischargeCurrent.toFixed(1)} A</td></tr>
                    </table>
                </div>
            </body>
            </html>
        `);
        
        reportWindow.document.close();
        showNotification('Batarya tasarım raporu oluşturuldu!', 'success');

    } catch (error) {
        console.error('❌ Rapor oluşturulurken hata:', error);
        showNotification('❌ Rapor oluşturulurken hata oluştu!', 'error');
    }
}

// Sayfa yüklendiğinde batarya tasarımını yükle
function loadBatteryDesign() {
    // Giriş zorunluluğu kaldırıldı
    try {
        const savedDesign = localStorage.getItem('solarBataryaBatteryDesign');
        if (savedDesign) {
            const design = JSON.parse(savedDesign);
            
            // Form alanlarını doldur
            if (design.cellParams) {
                document.getElementById('cellNominalVoltage').value = design.cellParams.cellNominalVoltage || 3.2;
                document.getElementById('cellMaxVoltage').value = design.cellParams.cellMaxVoltage || 3.65;
                document.getElementById('cellCutoffVoltage').value = design.cellParams.cellCutoffVoltage || 2.5;
                document.getElementById('cellCapacity').value = design.cellParams.cellCapacity || 100;
            }
            
            if (design.packParams) {
                document.getElementById('seriesCells').value = design.packParams.seriesCells || 12;
                document.getElementById('parallelCells').value = design.packParams.parallelCells || 1;
                document.getElementById('cRate').value = design.packParams.cRate || 1;
            }
            
            if (design.containerParams) {
                document.getElementById('containerSeriesPacks').value = design.containerParams.containerSeriesPacks || 32;
                document.getElementById('containerParallelPacks').value = design.containerParams.containerParallelPacks || 3;
                document.getElementById('containerCount').value = design.containerParams.containerCount || 4;
            }
            
            console.log('📂 Kaydedilmiş batarya tasarımı yüklendi:', design);
        }
        
        // İlk hesaplamayı yap
        setTimeout(() => {
            calculateBatteryDesign();
        }, 100);
        
    } catch (error) {
        console.error('❌ Batarya tasarımı yüklenirken hata:', error);
    }
}

// === YENİ REAL-TIME EPİAŞ FONKSİYONLARI - ASKIYA ALINDI ===

/*
// Bugünkü EPİAŞ verilerini çek
async function refreshTodayEpias() {
    try {
        showNotification('Bugünkü EPİAŞ verileri çekiliyor...', 'info');
        
        // file:// protocol için URL düzeltmesi
        let apiUrl = '/api/refresh/epias';
        if (window.location.protocol === 'file:') {
            apiUrl = 'http://localhost:3001/api/refresh/epias';
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showNotification(`✅ ${result.date} verileri çekildi: ${result.items} kayıt (Ort: ${result.avg?.toFixed(2)} TL/MWh)`, 'success');
        } else {
            showNotification(`❌ Hata: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('EPİAŞ refresh hatası:', error);
        showNotification('❌ Bağlantı hatası', 'error');
    }
}

// Özel tarih için EPİAŞ verileri çek
async function refreshCustomDateEpias() {
    const customDate = document.getElementById('customEpiasDate').value;
    
    if (!customDate) {
        showNotification('❌ Lütfen bir tarih seçin', 'warning');
        return;
    }
    
    try {
        showNotification(`${customDate} EPİAŞ verileri çekiliyor...`, 'info');
        
        // file:// protocol için URL düzeltmesi
        let apiUrl = '/api/refresh/epias';
        if (window.location.protocol === 'file:') {
            apiUrl = 'http://localhost:3001/api/refresh/epias';
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: customDate })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showNotification(`✅ ${result.date} verileri çekildi: ${result.items} kayıt (Ort: ${result.avg?.toFixed(2)} TL/MWh)`, 'success');
        } else {
            showNotification(`❌ Hata: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('EPİAŞ custom refresh hatası:', error);
        showNotification('❌ Bağlantı hatası', 'error');
    }
}

// Mevcut EPİAŞ tarihlerini listele
async function listAvailableEpiasDates() {
    try {
        // file:// protocol için URL düzeltmesi
        let apiUrl = '/api/epias/list';
        if (window.location.protocol === 'file:') {
            apiUrl = 'http://localhost:3001/api/epias/list';
        }
        
        const response = await fetch(apiUrl, {
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            } : {}
        });
        const result = await response.json();
        
        if (result.ok && result.count > 0) {
            const dates = result.dates.slice(-10); // Son 10 tarihi göster
            showNotification(`📊 Mevcut ${result.count} günlük veri. Son 10: ${dates.join(', ')}`, 'info');
        } else {
            showNotification('📊 Henüz çekilmiş gerçek zamanlı veri yok', 'info');
        }
        
    } catch (error) {
        console.error('EPİAŞ list hatası:', error);
        showNotification('❌ Bağlantı hatası', 'error');
    }
}

// Basit notification sistemi
function showNotification(message, type = 'info') {
    // Basit alert kullanıyoruz, gelişmiş notification sistemi eklenebilir
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Eğer status div'i varsa oraya da yazdır
    const statusDiv = document.getElementById('builtinDataStatus');
    if (statusDiv) {
        const infoSpan = statusDiv.querySelector('#builtinDataInfo');
        if (infoSpan) {
            infoSpan.textContent = message;
            statusDiv.classList.remove('d-none');
            
            // Renk değiştir
            const icon = statusDiv.querySelector('i');
            const text = statusDiv.querySelector('div');
            
            if (type === 'success') {
                text.className = 'text-success small';
                icon.className = 'fas fa-check-circle me-1';
            } else if (type === 'error') {
                text.className = 'text-danger small';
                icon.className = 'fas fa-exclamation-circle me-1';
            } else if (type === 'warning') {
                text.className = 'text-warning small';
                icon.className = 'fas fa-exclamation-triangle me-1';
            } else {
                text.className = 'text-info small';
                icon.className = 'fas fa-info-circle me-1';
            }
        }
    }
}
*/

// === KULLANICI GİRİŞ SİSTEMİ ===

let currentUser = null;
let authToken = null;

// Sayfa yüklendiğinde kullanıcı durumunu kontrol et
document.addEventListener('DOMContentLoaded', function() {
    // Giriş zorunluluğu kaldırıldı: UI'yi doğrudan erişime aç
    currentUser = null;
    authToken = null;
    updateUserInterface(true);

    // Form event listener'larını ekle (isteyen yine kayıt/giriş yapabilir)
    setupAuthForms();
});

// Token doğrulama
async function validateToken(token) {
    try {
        const response = await fetch(getApiUrl('/api/auth/me'), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.ok) {
                currentUser = result.user;
                authToken = token;
                updateUserInterface();
            } else {
                clearAuth();
            }
        } else {
            clearAuth();
        }
    } catch (error) {
        console.error('Token doğrulama hatası:', error);
        clearAuth();
    }
}

// Auth formu setup
function setupAuthForms() {
    // Login form
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const credential = document.getElementById('loginCredential').value;
            const password = document.getElementById('loginPassword').value;
            await loginUser(credential, password);
        });
    }
    
    // Register form  
    const registerForm = document.getElementById('registerFormElement');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            await registerUser(username, email, password);
        });
    }
}

// Login modal göster
// Login modal kaldırıldı
function showLoginModal() {}

// Register modal göster  
// Register modal kaldırıldı
function showRegisterModal() {}

// Form arası geçiş
function switchToRegister() {}

function switchToLogin() {}

// Kullanıcı kayıt
async function registerUser(username, email, password) {
    try {
        showNotification('Kayıt işlemi yapılıyor...', 'info');
        
        const response = await fetch(getApiUrl('/api/auth/register'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            currentUser = result.user;
            authToken = result.token;
            localStorage.setItem('authToken', result.token);
            updateUserInterface();
            
                    // Modal'ı kapat
        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
        if (modal) modal.hide();
        
        showNotification(result.message || 'Kayıt başarılı! Hoş geldiniz!', 'success');
        } else {
            showNotification(result.error || 'Kayıt sırasında hata oluştu', 'error');
        }
    } catch (error) {
        console.error('Kayıt hatası:', error);
        showNotification('Bağlantı hatası', 'error');
    }
}

// Kullanıcı giriş
async function loginUser(credential, password) {
    try {
        showNotification('Giriş yapılıyor...', 'info');
        
        const response = await fetch(getApiUrl('/api/auth/login'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ credential, password })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            currentUser = result.user;
            authToken = result.token;
            localStorage.setItem('authToken', result.token);
            updateUserInterface();
            
                    // Modal'ı kapat
        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
        if (modal) modal.hide();
        
        showNotification(result.message || 'Giriş başarılı!', 'success');
        } else {
            showNotification(result.error || 'Giriş sırasında hata oluştu', 'error');
        }
    } catch (error) {
        console.error('Giriş hatası:', error);
        showNotification('Bağlantı hatası', 'error');
    }
}

// Çıkış
function logout() {
    clearAuth();
    showNotification('Başarıyla çıkış yaptınız', 'info');
}

// Auth temizle
function clearAuth() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    updateUserInterface();
}

// Kullanıcı arayüzünü güncelle
function updateUserInterface(publicAccess = false) {
    const loginSection = document.getElementById('loginSection');
    const userInfo = document.getElementById('userInfo');
    const currentUsername = document.getElementById('currentUsername');
    const authGate = document.getElementById('authGate');
    const protectedContent = document.getElementById('protectedContent');
    
    if (currentUser && authToken) {
        // Kullanıcı girişi var - ana içeriği göster
        if (authGate) authGate.style.display = 'none';
        if (protectedContent) protectedContent.classList.remove('d-none');
        
        // Sidebar kullanıcı bilgilerini güncelle
        if (loginSection) loginSection.classList.add('d-none');
        if (userInfo) userInfo.classList.remove('d-none');
        if (currentUsername) currentUsername.textContent = currentUser.username;
        
        console.log('✅ Kullanıcı girişi doğrulandı, ana içerik gösteriliyor');
    } else {
        // Giriş yok: herkese açık erişim
        if (authGate) authGate.style.display = 'none';
        if (protectedContent) protectedContent.classList.remove('d-none');
        
        // Sidebar kullanıcı bilgilerini gizle
        if (loginSection) loginSection.classList.remove('d-none');
        if (userInfo) userInfo.classList.add('d-none');
        if (currentUsername) currentUsername.textContent = '';
        
        // Açık modal'ı kapat (giriş yapılmadıysa)
        const authModalElement = document.getElementById('authModal');
        if (authModalElement && authModalElement.classList.contains('show')) {
            authModalElement.style.display = 'none';
            authModalElement.classList.remove('show');
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
        
        console.log('✅ Giriş olmadan erişim açık');
    }

    // EPİAŞ butonlarının erişimini güncelle
    updateEpiasButtonsAccess();
}

// EPİAŞ butonlarının erişim durumunu güncelle
function updateEpiasButtonsAccess() {
    const epiasButton = document.querySelector('button[onclick="loadEpiasDataFromAPI()"]');
    
    if (epiasButton) {
        epiasButton.disabled = false;
        epiasButton.innerHTML = '<i class="fas fa-rocket me-1"></i>EPİAŞ Verilerini Yükle (DB)';
        epiasButton.title = '';
    }
}

// Modal'ı manuel kapat - GÜVENLİK KONTROLÜ İLE
function closeAuthModal() {
    try {
        // 🚨 GÜVENLİK KONTROLÜ: Giriş yapmadan modal kapatılamaz!
        if (!authToken || !currentUser) {
            console.log('🔒 Giriş yapılmadan modal kapatılamaz!');
            showNotification('⚠️ Sisteme erişmek için giriş yapmanız gerekiyor!', 'warning');
            return; // Modal kapatılmaz!
        }
        
        const authModalElement = document.getElementById('authModal');
        if (authModalElement) {
            authModalElement.style.display = 'none';
            authModalElement.classList.remove('show');
        }
        
        document.body.classList.remove('modal-open');
        
        // Backdrop'u kaldır
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        console.log('✅ Modal güvenli şekilde kapatıldı');
    } catch (error) {
        console.error('❌ Modal kapatma hatası:', error);
    }
}

// API URL helper (CORS düzeltmesi ile)
function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:3001' + endpoint;
    }
    return endpoint;
}

// Bildirim sistemi (düzenlendi)
function showNotification(message, type = 'info') {
    // Mevcut notification elementi bul veya oluştur
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            max-width: 400px;
        `;
        document.body.appendChild(notification);
    }
    
    // Renk ve ikon ayarla
    let bgColor, icon;
    switch (type) {
        case 'success':
            bgColor = '#10B981';
            icon = '✅';
            break;
        case 'error':
            bgColor = '#EF4444';
            icon = '❌';
            break;
        case 'warning':
            bgColor = '#F59E0B';
            icon = '⚠️';
            break;
        default:
            bgColor = '#3B82F6';
            icon = 'ℹ️';
    }
    
    notification.style.backgroundColor = bgColor;
    notification.innerHTML = `${icon} ${message}`;
    notification.style.display = 'block';
    notification.style.opacity = '1';
    
    // Otomatik gizle
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 4000);
}

