const batteryService = require("../services/batteryService");

async function list(req, res, next) {
  try {
    const list = await batteryService.listForUser(req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const item = await batteryService.getById(Number(req.params.id));
    if (!item) return res.status(404).json({ success: false, message: "Batarya bulunamadi." });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function createCustom(req, res, next) {
  try {
    const item = await batteryService.createCustom(req.user.id, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function importBtr(req, res, next) {
  try {
    const { btrContent } = req.body;
    if (!btrContent) return res.status(400).json({ success: false, message: "BTR icerigi gerekli." });
    const item = await batteryService.importFromBtr(req.user.id, btrContent);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const ok = await batteryService.remove(Number(req.params.id), req.user.id);
    if (!ok) return res.status(404).json({ success: false, message: "Batarya bulunamadi veya silme yetkisi yok." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, createCustom, importBtr, remove };
