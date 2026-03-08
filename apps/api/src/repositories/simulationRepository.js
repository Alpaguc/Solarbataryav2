const { get, run, all } = require("../db/connection");

function parseJson(val) {
  if (!val) return null;
  try { return JSON.parse(val); } catch (_e) { return null; }
}

async function createSimulation({ projectId, userId, batteryCatalogId, pvsystFilename, pvsystDataJson, epiasDataJson, acMaxPowerKw, dcPowerKw, gridLimitKw, strategyType, strategyParamsJson, financialParamsJson }) {
  const sonuc = await run(
    `INSERT INTO project_simulations
      (project_id, user_id, battery_catalog_id, pvsyst_filename, pvsyst_data_json, epias_data_json,
       ac_max_power_kw, dc_power_kw, grid_limit_kw, strategy_type, strategy_params_json,
       financial_params_json, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'running')`,
    [
      projectId, userId, batteryCatalogId || null,
      pvsystFilename || null,
      pvsystDataJson ? JSON.stringify(pvsystDataJson) : null,
      epiasDataJson ? JSON.stringify(epiasDataJson) : null,
      acMaxPowerKw || null, dcPowerKw || null, gridLimitKw || null,
      strategyType || 'price_threshold',
      strategyParamsJson ? JSON.stringify(strategyParamsJson) : null,
      financialParamsJson ? JSON.stringify(financialParamsJson) : null
    ]
  );
  return sonuc.lastID;
}

async function updateSimulationResult(id, resultSummaryJson, status = 'done', errorMessage = null) {
  await run(
    `UPDATE project_simulations
     SET status = ?, result_summary_json = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, resultSummaryJson ? JSON.stringify(resultSummaryJson) : null, errorMessage, id]
  );
}

async function getSimulationById(id, userId) {
  const row = await get(
    `SELECT id, project_id AS projectId, user_id AS userId, battery_catalog_id AS batteryCatalogId,
            pvsyst_filename AS pvsystFilename, ac_max_power_kw AS acMaxPowerKw,
            dc_power_kw AS dcPowerKw, grid_limit_kw AS gridLimitKw,
            strategy_type AS strategyType, strategy_params_json AS strategyParamsJson,
            financial_params_json AS financialParamsJson,
            status, error_message AS errorMessage, result_summary_json AS resultSummaryJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM project_simulations WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  if (!row) return null;
  return {
    ...row,
    strategyParamsJson: parseJson(row.strategyParamsJson),
    financialParamsJson: parseJson(row.financialParamsJson),
    resultSummaryJson: parseJson(row.resultSummaryJson)
  };
}

async function listSimulationsByProject(projectId, userId) {
  const rows = await all(
    `SELECT id, project_id AS projectId, battery_catalog_id AS batteryCatalogId,
            pvsyst_filename AS pvsystFilename, strategy_type AS strategyType,
            status, created_at AS createdAt
     FROM project_simulations WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC`,
    [projectId, userId]
  );
  return rows;
}

async function insertHourlyResults(simulationId, hourlyData) {
  const BATCH = 500;
  for (let start = 0; start < hourlyData.length; start += BATCH) {
    const batch = hourlyData.slice(start, start + BATCH);
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const values = [];
    for (const h of batch) {
      values.push(
        simulationId,
        h.hourIndex,
        h.hourIndex.toString(),
        h.dcKw ?? 0,
        h.acKw ?? 0,
        h.clippingKw ?? 0,
        h.chargeKw ?? 0,
        h.dischargeKw ?? 0,
        h.socPct ?? 0,
        h.priceTryMwh ?? 0,
        h.revenueTry ?? 0,
        h.cumulativeRevenueTry ?? 0
      );
    }
    await run(
      `INSERT INTO sim_hourly_results
        (simulation_id, hour_index, timestamp_utc, dc_kw, ac_kw, clipping_kw,
         charge_kw, discharge_kw, soc_pct, price_try_mwh, revenue_try, cumulative_revenue_try)
       VALUES ${placeholders}`,
      values
    );
  }
}

async function getHourlyResults(simulationId, offset = 0, limit = 168) {
  const rows = await all(
    `SELECT hour_index AS hourIndex, dc_kw AS dcKw, ac_kw AS acKw, clipping_kw AS clippingKw,
            charge_kw AS chargeKw, discharge_kw AS dischargeKw, soc_pct AS socPct,
            price_try_mwh AS priceTryMwh, revenue_try AS revenueTry,
            cumulative_revenue_try AS cumulativeRevenueTry
     FROM sim_hourly_results WHERE simulation_id = ?
     ORDER BY hour_index LIMIT ? OFFSET ?`,
    [simulationId, limit, offset]
  );
  return rows;
}

async function deleteSimulation(id, userId) {
  const sonuc = await run(
    "DELETE FROM project_simulations WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  return sonuc.changes > 0;
}

module.exports = {
  createSimulation,
  updateSimulationResult,
  getSimulationById,
  listSimulationsByProject,
  insertHourlyResults,
  getHourlyResults,
  deleteSimulation
};
