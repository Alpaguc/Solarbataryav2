const simulationService = require("../services/simulationService");

async function createSimulation(req, res, next) {
  try {
    const sonuc = await simulationService.runSimulation(req.body, { userId: req.user.id });
    res.status(201).json({
      success: true,
      message: "Simulasyon basariyla tamamlandi.",
      data: sonuc
    });
  } catch (err) {
    next(err);
  }
}

async function getSimulationById(req, res, next) {
  try {
    const runId = Number(req.params.id);
    const sonuc = await simulationService.getSimulationById(runId);
    res.json({ success: true, data: sonuc });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSimulation,
  getSimulationById
};
