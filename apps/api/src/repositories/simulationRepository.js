const { run, get, all } = require("../db/connection");

async function createSimulationRun({ userId, projectId, batteryModelId, input, summary }) {
  const sonuc = await run(
    `INSERT INTO simulation_runs (user_id, project_id, battery_model_id, input_json, result_summary_json)
     VALUES (?, ?, ?, ?, ?)`,
    [userId || null, projectId || null, batteryModelId, JSON.stringify(input), JSON.stringify(summary)]
  );
  return sonuc.lastID;
}

async function saveHourlyResults(runId, hourlyResults) {
  if (!hourlyResults.length) return;

  await run("BEGIN TRANSACTION");
  try {
    let cumulative = 0;
    for (const satir of hourlyResults) {
      cumulative += Number(satir.revenueTry || 0);
      await run(
        `INSERT INTO simulation_hourly_results (
          run_id, hour_index, timestamp, soc_percent, capacity_kwh, charge_kwh, discharge_kwh, revenue_try, cumulative_revenue_try
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          satir.hourIndex,
          satir.timestamp,
          satir.socPercent,
          satir.capacityKwh,
          satir.chargeKwh,
          satir.dischargeKwh,
          satir.revenueTry,
          Number(cumulative.toFixed(4))
        ]
      );
    }
    await run("COMMIT");
  } catch (err) {
    await run("ROLLBACK");
    throw err;
  }
}

async function getSimulationRun(runId) {
  return get(
    `SELECT id, battery_model_id as batteryModelId, input_json as inputJson, result_summary_json as summaryJson, created_at as createdAt
     FROM simulation_runs
     WHERE id = ?`,
    [runId]
  );
}

async function listHourlyResults(runId) {
  return all(
    `SELECT
      hour_index as hourIndex,
      timestamp,
      soc_percent as socPercent,
      capacity_kwh as capacityKwh,
      charge_kwh as chargeKwh,
      discharge_kwh as dischargeKwh,
      revenue_try as revenueTry,
      cumulative_revenue_try as cumulativeRevenueTry
    FROM simulation_hourly_results
    WHERE run_id = ?
    ORDER BY hour_index ASC`,
    [runId]
  );
}

module.exports = {
  createSimulationRun,
  saveHourlyResults,
  getSimulationRun,
  listHourlyResults
};
