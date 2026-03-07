const express = require("express");
const { healthCheck } = require("../controllers/healthController");
const authRoutes = require("./authRoutes");
const epiasRoutes = require("./epiasRoutes");
const catalogRoutes = require("./catalogRoutes");
const simulationRoutes = require("./simulationRoutes");
const projectRoutes = require("./projectRoutes");
const adminRoutes = require("./adminRoutes");
const { authenticate } = require("../middleware/authenticate");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router.get("/health", healthCheck);
router.use("/auth", authRoutes);
router.use("/", epiasRoutes);
router.use("/catalog", authenticate, catalogRoutes);
router.use("/projects", authenticate, projectRoutes);
router.use("/simulations", authenticate, simulationRoutes);
router.use("/admin", authenticate, requireAdmin, adminRoutes);

module.exports = router;
