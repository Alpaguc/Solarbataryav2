const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "../../../..");
const RAW_CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  process.env.CORS_ORIGINS ||
  "http://localhost:5173";
const CORS_ORIGINS = RAW_CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.API_PORT || process.env.PORT || 3001),
  CORS_ORIGIN: CORS_ORIGINS[0] || "http://localhost:5173",
  CORS_ORIGINS,
  DB_PATH: process.env.DB_PATH || path.join(ROOT_DIR, "data", "solarbatarya.db"),
  JWT_SECRET: process.env.JWT_SECRET || "solarbatarya-v2-gizli-anahtar",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  ADMIN_FULL_NAME: process.env.ADMIN_FULL_NAME || "Local Admin",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@solarbatarya.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin12345!"
};
