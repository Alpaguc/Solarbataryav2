const settingsRepository = require("../repositories/adminSettingsRepository");

class AdminSettingsError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AdminSettingsError";
    this.statusCode = statusCode;
  }
}

function normalizeSettingKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function getAllSettings() {
  return settingsRepository.listSettings();
}

async function saveSetting({ settingKey, settingValue, description, updatedBy }) {
  const anahtar = normalizeSettingKey(settingKey);
  if (!anahtar) {
    throw new AdminSettingsError("settingKey zorunludur.");
  }
  if (String(settingValue ?? "").trim() === "") {
    throw new AdminSettingsError("settingValue zorunludur.");
  }

  return settingsRepository.upsertSetting({
    settingKey: anahtar,
    settingValue: String(settingValue),
    description: description ? String(description) : null,
    updatedBy
  });
}

async function seedDefaultSettings(adminUserId) {
  const varsayilanlar = [
    {
      settingKey: "platform_maintenance_mode",
      settingValue: "false",
      description: "true oldugunda platform bakim modunda calisir"
    },
    {
      settingKey: "default_project_years",
      settingValue: "10",
      description: "Yeni simulasyonlar icin varsayilan yil degeri"
    },
    {
      settingKey: "allow_registration",
      settingValue: "true",
      description: "false ise yeni kullanici kaydi kapatilir"
    }
  ];

  for (const item of varsayilanlar) {
    await settingsRepository.upsertSetting({
      ...item,
      updatedBy: adminUserId
    });
  }
}

module.exports = {
  getAllSettings,
  saveSetting,
  seedDefaultSettings,
  AdminSettingsError
};
