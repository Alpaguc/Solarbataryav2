const { get, run, all } = require("../db/connection");

const PROJE_SECIM = `
  SELECT
    p.id,
    p.user_id AS userId,
    p.project_name AS projectName,
    p.location,
    p.installed_power_kw AS installedPowerKw,
    p.description,
    p.is_deleted AS isDeleted,
    p.created_at AS createdAt
  FROM projects p
`;

async function getProjectsByUserId(userId) {
  return all(
    `${PROJE_SECIM}
     WHERE p.user_id = ? AND p.is_deleted = 0
     ORDER BY p.created_at DESC`,
    [userId]
  );
}

async function getProjectById(id, userId) {
  return get(
    `${PROJE_SECIM}
     WHERE p.id = ? AND p.user_id = ? AND p.is_deleted = 0`,
    [id, userId]
  );
}

async function createProject({ userId, projectName, location, installedPowerKw, description }) {
  const sonuc = await run(
    `INSERT INTO projects (user_id, project_name, location, installed_power_kw, description, is_deleted)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [userId, projectName, location, installedPowerKw ?? null, description ?? null]
  );

  await run(
    `UPDATE users SET total_projects_created = total_projects_created + 1 WHERE id = ?`,
    [userId]
  );

  return sonuc.lastID;
}

async function softDeleteProject(id, userId) {
  const sonuc = await run(
    `UPDATE projects SET is_deleted = 1 WHERE id = ? AND user_id = ? AND is_deleted = 0`,
    [id, userId]
  );
  return sonuc.changes > 0;
}

async function getUserProjectStats(userId) {
  return get(
    `SELECT total_projects_created AS totalProjectsCreated FROM users WHERE id = ?`,
    [userId]
  );
}

module.exports = {
  getProjectsByUserId,
  getProjectById,
  createProject,
  softDeleteProject,
  getUserProjectStats
};
