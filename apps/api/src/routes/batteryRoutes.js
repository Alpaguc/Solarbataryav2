const express = require("express");
const controller = require("../controllers/batteryController");
const router = express.Router();

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/custom", controller.createCustom);
router.post("/import-btr", controller.importBtr);
router.delete("/:id", controller.remove);

module.exports = router;
