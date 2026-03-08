const express = require("express");
const controller = require("../controllers/simulationController");
const router = express.Router();

router.post("/run", controller.runSim);
router.get("/project/:projectId", controller.listByProject);
router.get("/:id/results", controller.getResults);
router.get("/:id/summary", controller.getSummary);
router.delete("/:id", controller.deleteSim);

module.exports = router;
