const { get, run } = require("../db/connection");

async function getProjectByUserId(userId) {
  return get(
    `SELECT
      id,
      user_id as userId,
      project_name as projectName,
      location,
      installed_power_kw as installedPowerKw,
      description,
      created_at as createdAt
    FROM projects
    WHERE user_id = ?`,
    [userId]
  );
}

async function createProject({ userId, projectName, location, installedPowerKw, description }) {
  const sonuc = await run(
    `INSERT INTO projects (user_id, project_name, location, installed_power_kw, description)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, projectName, location, installedPowerKw, description]
  );
  return sonuc.lastID;
}

module.exports = {
  getProjectByUserId,
  createProject
};
