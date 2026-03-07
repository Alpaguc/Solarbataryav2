const projectService = require("../services/projectService");

async function getMyProject(req, res, next) {
  try {
    const proje = await projectService.getMyProject(req.user.id);
    res.json({ success: true, data: proje || null });
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  try {
    const proje = await projectService.createMyProject(req.user.id, req.body);
    res.status(201).json({ success: true, data: proje });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProject,
  createProject
};
