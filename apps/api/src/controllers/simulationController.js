const simRepo = require("../repositories/simulationRepository");
const batteryService = require("../services/batteryService");
const { runSimulation, parsePvsystCsv, alignEpiasData } = require("../services/simulationEngine");
const { all: dbAll } = require("../db/connection");

async function runSim(req, res, next) {
  try {
    const {
      projectId,
      batteryCatalogId,
      pvsystCsvText,
      pvsystFilename,
      epiasHourly,
      acMaxPowerKw,
      dcPowerKw,
      gridLimitKw,
      strategyType,
      strategyParams,
      financialParams
    } = req.body;

    if (!projectId) return res.status(400).json({ success: false, message: "projectId gerekli." });
    if (!pvsystCsvText) return res.status(400).json({ success: false, message: "PVSyst CSV verisi gerekli." });
    if (!batteryCatalogId) return res.status(400).json({ success: false, message: "Batarya secimi gerekli." });

    // PVSyst CSV parse
    let pvsystData;
    try {
      pvsystData = parsePvsystCsv(pvsystCsvText);
    } catch (e) {
      return res.status(400).json({ success: false, message: `PVSyst CSV hatasi: ${e.message}` });
    }

    // EPIAS verisi hizala
    // Veri yoksa gercekci saatlik fiyat profili olustur (gunun saatine gore ortalama desen)
    function dummyFiyatProfili() {
      return new Array(8760).fill(null).map((_, i) => {
        const saat = i % 24;
        // Sabah/aksam zirve, gece/oglen dip
        let fiyat = 1500;
        if (saat >= 6 && saat <= 9) fiyat = 2800;
        else if (saat >= 17 && saat <= 21) fiyat = 3200;
        else if (saat >= 0 && saat <= 5) fiyat = 800;
        else if (saat >= 10 && saat <= 16) fiyat = 1200;
        return { hourIndex: i, priceTryMwh: fiyat };
      });
    }
    const epiasAligned = epiasHourly && epiasHourly.length > 100
      ? alignEpiasData(epiasHourly)
      : dummyFiyatProfili();

    // Batarya bilgisi
    const battery = await batteryService.getById(Number(batteryCatalogId));
    if (!battery) return res.status(404).json({ success: false, message: "Batarya bulunamadi." });

    const simParams = {
      acMaxPowerKw: acMaxPowerKw || battery.maxDischargePowerKw,
      dcPowerKw: dcPowerKw || battery.nominalCapacityKwh,
      gridLimitKw: gridLimitKw || null,
      financial: financialParams || {},
      ...(strategyParams || {})
    };

    // Simülasyonu çalıştır
    let result;
    try {
      result = runSimulation(pvsystData, epiasAligned, battery, strategyType || 'price_threshold', simParams);
    } catch (e) {
      return res.status(500).json({ success: false, message: `Simulasyon hatasi: ${e.message}` });
    }

    // SQLite'a kaydetmeyi dene (basarisiz olursa sessizce devam et — Render restart'larda DB sifirlanir)
    let simId = Date.now();
    try {
      const summary = { kpis: result.kpis, monthly: result.monthly, meta: result.meta };
      simId = await simRepo.createSimulation({
        projectId,
        userId: req.user.id,
        batteryCatalogId,
        pvsystFilename: pvsystFilename || "upload.csv",
        pvsystDataJson: pvsystData.slice(0, 100),
        epiasDataJson: epiasAligned.slice(0, 100),
        acMaxPowerKw: simParams.acMaxPowerKw,
        dcPowerKw: simParams.dcPowerKw,
        gridLimitKw: simParams.gridLimitKw,
        strategyType: strategyType || 'price_threshold',
        strategyParamsJson: strategyParams,
        financialParamsJson: financialParams
      });
      await simRepo.insertHourlyResults(simId, result.hourly);
      await simRepo.updateSimulationResult(simId, summary, 'done');
    } catch (_dbErr) {
      // SQLite hatasi — sonuclar frontend localStorage'da saklanir
    }

    const summary = {
      kpis: result.kpis,
      monthly: result.monthly,
      meta: result.meta
    };

    res.json({
      success: true,
      data: {
        simulationId: simId,
        summary,
        hourly: result.hourly
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getResults(req, res, next) {
  try {
    const simId = Number(req.params.id);
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 168);

    const sim = await simRepo.getSimulationById(simId, req.user.id);
    if (!sim) return res.status(404).json({ success: false, message: "Simulasyon bulunamadi." });

    const hourly = await simRepo.getHourlyResults(simId, offset, Math.min(limit, 720));
    res.json({ success: true, data: hourly, total: 8760, offset, limit });
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const simId = Number(req.params.id);
    const sim = await simRepo.getSimulationById(simId, req.user.id);
    if (!sim) return res.status(404).json({ success: false, message: "Simulasyon bulunamadi." });

    res.json({ success: true, data: sim });
  } catch (err) {
    next(err);
  }
}

async function listByProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const list = await simRepo.listSimulationsByProject(projectId, req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

async function deleteSim(req, res, next) {
  try {
    const simId = Number(req.params.id);
    const ok = await simRepo.deleteSimulation(simId, req.user.id);
    if (!ok) return res.status(404).json({ success: false, message: "Simulasyon bulunamadi." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { runSim, getResults, getSummary, listByProject, deleteSim };
