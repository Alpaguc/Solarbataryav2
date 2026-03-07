require("dotenv").config();

const { runMigrations } = require("../db/migrations");
const { ensureAdminUser } = require("../db/ensureAdmin");
const { seedDefaultSettings } = require("../services/adminService");
const { ADMIN_EMAIL } = require("../config/env");

async function main() {
  await runMigrations();
  const adminId = await ensureAdminUser();
  await seedDefaultSettings(adminId);
  console.log(`Admin hazir: ${ADMIN_EMAIL}`);
}

main().catch((err) => {
  console.error("Admin hazirlama hatasi:", err);
  process.exit(1);
});
