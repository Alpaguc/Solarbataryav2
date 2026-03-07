const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initializeDatabase, getEpiasData, getDateRange, importEpiasData, createUser, getUserByCredential, getUserById, updateLastLogin, getUserCount } = require('./database');
// const { refreshInterimMcpDaily } = require('./epias'); // ASKIYA ALINDI
// const cron = require('node-cron'); // ASKIYA ALINDI

// .env dosyası varsa yükle
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || './data/epias';
const USERNAME = process.env.EPIAS_USERNAME;
const PASSWORD = process.env.EPIAS_PASSWORD;
const TGT_TOKEN = process.env.EPIAS_TGT;
const JWT_SECRET = process.env.JWT_SECRET || 'solarbatarya-secret-key-2025';

// Debug: Environment variables'ları kontrol et - ASKIYA ALINDI
// console.log('🔍 Environment Variables Debug:');
// console.log(`   USERNAME: ${USERNAME ? 'SET' : 'NOT SET'}`);
// console.log(`   PASSWORD: ${PASSWORD ? 'SET' : 'NOT SET'}`);
// console.log(`   TGT_TOKEN: ${TGT_TOKEN ? 'SET (length: ' + TGT_TOKEN.length + ')' : 'NOT SET'}`);
// console.log(`   Working Directory: ${process.cwd()}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Initialize database and data directory on startup
(async () => {
    try {
        await initializeDatabase();
        console.log('✅ Veritabanı başlatıldı');
        
        // EPİAŞ data klasörünü oluştur
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('✅ EPİAŞ data klasörü hazır:', DATA_DIR);
    } catch (err) {
        console.error('❌ Başlatma hatası:', err);
    }
})();

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Solar Batarya API çalışıyor'
    });
});

// EPİAŞ verileri çekme
app.get('/api/epias-data', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate ve endDate parametreleri gerekli',
                example: '/api/epias-data?startDate=2025-01-01&endDate=2025-08-01'
            });
        }

        console.log(`📊 EPİAŞ verileri isteniyor: ${startDate} - ${endDate}`);
        
        const data = await getEpiasData(startDate, endDate);
        
        res.json({
            success: true,
            count: data.length,
            startDate,
            endDate,
            data: data
        });
        
    } catch (error) {
        console.error('❌ EPİAŞ veri hatası:', error);
        res.status(500).json({
            error: 'Veri çekme hatası',
            message: error.message
        });
    }
});

// Mevcut tarih aralığını öğrenme
app.get('/api/date-range', async (req, res) => {
    try {
        const range = await getDateRange();
        res.json({
            success: true,
            ...range
        });
    } catch (error) {
        console.error('❌ Tarih aralığı hatası:', error);
        res.status(500).json({
            error: 'Tarih aralığı öğrenme hatası',
            message: error.message
        });
    }
});

// EPİAŞ verilerini veritabanına aktarma (bir kerelik)
app.post('/api/import-epias', async (req, res) => {
    try {
        console.log('📥 EPİAŞ verileri veritabanına aktarılıyor...');
        const result = await importEpiasData();
        
        res.json({
            success: true,
            message: 'EPİAŞ verileri başarıyla aktarıldı',
            ...result
        });
        
    } catch (error) {
        console.error('❌ Veri aktarma hatası:', error);
        res.status(500).json({
            error: 'Veri aktarma hatası',
            message: error.message
        });
    }
});

// === YENİ EPİAŞ REAL-TIME ENDPOINTS - ASKIYA ALINDI ===

/*
// Günlük EPİAŞ verilerini kaydet
async function saveDaily(out) {
    const file = path.join(DATA_DIR, `${out.date}.json`);
    await fs.writeFile(file, JSON.stringify(out.raw, null, 2), 'utf8');
    return file;
}

// Manuel EPİAŞ veri yenileme
app.post('/api/refresh/epias', async (req, res) => {
    try {
        if (!TGT_TOKEN && (!USERNAME || !PASSWORD)) {
            return res.status(400).json({
                ok: false,
                error: 'EPİAŞ kimlik bilgileri (.env) eksik - TGT token veya username/password gerekli'
            });
        }

        const date = req.body?.date || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
        console.log(`🔄 EPİAŞ gerçek zamanlı veri çekiliyor: ${date}`);
        
        // Demo mode için geçici çözüm
        if (USERNAME.includes('demo') || USERNAME.includes('test')) {
            // Demo veri oluştur
            const demoData = {
                date: date,
                count: 24,
                avg: 2500 + Math.random() * 1000,
                raw: {
                    items: Array.from({length: 24}, (_, i) => ({
                        date: date,
                        hour: String(i).padStart(2, '0') + ':00',
                        price: 2000 + Math.random() * 2000
                    })),
                    statistic: {
                        interimMcpAvg: 2500 + Math.random() * 1000
                    }
                }
            };
            
            const file = await saveDaily(demoData);
            
            return res.json({ 
                ok: true, 
                date: demoData.date, 
                items: demoData.count, 
                avg: demoData.avg.toFixed(2), 
                file: path.basename(file),
                demo: true
            });
        }
        
        const out = await refreshInterimMcpDaily(USERNAME, PASSWORD, date, { 
            checkIntervalMs: 30000, 
            maxWaitMs: 30 * 60 * 1000,
            providedTgt: TGT_TOKEN
        });
        
        const file = await saveDaily(out);
        
        res.json({ 
            ok: true, 
            date: out.date, 
            items: out.count, 
            avg: out.avg, 
            file: path.basename(file)
        });
        
    } catch (e) {
        console.error('❌ EPİAŞ refresh hatası:', e);
        res.status(500).json({ 
            ok: false, 
            error: String(e?.message || e) 
        });
    }
});

// Kaydedilen günlük EPİAŞ verisini getir
app.get('/api/epias/daily/:date', async (req, res) => {
    try {
        const file = path.join(DATA_DIR, `${req.params.date}.json`);
        const json = await fs.readFile(file, 'utf8');
        res.type('application/json').send(json);
    } catch (error) {
        res.status(404).json({ 
            ok: false, 
            error: 'Belirtilen tarih için veri bulunamadı',
            date: req.params.date
        });
    }
});

// Mevcut gerçek zamanlı EPİAŞ dosyalarını listele
app.get('/api/epias/list', async (req, res) => {
    try {
        const files = await fs.readdir(DATA_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        
        res.json({
            ok: true,
            count: jsonFiles.length,
            dates: jsonFiles.sort()
        });
    } catch (error) {
        res.json({
            ok: true,
            count: 0,
            dates: []
        });
    }
});
*/

