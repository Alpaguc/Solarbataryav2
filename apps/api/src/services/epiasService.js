const epiasRepository = require("../repositories/epiasRepository");

class EpiasError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "EpiasError";
    this.statusCode = statusCode;
  }
}

function getIstanbulNow() {
  const parcalar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const getir = (tip) => parcalar.find((p) => p.type === tip)?.value || "";
  return {
    tarih: `${getir("year")}-${getir("month")}-${getir("day")}`,
    saat: Number(getir("hour") || 0)
  };
}

function dateMinusDays(isoDate, days) {
  const [y, m, d] = String(isoDate)
    .split("-")
    .map((n) => Number(n));
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  utcDate.setUTCDate(utcDate.getUTCDate() - days);
  return utcDate.toISOString().slice(0, 10);
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

async function getEpiasDateRange() {
  const { tarih: istanbulBugun, saat: istanbulSaat } = getIstanbulNow();
  const bitis = istanbulSaat < 14 ? dateMinusDays(istanbulBugun, 1) : istanbulBugun;
  const baslangic = dateMinusDays(bitis, 7);

  // Canli servis kullandigimiz icin burada "onerilen sorgu araligi" donuyoruz.
  const row = {
    minDate: baslangic,
    maxDate: bitis,
    totalRows: 0
  };
  return {
    minDate: row?.minDate || null,
    maxDate: row?.maxDate || null,
    totalRows: Number(row?.totalRows || 0)
  };
}

module.exports = {
  getEpiasData,
  getEpiasDateRange,
  EpiasError
};
