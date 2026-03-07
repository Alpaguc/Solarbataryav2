const express = require("express");
const simulationController = require("../controllers/simulationController");

const router = express.Router();

router.post("/", simulationController.createSimulation);
router.get("/:id", simulationController.getSimulationById);

module.exports = router;
