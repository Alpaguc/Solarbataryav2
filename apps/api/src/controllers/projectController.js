const projectService = require("../services/projectService");

async function getMyProjects(req, res, next) {
  try {
    const veri = await projectService.getMyProjects(req.user.id);
    res.json({ success: true, data: veri });
  } catch (err) {
    next(err);
  }
}

async function getProject(req, res, next) {
  try {
    const proje = await projectService.getMyProjectById(req.user.id, req.params.id);
    res.json({ success: true, data: proje });
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

async function deleteProject(req, res, next) {
  try {
    const sonuc = await projectService.deleteMyProject(req.user.id, req.params.id);
    res.json({ success: true, data: sonuc });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProjects,
  getProject,
  createProject,
  deleteProject
};
