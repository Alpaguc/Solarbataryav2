const express = require("express");
const projectController = require("../controllers/projectController");

const router = express.Router();

router.get("/", projectController.getMyProjects);
router.post("/", projectController.createProject);
router.get("/:id", projectController.getProject);
router.delete("/:id", projectController.deleteProject);

module.exports = router;
