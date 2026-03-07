const epiasService = require("../services/epiasService");

async function getEpiasData(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const result = await epiasService.getEpiasData(startDate, endDate);
    res.json({
      success: true,
      count: result.count,
      startDate: result.startDate,
      endDate: result.endDate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getEpiasData
};
