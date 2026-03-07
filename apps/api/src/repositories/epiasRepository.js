const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const ROOT_DIR = path.resolve(__dirname, "../../../..");
const LEGACY_EPIAS_DB_PATH = path.join(ROOT_DIR, "solar-data.db");

let legacyDb;

function getLegacyDb() {
  if (legacyDb) {
    return legacyDb;
  }

  if (!fs.existsSync(LEGACY_EPIAS_DB_PATH)) {
    const err = new Error("EPİAŞ veritabani dosyasi bulunamadi (solar-data.db).");
    err.statusCode = 404;
    throw err;
  }

  legacyDb = new sqlite3.Database(LEGACY_EPIAS_DB_PATH, sqlite3.OPEN_READONLY);
  return legacyDb;
}

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    getLegacyDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    getLegacyDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function verifyEpiasTable() {
  const row = await getRow(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'epias_prices' LIMIT 1"
  );
  if (!row) {
    const err = new Error("EPİAŞ tablosu bulunamadi (epias_prices).");
    err.statusCode = 404;
    throw err;
  }
}

async function listEpiasDataByDateRange(startDate, endDate) {
  await verifyEpiasTable();
  const baslangic = String(startDate).replace(/-/g, "");
  const bitis = String(endDate).replace(/-/g, "");

  return getAllRows(
    `SELECT
      Tarih,
      Saat,
      AVG("PTF (TL/MWh)") as "PTF (TL/MWh)",
      AVG("PTF (USD/MWh)") as "PTF (USD/MWh)",
      AVG("PTF (EUR/MWh)") as "PTF (EUR/MWh)"
    FROM epias_prices
    WHERE substr(Tarih, 7, 4) || substr(Tarih, 4, 2) || substr(Tarih, 1, 2) BETWEEN ? AND ?
    GROUP BY Tarih, Saat
    ORDER BY Tarih ASC, Saat ASC`,
    [baslangic, bitis]
  );
}

module.exports = {
  listEpiasDataByDateRange
};
