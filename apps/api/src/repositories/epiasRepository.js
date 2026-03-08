const { EPIAS_SERVICE_URL, EPIAS_REQUEST_TIMEOUT_MS } = require("../config/env");

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const sayi = Number(String(value).replace(",", "."));
  return Number.isFinite(sayi) ? sayi : null;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatTrDateFromIso(isoDate) {
  const [yil, ay, gun] = String(isoDate).split("-");
  if (!yil || !ay || !gun) {
    return null;
  }
  return `${gun}.${ay}.${yil}`;
}

function extractDateTimeParts(kayit) {
  const hamTarihSaat = String(kayit.date || kayit.datetime || kayit.tarih || "").trim();
  const eslesenTarih = hamTarihSaat.match(/(\d{4})-(\d{2})-(\d{2})/);
  const eslesenSaat = hamTarihSaat.match(/T(\d{2}):(\d{2})/);

  const isoTarih = eslesenTarih
    ? `${eslesenTarih[1]}-${eslesenTarih[2]}-${eslesenTarih[3]}`
    : String(kayit.tarihIso || "");

  const saatNum = kayit.hour ?? kayit.saatNum;
  const saatFromNum =
    Number.isFinite(Number(saatNum)) && Number(saatNum) >= 0 && Number(saatNum) <= 23
      ? `${String(Number(saatNum)).padStart(2, "0")}:00`
      : null;
  const saatFromDate = eslesenSaat ? `${eslesenSaat[1]}:${eslesenSaat[2]}` : null;
  const saatMetin = String(kayit.saat || "").trim();
  const saatFromText = /^\d{2}:\d{2}$/.test(saatMetin) ? saatMetin : null;

  const trTarih = formatTrDateFromIso(isoTarih);
  const saat = saatFromDate || saatFromNum || saatFromText || "00:00";
  return {
    trTarih,
    saat
  };
}

function normalizeEpiasRows(rows) {
  return rows
    .map((kayit) => {
      const { trTarih, saat } = extractDateTimeParts(kayit);
      if (!trTarih) {
        return null;
      }

      return {
        Tarih: trTarih,
        Saat: saat,
        "PTF (TL/MWh)": toNumberOrNull(
          kayit.price ?? kayit.ptf ?? kayit.fiyat ?? kayit["PTF (TL/MWh)"] ?? kayit.mcp
        ),
        "PTF (USD/MWh)": toNumberOrNull(
          kayit.priceUsd ?? kayit.usdPrice ?? kayit["PTF (USD/MWh)"] ?? kayit.ptfUsd
        ),
        "PTF (EUR/MWh)": toNumberOrNull(
          kayit.priceEur ?? kayit.eurPrice ?? kayit["PTF (EUR/MWh)"] ?? kayit.ptfEur
        )
      };
    })
    .filter(Boolean);
}

function extractRowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.body?.dayAheadMCPList)) return payload.body.dayAheadMCPList;
  if (Array.isArray(payload?.body?.dayAheadMcpList)) return payload.body.dayAheadMcpList;
  if (Array.isArray(payload?.body?.mcpList)) return payload.body.mcpList;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function fetchEpiasRows(startDate, endDate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EPIAS_REQUEST_TIMEOUT_MS);
  const url = new URL(EPIAS_SERVICE_URL);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      const err = new Error(`EPİAŞ servisi hata döndü (${response.status}).`);
      err.statusCode = 502;
      throw err;
    }

    const payload = await response.json();
    return extractRowsFromPayload(payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      const err = new Error("EPİAŞ servisi zaman aşımına uğradı.");
      err.statusCode = 504;
      throw err;
    }
    const err = new Error("EPİAŞ canlı servisine bağlanılamadı.");
    err.statusCode = error?.statusCode || 502;
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function listEpiasDataByDateRange(startDate, endDate) {
  const bugunIso = toIsoDate(new Date());
  const bitis = endDate > bugunIso ? bugunIso : endDate;
  const satirlar = await fetchEpiasRows(startDate, bitis);
  return normalizeEpiasRows(satirlar);
}

module.exports = {
  listEpiasDataByDateRange
};
