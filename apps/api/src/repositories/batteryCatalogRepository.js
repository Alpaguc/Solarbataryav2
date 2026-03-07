const { all, get } = require("../db/connection");

async function listBrands() {
  return all(
    `SELECT id, name, country
     FROM battery_brands
     WHERE is_active = 1
     ORDER BY name ASC`
  );
}

async function listModelsByBrand(brandId) {
  return all(
    `SELECT
      bm.id,
      bm.brand_id AS brandId,
      bb.name AS brandName,
      bm.name,
      bm.chemistry,
      bm.nominal_capacity_kwh AS nominalCapacityKwh,
      bm.nominal_power_kw AS nominalPowerKw,
      bm.round_trip_efficiency AS roundTripEfficiency,
      bm.min_soc AS minSoc,
      bm.max_soc AS maxSoc,
      bm.base_cost_try AS baseCostTry,
      bm.cycle_life_at_80_dod AS cycleLifeAt80Dod,
      bm.calendar_degradation_pct_per_year AS calendarDegradationPctPerYear
     FROM battery_models bm
     INNER JOIN battery_brands bb ON bb.id = bm.brand_id
     WHERE bm.brand_id = ?
     ORDER BY bm.name ASC`,
    [brandId]
  );
}

async function getModelById(modelId) {
  return get(
    `SELECT
      bm.id,
      bm.brand_id AS brandId,
      bb.name AS brandName,
      bm.name,
      bm.chemistry,
      bm.nominal_capacity_kwh,
      bm.nominal_power_kw,
      bm.round_trip_efficiency,
      bm.min_soc,
      bm.max_soc,
      bm.base_cost_try,
      bm.cycle_life_at_80_dod,
      bm.calendar_degradation_pct_per_year,
      bm.metadata_json
     FROM battery_models bm
     INNER JOIN battery_brands bb ON bb.id = bm.brand_id
     WHERE bm.id = ?`,
    [modelId]
  );
}

async function getSpecsByModelId(modelId) {
  return all(
    `SELECT dod_percent, expected_cycle_life, capacity_retention_end_of_life
     FROM battery_model_specs
     WHERE model_id = ?
     ORDER BY dod_percent ASC`,
    [modelId]
  );
}

module.exports = {
  listBrands,
  listModelsByBrand,
  getModelById,
  getSpecsByModelId
};
