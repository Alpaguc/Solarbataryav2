const { all, get, run } = require("../db/connection");

async function listSettings() {
  return all(
    `SELECT
      id,
      setting_key AS settingKey,
      setting_value AS settingValue,
      description,
      updated_by AS updatedBy,
      updated_at AS updatedAt
     FROM app_settings
     ORDER BY setting_key ASC`
  );
}

async function getSettingByKey(settingKey) {
  return get(
    `SELECT
      id,
      setting_key AS settingKey,
      setting_value AS settingValue,
      description,
      updated_by AS updatedBy,
      updated_at AS updatedAt
     FROM app_settings
     WHERE setting_key = ?`,
    [settingKey]
  );
}

async function upsertSetting({ settingKey, settingValue, description, updatedBy }) {
  const mevcut = await getSettingByKey(settingKey);
  if (mevcut) {
    await run(
      `UPDATE app_settings
       SET setting_value = ?, description = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = ?`,
      [settingValue, description ?? null, updatedBy ?? null, settingKey]
    );
  } else {
    await run(
      `INSERT INTO app_settings (setting_key, setting_value, description, updated_by)
       VALUES (?, ?, ?, ?)`,
      [settingKey, settingValue, description ?? null, updatedBy ?? null]
    );
  }
  return getSettingByKey(settingKey);
}

module.exports = {
  listSettings,
  getSettingByKey,
  upsertSetting
};
