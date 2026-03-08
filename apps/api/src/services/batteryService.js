const batteryRepo = require("../repositories/batteryRepository");

const SISTEM_KATALOG = [
  {
    userId: null,
    source: "catalog",
    manufacturer: "CATL",
    model: "EnerC LFP 100kWh",
    chemistry: "LFP",
    nominalCapacityKwh: 100,
    maxChargePowerKw: 50,
    maxDischargePowerKw: 50,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    minSoc: 0.1,
    maxSoc: 0.9,
    calendarDegradationPctPerYear: 2.0,
    cycleLifeJson: [[0.2, 6000], [0.4, 4000], [0.6, 3000], [0.8, 2000], [1.0, 1500]],
    costPerKwhTry: 25000,
    annualMaintenanceTry: 5000,
    scrapValuePct: 0.10
  },
  {
    userId: null,
    source: "catalog",
    manufacturer: "CATL",
    model: "EnerC LFP 500kWh",
    chemistry: "LFP",
    nominalCapacityKwh: 500,
    maxChargePowerKw: 250,
    maxDischargePowerKw: 250,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    minSoc: 0.1,
    maxSoc: 0.9,
    calendarDegradationPctPerYear: 2.0,
    cycleLifeJson: [[0.2, 6000], [0.4, 4000], [0.6, 3000], [0.8, 2000], [1.0, 1500]],
    costPerKwhTry: 23000,
    annualMaintenanceTry: 20000,
    scrapValuePct: 0.10
  },
  {
    userId: null,
    source: "catalog",
    manufacturer: "BYD",
    model: "Battery-Box LFP 200kWh",
    chemistry: "LFP",
    nominalCapacityKwh: 200,
    maxChargePowerKw: 100,
    maxDischargePowerKw: 100,
    chargeEfficiency: 0.95,
    dischargeEfficiency: 0.95,
    minSoc: 0.1,
    maxSoc: 0.9,
    calendarDegradationPctPerYear: 2.5,
    cycleLifeJson: [[0.2, 5000], [0.4, 3500], [0.6, 2500], [0.8, 1800], [1.0, 1200]],
    costPerKwhTry: 24000,
    annualMaintenanceTry: 8000,
    scrapValuePct: 0.10
  },
  {
    userId: null,
    source: "catalog",
    manufacturer: "Samsung SDI",
    model: "E3-H6 NMC 300kWh",
    chemistry: "NMC",
    nominalCapacityKwh: 300,
    maxChargePowerKw: 150,
    maxDischargePowerKw: 150,
    chargeEfficiency: 0.97,
    dischargeEfficiency: 0.97,
    minSoc: 0.1,
    maxSoc: 0.95,
    calendarDegradationPctPerYear: 3.0,
    cycleLifeJson: [[0.2, 4000], [0.4, 2500], [0.6, 1800], [0.8, 1200], [1.0, 900]],
    costPerKwhTry: 28000,
    annualMaintenanceTry: 12000,
    scrapValuePct: 0.12
  },
  {
    userId: null,
    source: "catalog",
    manufacturer: "LG Energy",
    model: "RESU Prime 1MWh",
    chemistry: "LFP",
    nominalCapacityKwh: 1000,
    maxChargePowerKw: 500,
    maxDischargePowerKw: 500,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    minSoc: 0.05,
    maxSoc: 0.95,
    calendarDegradationPctPerYear: 1.8,
    cycleLifeJson: [[0.2, 7000], [0.4, 5000], [0.6, 3500], [0.8, 2500], [1.0, 2000]],
    costPerKwhTry: 22000,
    annualMaintenanceTry: 35000,
    scrapValuePct: 0.10
  }
];

async function ensureCatalogSeeded() {
  const existing = await batteryRepo.listCatalog();
  if (existing.length > 0) return;
  for (const item of SISTEM_KATALOG) {
    await batteryRepo.create(item);
  }
}

async function listForUser(userId) {
  await ensureCatalogSeeded();
  return batteryRepo.listByUser(userId);
}

async function getById(id) {
  return batteryRepo.getById(id);
}

async function createCustom(userId, payload) {
  return batteryRepo.create({ ...payload, userId, source: "custom" });
}

function parseBtrText(btrText) {
  const lines = btrText.split(/\r?\n/);
  const data = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().split(";")[0].trim();
    data[key] = val;
  }

  const parseNum = (k, def = 0) => {
    const v = parseFloat((data[k] || "").replace(",", "."));
    return isNaN(v) ? def : v;
  };

  const nomKwh = parseNum("CapNomC10") / 1000;
  const efficI = parseNum("EfficI", 95) / 100;
  const socMin = parseNum("SOCLD", 10) / 100;
  const socMax = parseNum("SOCLG", 90) / 100;

  const cycleLifeJson = [];
  for (let dod = 20; dod <= 100; dod += 20) {
    const key = `NbCycleMax${dod}`;
    const val = parseNum(key, 0);
    if (val > 0) {
      cycleLifeJson.push([dod / 100, val]);
    }
  }

  if (cycleLifeJson.length === 0) {
    const maxCycles = parseNum("NbCycleMax", 3000);
    cycleLifeJson.push([0.8, maxCycles]);
  }

  const manufacturer = data["Manufacturer"] || data["ManufacturerName"] || "BTR Import";
  const model = data["Model"] || data["BatModelName"] || "BTR Battery";
  const maxPowerKw = parseNum("PNomC10", nomKwh) / 1000;

  return {
    source: "btr",
    manufacturer,
    model,
    chemistry: data["Technologie"] || "LFP",
    nominalCapacityKwh: nomKwh || 100,
    maxChargePowerKw: maxPowerKw || nomKwh / 2,
    maxDischargePowerKw: maxPowerKw || nomKwh / 2,
    chargeEfficiency: Math.sqrt(efficI),
    dischargeEfficiency: Math.sqrt(efficI),
    minSoc: socMin,
    maxSoc: socMax,
    calendarDegradationPctPerYear: parseNum("AgeingDeg", 2.0),
    cycleLifeJson,
    rawBtrJson: data
  };
}

async function importFromBtr(userId, btrText) {
  const parsed = parseBtrText(btrText);
  return batteryRepo.create({ ...parsed, userId });
}

async function remove(id, userId) {
  return batteryRepo.remove(id, userId);
}

module.exports = { listForUser, getById, createCustom, importFromBtr, remove, parseBtrText };
