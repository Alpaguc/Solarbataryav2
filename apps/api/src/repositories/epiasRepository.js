const {
  EPIAS_MCP_V1_URL,
  EPIAS_SERVICE_URL,
  EPIAS_AUTH_URL,
  EPIAS_USERNAME,
  EPIAS_PASSWORD,
  EPIAS_REQUEST_TIMEOUT_MS
} = require("../config/env");

const TGT_ONBELLEK_MS = 110 * 60 * 1000;
let epiasTgt = null;
let epiasTgtBitis = 0;

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const sayi = Number(String(value).replace(",", "."));
  return Number.isFinite(sayi) ? sayi : null;
}

function normalizeIsoDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const metin = String(value).trim();
  if (!metin) {
    return null;
  }

  const isoMatch = metin.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const trMatch = metin.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (trMatch) {
    return `${trMatch[3]}-${trMatch[2]}-${trMatch[1]}`;
  }

  const date = new Date(metin);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function isHtmlLoginResponse(contentType, text) {
  const tip = String(contentType || "").toLowerCase();
  const govde = String(text || "").trim().toLowerCase();
  return tip.includes("text/html") || govde.startsWith("<!doctype html") || govde.startsWith("<html");
}

function createEpiasError(message, statusCode = 502) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function createAuthRequiredError(message) {
  const err = createEpiasError(message, 401);
  err.code = "EPIAS_AUTH_REQUIRED";
  return err;
}

function hasAuthErrorInPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const hamMesajlar = [
    payload.message,
    payload.error,
    payload.errorMessage,
    payload?.body?.message,
    payload?.body?.error,
    payload?.body?.errorMessage
  ].filter(Boolean);

  const mesaj = hamMesajlar.join(" ").toLowerCase();
  if (!mesaj) {
    return false;
  }

  return (
    mesaj.includes("tgt") ||
    mesaj.includes("ticket") ||
    mesaj.includes("authentication") ||
    mesaj.includes("unauthorized") ||
    mesaj.includes("forbidden") ||
    mesaj.includes("kimlik")
  );
}

function formatTrDateFromIso(isoDate) {
  const [yil, ay, gun] = String(isoDate).split("-");
  if (!yil || !ay || !gun) {
    return null;
  }
  return `${gun}.${ay}.${yil}`;
}

function extractDateTimeParts(kayit) {
  const hamTarihSaat = String(
    kayit.date || kayit.datetime || kayit.tarih || kayit.day || kayit.gun || ""
  ).trim();
  const eslesenSaat = hamTarihSaat.match(/T(\d{2}):(\d{2})/);

  const isoTarih =
    normalizeIsoDate(kayit.date) ||
    normalizeIsoDate(kayit.datetime) ||
    normalizeIsoDate(kayit.tarih) ||
    normalizeIsoDate(kayit.day) ||
    normalizeIsoDate(kayit.gun) ||
    normalizeIsoDate(kayit.tarihIso) ||
    normalizeIsoDate(kayit.time) ||
    normalizeIsoDate(hamTarihSaat);

  const saatNum = kayit.hour ?? kayit.saatNum ?? kayit.period ?? kayit.timeIndex;
  let saatFromNum = null;
  if (Number.isFinite(Number(saatNum))) {
    const n = Number(saatNum);
    if (n >= 0 && n <= 23) {
      saatFromNum = `${String(n).padStart(2, "0")}:00`;
    } else if (n >= 1 && n <= 24) {
      // Bazi cevaplarda saatler 1-24 olarak donuyor.
      saatFromNum = `${String(n - 1).padStart(2, "0")}:00`;
    }
  }
  const saatFromDate = eslesenSaat ? `${eslesenSaat[1]}:${eslesenSaat[2]}` : null;
  const saatMetin = String(kayit.saat || kayit.time || "").trim();
  const saatFromText = /^\d{2}:\d{2}$/.test(saatMetin)
    ? saatMetin
    : /^\d{1,2}$/.test(saatMetin)
      ? `${String(Number(saatMetin)).padStart(2, "0")}:00`
      : null;

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
          kayit.price ??
            kayit.ptf ??
            kayit.fiyat ??
            kayit["PTF (TL/MWh)"] ??
            kayit.mcp ??
            kayit.mcpPrice ??
            kayit.marketClearingPrice
        ),
        "PTF (USD/MWh)": toNumberOrNull(
          kayit.priceUsd ??
            kayit.usdPrice ??
            kayit["PTF (USD/MWh)"] ??
            kayit.ptfUsd ??
            kayit.mcpUsd
        ),
        "PTF (EUR/MWh)": toNumberOrNull(
          kayit.priceEur ??
            kayit.eurPrice ??
            kayit["PTF (EUR/MWh)"] ??
            kayit.ptfEur ??
            kayit.mcpEur
        )
      };
    })
    .filter(Boolean);
}

