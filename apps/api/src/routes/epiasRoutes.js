const express = require("express");
const epiasController = require("../controllers/epiasController");

const router = express.Router();

router.get("/epias-data", epiasController.getEpiasData);

module.exports = router;
