const { get, run, all } = require("../db/connection");

const SECIM = `
  SELECT
    id,
    user_id AS userId,
    source,
    manufacturer,
    model,
    chemistry,
    nominal_capacity_kwh AS nominalCapacityKwh,
    max_charge_power_kw AS maxChargePowerKw,
    max_discharge_power_kw AS maxDischargePowerKw,
    charge_efficiency AS chargeEfficiency,
    discharge_efficiency AS dischargeEfficiency,
    min_soc AS minSoc,
    max_soc AS maxSoc,
    calendar_degradation_pct_per_year AS calendarDegradationPctPerYear,
    cycle_life_json AS cycleLifeJson,
    efficiency_curve_json AS efficiencyCurveJson,
    cost_per_kwh_try AS costPerKwhTry,
    annual_maintenance_try AS annualMaintenanceTry,
    scrap_value_pct AS scrapValuePct,
    raw_btr_json AS rawBtrJson,
    is_active AS isActive,
    created_at AS createdAt
  FROM battery_catalog
`;

function parseJson(val) {
  if (!val) return null;
  try { return JSON.parse(val); } catch (_e) { return null; }
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    cycleLifeJson: parseJson(row.cycleLifeJson),
    efficiencyCurveJson: parseJson(row.efficiencyCurveJson),
    rawBtrJson: parseJson(row.rawBtrJson)
  };
}

async function listCatalog() {
  const rows = await all(`${SECIM} WHERE source = 'catalog' AND is_active = 1 ORDER BY manufacturer, model`);
  return rows.map(mapRow);
}

async function listByUser(userId) {
  const rows = await all(
    `${SECIM} WHERE (source = 'catalog' OR user_id = ?) AND is_active = 1 ORDER BY source DESC, manufacturer, model`,
    [userId]
  );
  return rows.map(mapRow);
}

async function getById(id) {
  const row = await get(`${SECIM} WHERE id = ?`, [id]);
  return mapRow(row);
}

async function create({
  userId, source, manufacturer, model, chemistry,
  nominalCapacityKwh, maxChargePowerKw, maxDischargePowerKw,
  chargeEfficiency, dischargeEfficiency, minSoc, maxSoc,
  calendarDegradationPctPerYear, cycleLifeJson, efficiencyCurveJson,
  costPerKwhTry, annualMaintenanceTry, scrapValuePct, rawBtrJson
}) {
  const sonuc = await run(
    `INSERT INTO battery_catalog (
      user_id, source, manufacturer, model, chemistry,
      nominal_capacity_kwh, max_charge_power_kw, max_discharge_power_kw,
      charge_efficiency, discharge_efficiency, min_soc, max_soc,
      calendar_degradation_pct_per_year, cycle_life_json, efficiency_curve_json,
      cost_per_kwh_try, annual_maintenance_try, scrap_value_pct, raw_btr_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      userId || null, source || 'custom', manufacturer, model, chemistry || 'LFP',
      nominalCapacityKwh, maxChargePowerKw, maxDischargePowerKw,
      chargeEfficiency ?? 0.95, dischargeEfficiency ?? 0.95,
      minSoc ?? 0.1, maxSoc ?? 0.9,
      calendarDegradationPctPerYear ?? 2.0,
      cycleLifeJson ? JSON.stringify(cycleLifeJson) : null,
      efficiencyCurveJson ? JSON.stringify(efficiencyCurveJson) : null,
      costPerKwhTry || null, annualMaintenanceTry || null,
      scrapValuePct ?? 0.1,
      rawBtrJson ? JSON.stringify(rawBtrJson) : null
    ]
  );
  return getById(sonuc.lastID);
}

async function remove(id, userId) {
  const sonuc = await run(
    "UPDATE battery_catalog SET is_active = 0 WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  return sonuc.changes > 0;
}

module.exports = { listCatalog, listByUser, getById, create, remove };
