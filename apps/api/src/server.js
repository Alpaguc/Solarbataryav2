require("dotenv").config();

const app = require("./app");
const { PORT } = require("./config/env");
const { runMigrations } = require("./db/migrations");
const { seedCatalog } = require("./db/seedCatalog");
const { ensureAdminUser } = require("./db/ensureAdmin");
const { seedDefaultSettings } = require("./services/adminService");

async function bootstrap() {
  await runMigrations();
  await seedCatalog();
  const adminUserId = await ensureAdminUser();
  await seedDefaultSettings(adminUserId);

  app.listen(PORT, () => {
    console.log(`SolarBatarya API hazir: http://localhost:${PORT}`);
    if (adminUserId) {
      console.log("Admin hesabi kontrol edildi ve hazirlandi.");
    }
  });
}

bootstrap().catch((err) => {
  console.error("API baslatma hatasi:", err);
  process.exit(1);
});
