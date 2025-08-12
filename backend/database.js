const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'solar-data.db');

// Veritabanı bağlantısı
let db = null;

function getDatabase() {
    if (!db) {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ SQLite bağlantı hatası:', err.message);
            } else {
                console.log('✅ SQLite veritabanına bağlandı:', DB_PATH);
            }
        });
    }
    return db;
}

// Veritabanını başlatma
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS epias_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Tarih TEXT NOT NULL,
                Saat TEXT NOT NULL,
                "PTF (TL/MWh)" REAL NOT NULL,
                "PTF (USD/MWh)" REAL,
                "PTF (EUR/MWh)" REAL
            )
        `;
        
        database.run(createTableQuery, (err) => {
            if (err) {
                console.error('❌ Tablo oluşturma hatası:', err);
                reject(err);
            } else {
                console.log('✅ epias_prices tablosu hazır');
                
                // Kullanıcı tablosunu oluştur
                database.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Users tablo hatası:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ users tablosu hazır');
                    
                    // Index oluştur (performans için)
                    database.run(`CREATE INDEX IF NOT EXISTS idx_epias_date_time ON epias_prices (Tarih, Saat)`, (err) => {
                        if (err) {
                            console.warn('⚠️ Index oluşturma uyarısı:', err);
                        } else {
                            console.log('✅ Veritabanı indeksleri hazır');
                        }
                        resolve();
                    });
                });
            }
        });
    });
}

// EPİAŞ verilerini JavaScript dosyasından veritabanına aktarma
async function importEpiasData() {
    return new Promise(async (resolve, reject) => {
        try {
            // Önce veritabanını initialize et
            await initializeDatabase();
            // JavaScript dosyasını require ile yükle
            const epiasPath = path.join(__dirname, '..', 'epias-full-data.js');
            
            if (!fs.existsSync(epiasPath)) {
                reject(new Error('epias-full-data.js dosyası bulunamadı'));
                return;
            }
            
            // Dosyayı oku ve parse et
            let epiasContent = fs.readFileSync(epiasPath, 'utf8');
            
            // EPIAS_FULL_DATA array'ini extract et
            const match = epiasContent.match(/const EPIAS_FULL_DATA = (\[[\s\S]*?\]);/);
            if (!match) {
                reject(new Error('EPIAS_FULL_DATA array bulunamadı'));
                return;
            }
            
            const epiasArray = JSON.parse(match[1]);
            console.log(`📊 JavaScript'ten ${epiasArray.length} EPİAŞ kaydı okundu`);
            
            const database = getDatabase();
            
            // Önce mevcut verileri kontrol et
            database.get('SELECT COUNT(*) as count FROM epias_prices', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (row.count > 0) {
                    console.log(`ℹ️ Veritabanında zaten ${row.count} kayıt var, aktarım atlanıyor`);
                    resolve({
                        message: 'Veri zaten mevcut',
                        existingRecords: row.count,
                        imported: 0
                    });
                    return;
                }
                
                // Bulk insert için prepare statement
                const insertStmt = database.prepare(`
                    INSERT OR IGNORE INTO epias_prices (Tarih, Saat, "PTF (TL/MWh)", "PTF (USD/MWh)", "PTF (EUR/MWh)")
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                let imported = 0;
                const batchSize = 1000;
                
                database.serialize(() => {
                    database.run('BEGIN TRANSACTION');
                    
                    try {
                        for (let i = 0; i < epiasArray.length; i++) {
                            const record = epiasArray[i];
                            
                            // Orijinal formatı koru: DD.MM.YYYY
                            insertStmt.run([
                                record.Tarih, 
                                record.Saat, 
                                record['PTF (TL/MWh)'], 
                                record['PTF (USD/MWh)'] || null,
                                record['PTF (EUR/MWh)'] || null
                            ], (err) => {
                                if (!err) {
                                    imported++;
                                }
                            });
                            
                            // Progress log
                            if ((i + 1) % batchSize === 0) {
                                console.log(`📥 İşlendi: ${i + 1}/${epiasArray.length} (${Math.round((i + 1) / epiasArray.length * 100)}%)`);
                            }
                        }
                        
                        insertStmt.finalize((err) => {
                            if (err) {
                                console.error('❌ Insert finalize hatası:', err);
                                database.run('ROLLBACK', (rollbackErr) => {
                                    if (rollbackErr) console.error('❌ Rollback hatası:', rollbackErr);
                                    reject(err);
                                });
                            } else {
                                database.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        console.error('❌ Commit hatası:', commitErr);
                                        reject(commitErr);
                                    } else {
                                        console.log(`✅ ${epiasArray.length} EPİAŞ kaydı başarıyla aktarıldı`);
                                        resolve({
                                            message: 'Veri aktarımı tamamlandı',
                                            imported: epiasArray.length,
                                            total: epiasArray.length
                                        });
                                    }
                                });
                            }
                        });
                        
                    } catch (error) {
                        database.run('ROLLBACK');
                        reject(error);
                    }
                });
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

// Tarih aralığındaki EPİAŞ verilerini çekme
async function getEpiasData(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        
        const query = `
            SELECT Tarih, Saat, "PTF (TL/MWh)", "PTF (USD/MWh)", "PTF (EUR/MWh)"
            FROM epias_prices
            WHERE substr(Tarih, 7, 4) || substr(Tarih, 4, 2) || substr(Tarih, 1, 2) BETWEEN ? AND ?
            ORDER BY Tarih, Saat
        `;
        
        const formattedStartDate = startDate.replace(/-/g, '');
        const formattedEndDate = endDate.replace(/-/g, '');

        database.all(query, [formattedStartDate, formattedEndDate], (err, rows) => {
            if (err) {
                console.error('Veri çekme hatası:', err.message);
                reject(err);
            } else {
                console.log(`📊 Veritabanından ${rows.length} kayıt çekildi (${startDate} - ${endDate})`);
                resolve(rows);
            }
        });
    });
}

// Mevcut veri tarih aralığını öğrenme
async function getDateRange() {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        
        const query = `
            SELECT 
                MIN(date) as min_date,
                MAX(date) as max_date,
                COUNT(*) as total_records
            FROM epias_prices
        `;
        
        database.get(query, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    startDate: row.min_date,
                    endDate: row.max_date,
                    totalRecords: row.total_records
                });
            }
        });
    });
}

// YYYY-MM-DD formatını DD.MM.YYYY'ye çevirme
function formatDateToDDMMYYYY(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
}

// Veritabanını kapatma
function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('❌ Veritabanı kapatma hatası:', err);
            } else {
                console.log('✅ Veritabanı bağlantısı kapatıldı');
            }
        });
    }
}

// === KULLANICI YÖNETİM FONKSİYONLARI ===

// Yeni kullanıcı kayıt
async function createUser(username, email, passwordHash) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`;
        db.run(sql, [username, email, passwordHash], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    reject(new Error('Bu kullanıcı adı veya e-posta zaten kayıtlı'));
                } else {
                    reject(err);
                }
            } else {
                resolve({ 
                    id: this.lastID, 
                    username, 
                    email,
                    created_at: new Date().toISOString()
                });
            }
        });
    });
}

// Kullanıcı giriş - username veya email ile
async function getUserByCredential(credential) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM users WHERE username = ? OR email = ?`;
        db.get(sql, [credential, credential], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Kullanıcı ID ile getir
async function getUserById(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, username, email, created_at, last_login FROM users WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Son giriş zamanını güncelle
async function updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Kullanıcı sayısını getir
async function getUserCount() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT COUNT(*) as count FROM users`;
        db.get(sql, [], (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
}

module.exports = {
    initializeDatabase,
    importEpiasData,
    getEpiasData,
    getDateRange,
    closeDatabase,
    // Kullanıcı fonksiyonları
    createUser,
    getUserByCredential,
    getUserById,
    updateLastLogin,
    getUserCount
};
