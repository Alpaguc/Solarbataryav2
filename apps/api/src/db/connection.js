const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { DB_PATH } = require("../config/env");

let db;

function getDb() {
  if (db) {
    return db;
  }

  const dizin = path.dirname(DB_PATH);
  if (!fs.existsSync(dizin)) {
    fs.mkdirSync(dizin, { recursive: true });
  }

  db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = WAL;");
  });

  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function calistirHatasi(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

module.exports = {
  getDb,
  run,
  all,
  get
};
