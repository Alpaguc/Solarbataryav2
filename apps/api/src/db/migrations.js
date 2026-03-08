const { run, get } = require("./connection");

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
    user_id INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    location TEXT NOT NULL,
    installed_power_kw REAL,
    description TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
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
  `,
  `
  CREATE TABLE IF NOT EXISTS battery_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    source TEXT NOT NULL DEFAULT 'catalog',
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    chemistry TEXT NOT NULL DEFAULT 'LFP',
    nominal_capacity_kwh REAL NOT NULL,
    max_charge_power_kw REAL NOT NULL,
    max_discharge_power_kw REAL NOT NULL,
    charge_efficiency REAL NOT NULL DEFAULT 0.95,
    discharge_efficiency REAL NOT NULL DEFAULT 0.95,
    min_soc REAL NOT NULL DEFAULT 0.1,
    max_soc REAL NOT NULL DEFAULT 0.9,
    calendar_degradation_pct_per_year REAL NOT NULL DEFAULT 2.0,
    cycle_life_json TEXT,
    efficiency_curve_json TEXT,
    cost_per_kwh_try REAL,
    annual_maintenance_try REAL,
    scrap_value_pct REAL DEFAULT 0.1,
    raw_btr_json TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS project_simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    battery_catalog_id INTEGER,
    pvsyst_filename TEXT,
    pvsyst_data_json TEXT,
    epias_data_json TEXT,
    ac_max_power_kw REAL,
    dc_power_kw REAL,
    grid_limit_kw REAL,
    strategy_type TEXT NOT NULL DEFAULT 'price_threshold',
    strategy_params_json TEXT,
    financial_params_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    result_summary_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (battery_catalog_id) REFERENCES battery_catalog(id) ON DELETE SET NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS sim_hourly_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id INTEGER NOT NULL,
    hour_index INTEGER NOT NULL,
    timestamp_utc TEXT NOT NULL,
    dc_kw REAL NOT NULL DEFAULT 0,
    ac_kw REAL NOT NULL DEFAULT 0,
    clipping_kw REAL NOT NULL DEFAULT 0,
    charge_kw REAL NOT NULL DEFAULT 0,
    discharge_kw REAL NOT NULL DEFAULT 0,
    soc_pct REAL NOT NULL DEFAULT 0,
    price_try_mwh REAL NOT NULL DEFAULT 0,
    revenue_try REAL NOT NULL DEFAULT 0,
    cumulative_revenue_try REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (simulation_id) REFERENCES project_simulations(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_battery_catalog_user ON battery_catalog (user_id, source);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_project_simulations_project ON project_simulations (project_id);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_sim_hourly_sim ON sim_hourly_results (simulation_id, hour_index);
  `
];

async function migrateProjectsTableToMultiProject() {
  const schema = await get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'"
  );

  if (!schema || !schema.sql) return;

  const hasUniqueOnUserId =
    /user_id\s+INTEGER\s+NOT\s+NULL\s+UNIQUE/i.test(schema.sql) ||
    (/UNIQUE\s*\(\s*user_id\s*\)/i.test(schema.sql));

  if (!hasUniqueOnUserId) return;

  await run(`
    CREATE TABLE IF NOT EXISTS projects_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT NOT NULL,
      location TEXT NOT NULL,
      installed_power_kw REAL,
      description TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    INSERT OR IGNORE INTO projects_v2 (id, user_id, project_name, location, installed_power_kw, description, created_at)
    SELECT id, user_id, project_name, location, installed_power_kw, description, created_at
    FROM projects
    WHERE NOT EXISTS (SELECT 1 FROM projects_v2 WHERE projects_v2.id = projects.id)
  `);

  await run(`DROP TABLE projects`);
  await run(`ALTER TABLE projects_v2 RENAME TO projects`);
  await run(`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id)`);

  console.log("Projects tablosu coklu proje destekleyecek sekilde guncellendi.");
}

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    await run(sql);
  }

  const opsiyonelMigrations = [
    "ALTER TABLE simulation_runs ADD COLUMN user_id INTEGER",
    "ALTER TABLE simulation_runs ADD COLUMN project_id INTEGER",
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    "ALTER TABLE users ADD COLUMN supabase_id TEXT",
    "ALTER TABLE users ADD COLUMN total_projects_created INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"
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

  await migrateProjectsTableToMultiProject();
}

module.exports = {
  runMigrations
};
