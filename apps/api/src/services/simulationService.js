const { normalizeSimulationInput, validateSimulationInput } = require("@solarbatarya/shared");
const { simulasyonCalistir } = require("@solarbatarya/simulation-core");
const batteryRepository = require("../repositories/batteryCatalogRepository");
const profileRepository = require("../repositories/profileRepository");
const simulationRepository = require("../repositories/simulationRepository");
const projectRepository = require("../repositories/projectRepository");

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.details = details;
  }
}

async function buildSimulationContext(girdiHam) {
  const girdi = normalizeSimulationInput(girdiHam);
  const hatalar = validateSimulationInput(girdi);
  if (hatalar.length > 0) {
    throw new ValidationError("Simulasyon girdisi gecersiz.", hatalar);
  }

  const bataryaModeli = await batteryRepository.getModelById(girdi.batteryModelId);
  if (!bataryaModeli) {
    throw new ValidationError("Secilen batarya modeli bulunamadi.");
  }

  const tarife = await profileRepository.getTariffProfileByCode(girdi.tariffProfileCode);
  if (!tarife) {
    throw new ValidationError("Secilen tarife profili bulunamadi.");
  }

  const gunes = await profileRepository.getSolarProfileByCode(girdi.solarProfileCode);
  if (!gunes) {
    throw new ValidationError("Secilen gunes profili bulunamadi.");
  }

  const saatlikFiyatlar = JSON.parse(tarife.hourly_price_json);
  const saatlikGunes = JSON.parse(gunes.hourly_generation_json);

  if (!Array.isArray(saatlikFiyatlar) || saatlikFiyatlar.length !== 24) {
    throw new ValidationError("Tarife profilinde 24 saatlik fiyat verisi bulunmalidir.");
  }
  if (!Array.isArray(saatlikGunes) || saatlikGunes.length !== 24) {
    throw new ValidationError("Gunes profilinde 24 saatlik uretim verisi bulunmalidir.");
  }

  return {
    girdi,
    bataryaModeli,
    tarife,
    gunes,
    saatlikFiyatlar,
    saatlikGunes
  };
}

async function runSimulation(girdiHam, oturum) {
  const ctx = await buildSimulationContext(girdiHam);
  const projectId = Number(girdiHam?.projectId);
  if (!projectId || Number.isNaN(projectId)) {
    throw new ValidationError("Simulasyon icin projectId zorunludur.");
  }

  const proje = await projectRepository.getProjectByUserId(oturum.userId);
  if (!proje || Number(proje.id) !== projectId) {
    const err = new Error("Bu projeye erisim yetkiniz bulunmuyor.");
    err.statusCode = 403;
    throw err;
  }

  const sonuc = simulasyonCalistir({
    girdi: ctx.girdi,
    bataryaModeli: ctx.bataryaModeli,
    gunesProfiliSaatlikKwh: ctx.saatlikGunes,
    tarifeProfiliSaatlikTryMwh: ctx.saatlikFiyatlar
  });

  const runId = await simulationRepository.createSimulationRun({
    userId: oturum.userId,
    projectId,
    batteryModelId: ctx.bataryaModeli.id,
    input: ctx.girdi,
    summary: {
      ...sonuc.summary,
      batteryModel: {
        id: ctx.bataryaModeli.id,
        name: ctx.bataryaModeli.name,
        brandName: ctx.bataryaModeli.brandName
      },
      tariffProfile: {
        code: ctx.tarife.code,
        name: ctx.tarife.name
      },
      solarProfile: {
        code: ctx.gunes.code,
        name: ctx.gunes.name
      }
    }
  });

  await simulationRepository.saveHourlyResults(runId, sonuc.hourlyResults);

  return {
    runId,
    summary: {
      ...sonuc.summary,
      batteryModel: {
        id: ctx.bataryaModeli.id,
        name: ctx.bataryaModeli.name,
        brandName: ctx.bataryaModeli.brandName
      },
      tariffProfile: {
        code: ctx.tarife.code,
        name: ctx.tarife.name
      },
      solarProfile: {
        code: ctx.gunes.code,
        name: ctx.gunes.name
      }
    },
    series: sonuc.series
  };
}

async function getSimulationById(runId) {
  const run = await simulationRepository.getSimulationRun(runId);
  if (!run) {
    const error = new Error("Simulasyon kaydi bulunamadi.");
    error.statusCode = 404;
    throw error;
  }

  const hourly = await simulationRepository.listHourlyResults(runId);
  return {
    id: run.id,
    input: JSON.parse(run.inputJson),
    summary: JSON.parse(run.summaryJson),
    createdAt: run.createdAt,
    hourlyResults: hourly
  };
}

module.exports = {
  runSimulation,
  getSimulationById,
  ValidationError
};
