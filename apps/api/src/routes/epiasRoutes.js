const express = require("express");
const epiasController = require("../controllers/epiasController");

const router = express.Router();

router.get("/epias-data", epiasController.getEpiasData);
router.get("/epias-date-range", epiasController.getEpiasDateRange);

module.exports = router;
