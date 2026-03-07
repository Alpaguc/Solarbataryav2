const { run } = require("./connection");

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS battery_brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    country TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    project_name TEXT NOT NULL,
    location TEXT NOT NULL,
    installed_power_kw REAL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS battery_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    chemistry TEXT NOT NULL,
    nominal_capacity_kwh REAL NOT NULL,
    nominal_power_kw REAL NOT NULL,
    round_trip_efficiency REAL NOT NULL,
    min_soc REAL NOT NULL,
    max_soc REAL NOT NULL,
    base_cost_try REAL NOT NULL,
    cycle_life_at_80_dod REAL NOT NULL,
    calendar_degradation_pct_per_year REAL NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES battery_brands(id) ON DELETE CASCADE,
    UNIQUE (brand_id, name)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS battery_model_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    dod_percent REAL NOT NULL,
    expected_cycle_life REAL NOT NULL,
    capacity_retention_end_of_life REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES battery_models(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS tariff_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY/MWh',
    hourly_price_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS solar_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    hourly_generation_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS simulation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    project_id INTEGER,
    battery_model_id INTEGER NOT NULL,
    input_json TEXT NOT NULL,
    result_summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (battery_model_id) REFERENCES battery_models(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS simulation_hourly_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    hour_index INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    soc_percent REAL NOT NULL,
    capacity_kwh REAL NOT NULL,
    charge_kwh REAL NOT NULL,
    discharge_kwh REAL NOT NULL,
    revenue_try REAL NOT NULL,
    cumulative_revenue_try REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_models_brand ON battery_models (brand_id);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_specs_model ON battery_model_specs (model_id);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_simulation_hourly_run ON simulation_hourly_results (run_id, hour_index);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_settings_key ON app_settings (setting_key);
  `
];

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    await run(sql);
  }

  const opsiyonelMigrations = [
    "ALTER TABLE simulation_runs ADD COLUMN user_id INTEGER",
    "ALTER TABLE simulation_runs ADD COLUMN project_id INTEGER",
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"
  ];

  for (const sql of opsiyonelMigrations) {
    try {
      await run(sql);
    } catch (err) {
      const mesaj = String(err?.message || "");
      if (!mesaj.includes("duplicate column name")) {
        throw err;
      }
    }
  }
}

module.exports = {
  runMigrations
};
