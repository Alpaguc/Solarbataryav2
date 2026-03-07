const catalogService = require("../services/batteryCatalogService");

async function getBrands(_req, res, next) {
  try {
    const data = await catalogService.getCatalogBrands();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getModels(req, res, next) {
  try {
    const brandId = Number(req.query.brandId);
    if (!brandId || Number.isNaN(brandId)) {
      res.status(400).json({
        success: false,
        error: "brandId query parametresi zorunludur."
      });
      return;
    }
    const data = await catalogService.getCatalogModels(brandId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getTariffs(_req, res, next) {
  try {
    const data = await catalogService.getTariffProfiles();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getSolarProfiles(_req, res, next) {
  try {
    const data = await catalogService.getSolarProfiles();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBrands,
  getModels,
  getTariffs,
  getSolarProfiles
};
