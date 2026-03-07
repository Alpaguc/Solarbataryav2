const test = require("node:test");
const assert = require("node:assert/strict");
const { runMigrations } = require("../src/db/migrations");
const { seedCatalog } = require("../src/db/seedCatalog");
const { run, get } = require("../src/db/connection");
const simulationService = require("../src/services/simulationService");
const batteryRepository = require("../src/repositories/batteryCatalogRepository");

test("servis simulasyonu calistirir ve runId doner", async () => {
  await runMigrations();
  await seedCatalog();

  const markalar = await batteryRepository.listBrands();
  assert.ok(markalar.length > 0);

  const modeller = await batteryRepository.listModelsByBrand(markalar[0].id);
  assert.ok(modeller.length > 0);

  await run("INSERT OR IGNORE INTO users (full_name, email, password_hash) VALUES (?, ?, ?)", [
    "Test Kullanici",
    "test@solar.local",
    "hash"
  ]);
  const user = await get("SELECT id FROM users WHERE email = ?", ["test@solar.local"]);
  await run(
    "INSERT OR IGNORE INTO projects (user_id, project_name, location, installed_power_kw, description) VALUES (?, ?, ?, ?, ?)",
    [user.id, "Test Projesi", "Ankara", 1000, "otomatik test"]
  );
  const project = await get("SELECT id FROM projects WHERE user_id = ?", [user.id]);

  const sonuc = await simulationService.runSimulation({
    projectId: project.id,
    batteryModelId: modeller[0].id,
    solarProfileCode: "ic_anadolu_ges",
    tariffProfileCode: "sanayi_gunluk",
    projectYears: 2,
    dailyChargeTargetSoc: 0.9,
    dailyDischargeTargetSoc: 0.2,
    annualMaintenanceCostTry: 15000
  }, { userId: user.id });

  assert.ok(sonuc.runId > 0);
  assert.ok(typeof sonuc.summary.extraRevenueTry === "number");
});
