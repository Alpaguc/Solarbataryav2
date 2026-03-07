const projectRepository = require("../repositories/projectRepository");

class ProjectError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ProjectError";
    this.statusCode = statusCode;
  }
}

async function getMyProject(userId) {
  return projectRepository.getProjectByUserId(userId);
}

async function createMyProject(userId, payload) {
  const mevcut = await projectRepository.getProjectByUserId(userId);
  if (mevcut) {
    throw new ProjectError("Bu surumde her kullanici icin tek proje olusturulabilir.", 409);
  }

  const projectName = String(payload?.projectName || "").trim();
  const location = String(payload?.location || "").trim();
  const installedPowerKw = payload?.installedPowerKw !== undefined ? Number(payload.installedPowerKw) : null;
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

  await projectRepository.createProject({
    userId,
    projectName,
    location,
    installedPowerKw,
    description
  });

  return projectRepository.getProjectByUserId(userId);
}

module.exports = {
  getMyProject,
  createMyProject,
  ProjectError
};
