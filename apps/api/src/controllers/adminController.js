const adminService = require("../services/adminService");

async function getSettings(_req, res, next) {
  try {
    const data = await adminService.getAllSettings();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function upsertSetting(req, res, next) {
  try {
    const data = await adminService.saveSetting({
      settingKey: req.body.settingKey,
      settingValue: req.body.settingValue,
      description: req.body.description,
      updatedBy: req.user.id
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  upsertSetting
};
