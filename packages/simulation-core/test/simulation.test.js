const test = require("node:test");
const assert = require("node:assert/strict");
const { simulasyonCalistir } = require("../src");

test("simulasyon kapasiteyi zamanla dusurur ve ozet doner", () => {
  const sonuc = simulasyonCalistir({
    girdi: {
      projectYears: 2,
      dailyChargeTargetSoc: 0.9,
      dailyDischargeTargetSoc: 0.2,
      annualMaintenanceCostTry: 10000
    },
    bataryaModeli: {
      nominal_capacity_kwh: 500,
      nominal_power_kw: 250,
      round_trip_efficiency: 0.9,
      min_soc: 0.1,
      max_soc: 0.95,
      cycle_life_at_80_dod: 6000,
      calendar_degradation_pct_per_year: 1.5,
      base_cost_try: 8000000
    },
    gunesProfiliSaatlikKwh: [0, 0, 0, 0, 5, 20, 40, 60, 75, 90, 95, 100, 92, 80, 60, 40, 20, 8, 1, 0, 0, 0, 0, 0],
    tarifeProfiliSaatlikTryMwh: [1200, 1100, 1000, 980, 950, 900, 860, 840, 900, 1000, 1100, 1250, 1300, 1400, 1500, 1650, 1800, 1950, 2050, 2100, 1900, 1700, 1500, 1300]
  });

  assert.ok(sonuc.summary.finalCapacityKwh < 500);
  assert.ok(Array.isArray(sonuc.series.monthlyCapacity));
  assert.ok(sonuc.series.monthlyCapacity.length > 0);
  assert.ok(Array.isArray(sonuc.hourlyResults));
});