function findArrayInObject(obj, depth = 0) {
  if (!obj || depth > 5) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj;
  }
  if (typeof obj !== "object") {
    return null;
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      return value;
    }
    const nested = findArrayInObject(value, depth + 1);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function extractRowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.body?.dayAheadMCPList)) return payload.body.dayAheadMCPList;
  if (Array.isArray(payload?.body?.dayAheadMcpList)) return payload.body.dayAheadMcpList;
  if (Array.isArray(payload?.body?.mcpList)) return payload.body.mcpList;
  if (Array.isArray(payload?.body?.list)) return payload.body.list;
  if (Array.isArray(payload?.body?.items)) return payload.body.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return findArrayInObject(payload) || [];
}

function toEpiasIsoStart(startDate) {
  return `${startDate}T00:00:00+03:00`;
}

function toEpiasIsoEnd(endDate) {
  return `${endDate}T23:59:59+03:00`;
}

function buildTimeoutController() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EPIAS_REQUEST_TIMEOUT_MS);
  return { controller, timeout };
}

async function fetchWithTimeout(url, options) {
  const { controller, timeout } = buildTimeoutController();
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getEpiasTgt(forceRefresh = false) {
  const kullanici = String(EPIAS_USERNAME || "").trim();
  const sifre = String(EPIAS_PASSWORD || "").trim();
  if (!kullanici || !sifre) {
    return null;
  }

  if (!forceRefresh && epiasTgt && Date.now() < epiasTgtBitis) {
    return epiasTgt;
  }

  const body = new URLSearchParams();
  body.set("username", kullanici);
  body.set("password", sifre);

  let response;
  try {
    response = await fetchWithTimeout(EPIAS_AUTH_URL, {
      method: "POST",
      headers: {
        Accept: "text/plain",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createEpiasError("EPİAŞ giriş servisi zaman aşımına uğradı.", 504);
    }
    throw createEpiasError("EPİAŞ giriş servisine bağlanılamadı.");
  }

  const metin = (await response.text()).trim();
  if (!response.ok || !metin.startsWith("TGT-")) {
    throw createEpiasError("EPİAŞ TGT alınamadı. EPIAS kullanıcı bilgilerini kontrol edin.");
  }

  epiasTgt = metin;
  epiasTgtBitis = Date.now() + TGT_ONBELLEK_MS;
  return epiasTgt;
}

async function fetchEpiasRowsWithAuth(startDate, endDate) {
  const fetchRows = async (forceRefresh = false) => {
    const tgt = await getEpiasTgt(forceRefresh);
    if (!tgt) {
      throw createEpiasError("EPİAŞ kullanıcı bilgisi bulunamadı.");
    }

    let response;
    try {
      response = await fetchWithTimeout(EPIAS_MCP_V1_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          TGT: tgt
        },
        body: JSON.stringify({
          startDate: toEpiasIsoStart(startDate),
          endDate: toEpiasIsoEnd(endDate),
          page: {
            number: 1,
            size: 5000,
            sort: {
              field: "date",
              direction: "ASC"
            }
          }
        })
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw createEpiasError("EPİAŞ MCP servisi zaman aşımına uğradı.", 504);
      }
      throw createEpiasError("EPİAŞ MCP servisine bağlanılamadı.");
    }

    const text = await response.text();
    const contentType = response.headers.get("content-type");

    const payload = parseJson(text);
    if (response.status === 401 || response.status === 403) {
      throw createAuthRequiredError(`EPİAŞ MCP servisi yetki hatası döndü (${response.status}).`);
    }
    if (isHtmlLoginResponse(contentType, text)) {
      throw createAuthRequiredError("EPİAŞ MCP servisi kimlik doğrulama istedi (TGT geçersiz olabilir).");
    }
    if (hasAuthErrorInPayload(payload)) {
      throw createAuthRequiredError("EPİAŞ MCP servis cevabında kimlik doğrulama hatası algılandı (TGT yenileniyor).");
    }

    if (!response.ok) {
      throw createEpiasError(`EPİAŞ MCP servisi hata döndü (${response.status}).`);
    }
    if (!payload) {
      throw createEpiasError("EPİAŞ MCP servis cevabı JSON formatında değil.");
    }

    return extractRowsFromPayload(payload);
  };

  try {
    return await fetchRows(false);
  } catch (error) {
    if (error?.code !== "EPIAS_AUTH_REQUIRED") {
      throw error;
    }
    epiasTgt = null;
    epiasTgtBitis = 0;
    return fetchRows(true);
  }
}

async function fetchEpiasRowsFromPublicService(startDate, endDate) {
  const url = new URL(EPIAS_SERVICE_URL);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type");
    if (isHtmlLoginResponse(contentType, text)) {
      throw createEpiasError("EPİAŞ public servisi giriş sayfası döndü. EPIAS kullanıcı bilgileriyle TGT akışını kullanın.");
    }

    if (!response.ok) {
      throw createEpiasError(`EPİAŞ public servisi hata döndü (${response.status}).`);
    }

    const payload = parseJson(text);
    if (!payload) {
      throw createEpiasError("EPİAŞ public servis cevabı JSON formatında değil.");
    }

    return extractRowsFromPayload(payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createEpiasError("EPİAŞ public servisi zaman aşımına uğradı.", 504);
    }
    if (error?.statusCode) {
      throw error;
    }
    throw createEpiasError("EPİAŞ canlı servisine bağlanılamadı.");
  }
}

async function fetchEpiasRows(startDate, endDate) {
  const authAktif = Boolean(String(EPIAS_USERNAME || "").trim() && String(EPIAS_PASSWORD || "").trim());
  let authError = null;

  if (authAktif) {
    try {
      return await fetchEpiasRowsWithAuth(startDate, endDate);
    } catch (error) {
      authError = error;
    }
  }

  try {
    return await fetchEpiasRowsFromPublicService(startDate, endDate);
  } catch (publicError) {
    if (!authAktif) {
      throw createEpiasError(
        `${publicError.message} Çözüm için EPIAS_USERNAME/EPIAS_PASSWORD değerlerini ekleyip TGT ile yeni MCP servisini kullanın.`,
        publicError.statusCode || 502
      );
    }

    if (authError) {
      throw createEpiasError(
        `EPİAŞ verisi alınamadı. Kimlikli MCP hatası: ${authError.message} | Public MCP hatası: ${publicError.message}`,
        publicError.statusCode || authError.statusCode || 502
      );
    }

    throw publicError;
  }
}

async function listEpiasDataByDateRange(startDate, endDate) {
  const satirlar = await fetchEpiasRows(startDate, endDate);
  const normalSatirlar = normalizeEpiasRows(satirlar);

  if (satirlar.length > 0 && normalSatirlar.length === 0) {
    const ornek = satirlar[0] && typeof satirlar[0] === "object" ? Object.keys(satirlar[0]).join(", ") : "bilinmiyor";
    const err = new Error(`EPİAŞ veri formatı beklenenden farklı. Örnek alanlar: ${ornek}`);
    err.statusCode = 502;
    throw err;
  }

  return normalSatirlar;
}

module.exports = {
  listEpiasDataByDateRange
};
