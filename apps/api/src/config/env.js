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
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  EPIAS_MCP_V1_URL:
    process.env.EPIAS_MCP_V1_URL ||
    "https://seffaflik.epias.com.tr/electricity-service/v1/markets/dam/data/mcp",
  EPIAS_SERVICE_URL:
    process.env.EPIAS_SERVICE_URL ||
    "https://seffaflik.epias.com.tr/transparency/service/market/day-ahead-mcp",
  EPIAS_AUTH_URL: process.env.EPIAS_AUTH_URL || "https://giris.epias.com.tr/cas/v1/tickets",
  EPIAS_USERNAME: process.env.EPIAS_USERNAME || "",
  EPIAS_PASSWORD: process.env.EPIAS_PASSWORD || "",
  EPIAS_ALLOW_PUBLIC_FALLBACK: String(process.env.EPIAS_ALLOW_PUBLIC_FALLBACK || "false").toLowerCase() === "true",
  EPIAS_REQUEST_TIMEOUT_MS: Number(process.env.EPIAS_REQUEST_TIMEOUT_MS || 60000),
  ADMIN_FULL_NAME: process.env.ADMIN_FULL_NAME || "Local Admin",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@solarbatarya.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin12345!"
};
