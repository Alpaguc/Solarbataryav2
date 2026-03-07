const { run, get } = require("./connection");
const { runMigrations } = require("./migrations");

const BATARYA_MARKALARI = [
  { name: "EnerSakla", country: "TR" },
  { name: "VoltAnadolu", country: "TR" },
  { name: "GlobalCell", country: "DE" }
];

const BATARYA_MODELLERI = [
  {
    brandName: "EnerSakla",
    name: "ES-500",
    chemistry: "LFP",
    nominal_capacity_kwh: 500,
    nominal_power_kw: 250,
    round_trip_efficiency: 0.91,
    min_soc: 0.1,
    max_soc: 0.95,
    base_cost_try: 7800000,
    cycle_life_at_80_dod: 6500,
    calendar_degradation_pct_per_year: 1.4,
    specs: [
      { dod_percent: 60, expected_cycle_life: 9500, capacity_retention_end_of_life: 80 },
      { dod_percent: 80, expected_cycle_life: 6500, capacity_retention_end_of_life: 80 },
      { dod_percent: 90, expected_cycle_life: 4800, capacity_retention_end_of_life: 80 }
    ]
  },
  {
    brandName: "VoltAnadolu",
    name: "VA-750",
    chemistry: "LFP",
    nominal_capacity_kwh: 750,
    nominal_power_kw: 375,
    round_trip_efficiency: 0.9,
    min_soc: 0.1,
    max_soc: 0.95,
    base_cost_try: 11200000,
    cycle_life_at_80_dod: 6200,
    calendar_degradation_pct_per_year: 1.6,
    specs: [
      { dod_percent: 60, expected_cycle_life: 9000, capacity_retention_end_of_life: 80 },
      { dod_percent: 80, expected_cycle_life: 6200, capacity_retention_end_of_life: 80 },
      { dod_percent: 90, expected_cycle_life: 4500, capacity_retention_end_of_life: 80 }
    ]
  },
  {
    brandName: "GlobalCell",
    name: "GC-1000",
    chemistry: "NMC",
    nominal_capacity_kwh: 1000,
    nominal_power_kw: 500,
    round_trip_efficiency: 0.89,
    min_soc: 0.08,
    max_soc: 0.93,
    base_cost_try: 14600000,
    cycle_life_at_80_dod: 5400,
    calendar_degradation_pct_per_year: 2.1,
    specs: [
      { dod_percent: 60, expected_cycle_life: 7600, capacity_retention_end_of_life: 78 },
      { dod_percent: 80, expected_cycle_life: 5400, capacity_retention_end_of_life: 78 },
      { dod_percent: 90, expected_cycle_life: 3900, capacity_retention_end_of_life: 78 }
    ]
  }
];

const TARIFE_PROFILLERI = [
  {
    code: "sanayi_gunluk",
    name: "Sanayi - Saatlik Dinamik Tarife",
    hourly: [1300, 1200, 1100, 1020, 980, 950, 930, 940, 1040, 1200, 1350, 1450, 1550, 1700, 1860, 2050, 2250, 2400, 2520, 2600, 2320, 2050, 1780, 1500]
  },
  {
    code: "ticari_gunluk",
    name: "Ticari - Saatlik Dinamik Tarife",
    hourly: [1180, 1090, 1010, 960, 910, 890, 870, 900, 1000, 1130, 1250, 1360, 1460, 1590, 1740, 1900, 2090, 2210, 2290, 2360, 2120, 1870, 1620, 1360]
  }
];

const GUNES_PROFILLERI = [
  {
    code: "ic_anadolu_ges",
    name: "Ic Anadolu Tipik GES Uretim Profili",
    location: "Ankara",
    hourly: [0, 0, 0, 0, 4, 18, 35, 58, 74, 88, 95, 98, 92, 80, 63, 42, 24, 8, 1, 0, 0, 0, 0, 0]
  },
  {
    code: "ege_ges",
    name: "Ege Tipik GES Uretim Profili",
    location: "Izmir",
    hourly: [0, 0, 0, 0, 6, 24, 45, 68, 84, 98, 105, 108, 102, 91, 72, 50, 30, 12, 2, 0, 0, 0, 0, 0]
  }
];

async function markaIdGetir(brandName) {
  const row = await get("SELECT id FROM battery_brands WHERE name = ?", [brandName]);
  return row?.id;
}

async function modelIdGetir(brandId, modelName) {
  const row = await get("SELECT id FROM battery_models WHERE brand_id = ? AND name = ?", [brandId, modelName]);
  return row?.id;
}

async function seedCatalog() {
  await runMigrations();

  for (const marka of BATARYA_MARKALARI) {
    await run(
      "INSERT OR IGNORE INTO battery_brands (name, country, is_active) VALUES (?, ?, 1)",
      [marka.name, marka.country]
    );
  }

  for (const model of BATARYA_MODELLERI) {
    const brandId = await markaIdGetir(model.brandName);
    if (!brandId) continue;

    await run(
      `INSERT OR IGNORE INTO battery_models (
        brand_id, name, chemistry, nominal_capacity_kwh, nominal_power_kw, round_trip_efficiency,
        min_soc, max_soc, base_cost_try, cycle_life_at_80_dod, calendar_degradation_pct_per_year, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        brandId,
        model.name,
        model.chemistry,
        model.nominal_capacity_kwh,
        model.nominal_power_kw,
        model.round_trip_efficiency,
        model.min_soc,
        model.max_soc,
        model.base_cost_try,
        model.cycle_life_at_80_dod,
        model.calendar_degradation_pct_per_year,
        JSON.stringify({ varsayilan: true })
      ]
    );

    const modelId = await modelIdGetir(brandId, model.name);
    if (!modelId) continue;

    for (const spec of model.specs) {
      await run(
        `INSERT OR IGNORE INTO battery_model_specs (model_id, dod_percent, expected_cycle_life, capacity_retention_end_of_life)
         VALUES (?, ?, ?, ?)`,
        [modelId, spec.dod_percent, spec.expected_cycle_life, spec.capacity_retention_end_of_life]
      );
    }
  }

  for (const tarife of TARIFE_PROFILLERI) {
    await run(
      `INSERT OR IGNORE INTO tariff_profiles (code, name, currency, hourly_price_json) VALUES (?, ?, 'TRY/MWh', ?)`,
      [tarife.code, tarife.name, JSON.stringify(tarife.hourly)]
    );
  }

  for (const profil of GUNES_PROFILLERI) {
    await run(
      `INSERT OR IGNORE INTO solar_profiles (code, name, location, hourly_generation_json) VALUES (?, ?, ?, ?)`,
      [profil.code, profil.name, profil.location, JSON.stringify(profil.hourly)]
    );
  }
}

if (require.main === module) {
  seedCatalog()
    .then(() => {
      console.log("Katalog seed islemi tamamlandi.");
    })
    .catch((err) => {
      console.error("Seed hatasi:", err);
      process.exitCode = 1;
    });
}

module.exports = {
  seedCatalog
};
