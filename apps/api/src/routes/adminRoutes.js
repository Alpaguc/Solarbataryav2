const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.get("/settings", adminController.getSettings);
router.post("/settings", adminController.upsertSetting);

module.exports = router;
