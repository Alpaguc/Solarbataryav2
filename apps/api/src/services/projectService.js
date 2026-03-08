const projectRepository = require("../repositories/projectRepository");

class ProjectError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ProjectError";
    this.statusCode = statusCode;
  }
}

async function getMyProjects(userId) {
  const projeler = await projectRepository.getProjectsByUserId(userId);
  const istatistik = await projectRepository.getUserProjectStats(userId);
  return {
    projects: projeler || [],
    totalProjectsCreated: istatistik?.totalProjectsCreated || 0
  };
}

async function getMyProjectById(userId, projectId) {
  const proje = await projectRepository.getProjectById(projectId, userId);
  if (!proje) {
    throw new ProjectError("Proje bulunamadi.", 404);
  }
  return proje;
}

async function createMyProject(userId, payload) {
  const projectName = String(payload?.projectName || "").trim();
  const location = String(payload?.location || "").trim();
  const installedPowerKw =
    payload?.installedPowerKw !== undefined ? Number(payload.installedPowerKw) : null;
  const description = String(payload?.description || "").trim() || null;

  if (projectName.length < 2) {
    throw new ProjectError("Proje adi en az 2 karakter olmalidir.");
  }
  if (location.length < 2) {
    throw new ProjectError("Lokasyon bilgisi en az 2 karakter olmalidir.");
  }
  if (installedPowerKw !== null && (!Number.isFinite(installedPowerKw) || installedPowerKw < 0)) {
    throw new ProjectError("Kurulu guc negatif olamaz.");
  }

  const projeId = await projectRepository.createProject({
    userId,
    projectName,
    location,
    installedPowerKw,
    description
  });

  return projectRepository.getProjectById(projeId, userId);
}

async function deleteMyProject(userId, projectId) {
  const proje = await projectRepository.getProjectById(projectId, userId);
  if (!proje) {
    throw new ProjectError("Proje bulunamadi.", 404);
  }
  const silindi = await projectRepository.softDeleteProject(projectId, userId);
  if (!silindi) {
    throw new ProjectError("Proje silinemedi.", 500);
  }
  return { deleted: true };
}

module.exports = {
  getMyProjects,
  getMyProjectById,
  createMyProject,
  deleteMyProject,
  ProjectError
};