// === AUTHENTICATION MIDDLEWARE ===

// JWT Token doğrulama middleware'i (DEVRE DIŞI - herkese açık)
function authenticateToken(req, res, next) {
    // Giriş zorunluluğu kaldırıldı; tüm istekleri kabul et
    return next();
}

// === AUTHENTICATION ENDPOINTS ===

// Kullanıcı kayıt
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validasyon
        if (!username || !email || !password) {
            return res.status(400).json({
                ok: false,
                error: 'Kullanıcı adı, e-posta ve şifre gerekli'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                ok: false,
                error: 'Şifre en az 6 karakter olmalı'
            });
        }

        // E-posta formatı kontrol
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                ok: false,
                error: 'Geçerli bir e-posta adresi girin'
            });
        }

        // Şifreyi hashle
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Kullanıcı oluştur
        const user = await createUser(username, email, passwordHash);

        // JWT token oluştur
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            ok: true,
            message: 'Kayıt başarılı! Hoş geldiniz!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            token
        });

    } catch (error) {
        console.error('❌ Kayıt hatası:', error);
        res.status(500).json({
            ok: false,
            error: error.message || 'Kayıt sırasında hata oluştu'
        });
    }
});

// Kullanıcı giriş
app.post('/api/auth/login', async (req, res) => {
    try {
        const { credential, password } = req.body;

        if (!credential || !password) {
            return res.status(400).json({
                ok: false,
                error: 'Kullanıcı adı/e-posta ve şifre gerekli'
            });
        }

        // Kullanıcıyı bul
        const user = await getUserByCredential(credential);
        if (!user) {
            return res.status(401).json({
                ok: false,
                error: 'Kullanıcı adı/e-posta veya şifre hatalı'
            });
        }

        // Şifreyi kontrol et
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({
                ok: false,
                error: 'Kullanıcı adı/e-posta veya şifre hatalı'
            });
        }

        // Son giriş zamanını güncelle
        await updateLastLogin(user.id);

        // JWT token oluştur
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            ok: true,
            message: `Hoş geldiniz, ${user.username}!`,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                last_login: new Date().toISOString()
            },
            token
        });

    } catch (error) {
        console.error('❌ Giriş hatası:', error);
        res.status(500).json({
            ok: false,
            error: 'Giriş sırasında hata oluştu'
        });
    }
});

// Kullanıcı bilgilerini getir
app.get('/api/auth/me', (req, res) => {
    // Kimlik doğrulama devre dışı: anonim kullanıcı döndür
    res.json({ ok: true, user: null });
});

// Sistem istatistikleri
app.get('/api/auth/stats', async (req, res) => {
    try {
        const userCount = await getUserCount();
        res.json({
            ok: true,
            stats: {
                total_users: userCount,
                system_status: 'online'
            }
        });
    } catch (error) {
        console.error('❌ İstatistik hatası:', error);
        res.status(500).json({
            ok: false,
            error: 'İstatistik alınırken hata oluştu'
        });
    }
});

// Frontend servis etme
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// CRON: Her gün 00:10'da (TR) dünü çek ve kaydet - ASKIYA ALINDI
/*
if ((USERNAME && PASSWORD) || TGT_TOKEN) {
    cron.schedule('10 0 * * *', async () => {
        const d = new Date(Date.now() - 24 * 3600 * 1000); // dün
        const date = d.toISOString().slice(0, 10);
        try {
            console.log(`⏰ [CRON] ${date} günlük EPİAŞ verisi çekiliyor...`);
            const out = await refreshInterimMcpDaily(USERNAME, PASSWORD, date, {
                providedTgt: TGT_TOKEN
            });
            await saveDaily(out);
            console.log(`✅ [CRON] ${date} OK – items:${out.count} avg:${out.avg}`);
        } catch (e) {
            console.error('❌ [CRON ERROR]', e?.message || e);
        }
    }, { timezone: 'Europe/Istanbul' });
    
    console.log('⏰ CRON job başlatıldı: Her gün 00:10 TR saatinde otomatik EPİAŞ veri çekme');
    if (TGT_TOKEN) {
        console.log('🔑 TGT token kullanılacak');
    }
} else {
    console.log('⚠️ EPİAŞ kimlik bilgileri eksik - CRON job devre dışı');
}
*/

// Server başlatma
app.listen(PORT, () => {
    console.log(`🚀 Solar Batarya API Server çalışıyor:`);
    console.log(`   🌐 Frontend: http://localhost:${PORT}`);
    console.log(`   📊 API: http://localhost:${PORT}/api/health`);
    console.log(`   📈 EPİAŞ: http://localhost:${PORT}/api/epias-data`);
    console.log(`   🔄 EPİAŞ Refresh: http://localhost:${PORT}/api/refresh/epias`);
    console.log(`   📊 EPİAŞ Günlük: http://localhost:${PORT}/api/epias/daily/YYYY-MM-DD`);
});

module.exports = app;
