const epiasRepository = require("../repositories/epiasRepository");

class EpiasError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "EpiasError";
    this.statusCode = statusCode;
  }
}

function validateDateInput(startDate, endDate) {
  const tarihDeseni = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate) {
    throw new EpiasError("startDate ve endDate query parametreleri zorunludur.", 400);
  }
  if (!tarihDeseni.test(startDate) || !tarihDeseni.test(endDate)) {
    throw new EpiasError("Tarih formati YYYY-MM-DD olmali.", 400);
  }
  if (new Date(startDate) > new Date(endDate)) {
    throw new EpiasError("startDate, endDate degerinden buyuk olamaz.", 400);
  }
}

async function getEpiasData(startDate, endDate) {
  validateDateInput(startDate, endDate);
  const data = await epiasRepository.listEpiasDataByDateRange(startDate, endDate);
  return {
    count: data.length,
    startDate,
    endDate,
    data
  };
}

module.exports = {
  getEpiasData,
  EpiasError
};
