const { simulasyonCalistir } = require("@solarbatarya/simulation-core");

/**
 * Legacy'de agirlikli olarak sabit kapasite yaklasimi kullaniliyordu.
 * Bu script ayni giris icin V2 (yaslanma dahil) sonucu ile kaba legacy yaklasimini karsilastirir.
 */
function legacyYaklasim({ baseRevenueTry, extraRevenueTry, projectYears }) {
  return {
    toplamGelirTry: baseRevenueTry + extraRevenueTry,
    finalCapacityPercent: 100,
    not: `${projectYears} yil sonunda kapasite dususu hesaplanmiyor`
  };
}

function calistir() {
  const girdi = {
    projectYears: 10,
    dailyChargeTargetSoc: 0.9,
    dailyDischargeTargetSoc: 0.2,
    annualMaintenanceCostTry: 15000
  };

  const bataryaModeli = {
    nominal_capacity_kwh: 500,
    nominal_power_kw: 250,
    round_trip_efficiency: 0.91,
    min_soc: 0.1,
    max_soc: 0.95,
    base_cost_try: 7800000,
    cycle_life_at_80_dod: 6500,
    calendar_degradation_pct_per_year: 1.4
  };

  const gunes = [0, 0, 0, 0, 4, 18, 35, 58, 74, 88, 95, 98, 92, 80, 63, 42, 24, 8, 1, 0, 0, 0, 0, 0];
  const tarife = [1300, 1200, 1100, 1020, 980, 950, 930, 940, 1040, 1200, 1350, 1450, 1550, 1700, 1860, 2050, 2250, 2400, 2520, 2600, 2320, 2050, 1780, 1500];

  const v2 = simulasyonCalistir({
    girdi,
    bataryaModeli,
    gunesProfiliSaatlikKwh: gunes,
    tarifeProfiliSaatlikTryMwh: tarife
  });

  const legacy = legacyYaklasim({
    baseRevenueTry: v2.summary.totalBaselineRevenueTry,
    extraRevenueTry: v2.summary.extraRevenueTry,
    projectYears: girdi.projectYears
  });

  console.log(JSON.stringify({ legacy, v2: v2.summary }, null, 2));
}

if (require.main === module) {
  calistir();
}
