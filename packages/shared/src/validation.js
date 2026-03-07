const { TARIFE_TIPLERI } = require("./constants");

function sayiMi(deger) {
  return typeof deger === "number" && Number.isFinite(deger);
}

function normalizeSimulationInput(girdi) {
  const temiz = {
    batteryModelId: Number(girdi?.batteryModelId),
    solarProfileCode: String(girdi?.solarProfileCode || "").trim(),
    tariffProfileCode: String(girdi?.tariffProfileCode || "").trim(),
    projectYears: Number(girdi?.projectYears ?? 10),
    dailyChargeTargetSoc: Number(girdi?.dailyChargeTargetSoc ?? 0.9),
    dailyDischargeTargetSoc: Number(girdi?.dailyDischargeTargetSoc ?? 0.2),
    inverterEfficiency: Number(girdi?.inverterEfficiency ?? 0.97),
    tariffType: String(girdi?.tariffType || TARIFE_TIPLERI.SANAYI),
    annualMaintenanceCostTry: Number(girdi?.annualMaintenanceCostTry ?? 0)
  };

  return temiz;
}

function validateSimulationInput(girdi) {
  const hatalar = [];

  if (!Number.isInteger(girdi.batteryModelId) || girdi.batteryModelId <= 0) {
    hatalar.push("Gecerli bir batarya modeli secilmelidir.");
  }

  if (!girdi.solarProfileCode) {
    hatalar.push("Gunes profili secimi zorunludur.");
  }

  if (!girdi.tariffProfileCode) {
    hatalar.push("Tarife profili secimi zorunludur.");
  }

  if (!Number.isInteger(girdi.projectYears) || girdi.projectYears < 1 || girdi.projectYears > 30) {
    hatalar.push("Proje suresi 1-30 yil arasinda olmalidir.");
  }

  if (!sayiMi(girdi.dailyChargeTargetSoc) || girdi.dailyChargeTargetSoc <= 0 || girdi.dailyChargeTargetSoc > 1) {
    hatalar.push("Gunluk sarj hedefi 0-1 araliginda olmalidir.");
  }

  if (!sayiMi(girdi.dailyDischargeTargetSoc) || girdi.dailyDischargeTargetSoc < 0 || girdi.dailyDischargeTargetSoc >= 1) {
    hatalar.push("Gunluk desarj hedefi 0-1 araliginda olmalidir.");
  }

  if (girdi.dailyDischargeTargetSoc >= girdi.dailyChargeTargetSoc) {
    hatalar.push("Desarj hedefi sarj hedefinden kucuk olmalidir.");
  }

  if (!sayiMi(girdi.inverterEfficiency) || girdi.inverterEfficiency <= 0 || girdi.inverterEfficiency > 1) {
    hatalar.push("Inverter verimi 0-1 araliginda olmalidir.");
  }

  if (!Object.values(TARIFE_TIPLERI).includes(girdi.tariffType)) {
    hatalar.push("Tarife tipi gecersiz.");
  }

  if (!sayiMi(girdi.annualMaintenanceCostTry) || girdi.annualMaintenanceCostTry < 0) {
    hatalar.push("Yillik bakim maliyeti negatif olamaz.");
  }

  return hatalar;
}

module.exports = {
  normalizeSimulationInput,
  validateSimulationInput
};
