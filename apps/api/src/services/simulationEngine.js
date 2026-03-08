/**
 * Simülasyon Motoru - 8760 saatlik enerji depolama simülasyonu
 * Stratejiler: arbitraj | peak_shaving | price_threshold
 */

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Gerçek SOC bazlı verimlilik: verilen SOC'ta şarj/deşarj verimliliği
 * Basit model: verim sabittir (ileride eğri eklenebilir)
 */
function getChargeEff(battery) { return battery.chargeEfficiency || 0.95; }
function getDischargeEff(battery) { return battery.dischargeEfficiency || 0.95; }

/**
 * Döngü degradasyonuna göre kapasiteyi hesapla
 * cycle_life_json: [[dod1, cycles1], [dod2, cycles2], ...]
 * Her döngü, DOD'una göre kapasiteyi kümülatif olarak azaltır
 */
function computeCycleDegradation(battery, cumulativeCycleEquiv) {
  const cycleLife = battery.cycleLifeJson;
  if (!cycleLife || cycleLife.length === 0) {
    const defaultCycles = 3000;
    return Math.max(0.5, 1 - cumulativeCycleEquiv / defaultCycles * 0.2);
  }

  const dod08 = cycleLife.find(([d]) => Math.abs(d - 0.8) < 0.05);
  const maxCycles = dod08 ? dod08[1] : (cycleLife[cycleLife.length - 1]?.[1] || 3000);

  const kapasiteFaktoru = Math.max(0.6, 1 - (cumulativeCycleEquiv / maxCycles) * 0.2);
  return kapasiteFaktoru;
}

/**
 * Takvim degradasyonu: yıl içindeki geçen süreye göre
 * @param {number} hour - 0..8759
 * @param {number} pctPerYear - ör 2.0 => yılda %2
 */
function computeCalendarDegradation(hour, pctPerYear) {
  const fracYear = hour / 8760;
  return 1 - (pctPerYear / 100) * fracYear;
}

/**
 * Fiyat bazlı arbitraj planı hesapla
 * En ucuz %33 saatler şarj, en pahalı %33 saatler deşarj
 */
function computeArbitragePlan(epiasData, battery, params) {
  const n = epiasData.length;
  const prices = epiasData.map((d, i) => ({ i, price: d.priceTryMwh }));
  const sorted = [...prices].sort((a, b) => a.price - b.price);

  const chargeCount = Math.floor(n * 0.33);
  const dischargeCount = Math.floor(n * 0.33);

  const chargeHours = new Set(sorted.slice(0, chargeCount).map(d => d.i));
  const dischargeHours = new Set(sorted.slice(n - dischargeCount).map(d => d.i));

  const maxChargePower = battery.maxChargePowerKw;
  const maxDischargePower = battery.maxDischargePowerKw;

  return epiasData.map((_, i) => {
    if (chargeHours.has(i)) return { charge: maxChargePower, discharge: 0 };
    if (dischargeHours.has(i)) return { charge: 0, discharge: maxDischargePower };
    return { charge: 0, discharge: 0 };
  });
}

/**
 * Peak Shaving stratejisi için anlık şarj/deşarj hesapla
 */
function computePeakShaving(acKw, socKwh, currentCapKwh, battery, params) {
  const gridLimit = params.gridLimitKw || battery.maxDischargePowerKw;
  const minSocKwh = battery.minSoc * currentCapKwh;
  const maxSocKwh = battery.maxSoc * currentCapKwh;

  let charge = 0;
  let discharge = 0;

  if (acKw > gridLimit) {
    const excess = acKw - gridLimit;
    const maxAllowed = Math.min(battery.maxChargePowerKw, maxSocKwh - socKwh);
    charge = Math.max(0, Math.min(excess, maxAllowed));
  } else if (acKw < gridLimit * 0.5 && socKwh > minSocKwh) {
    const gap = gridLimit - acKw;
    const maxAllowed = Math.min(battery.maxDischargePowerKw, socKwh - minSocKwh);
    discharge = Math.max(0, Math.min(gap, maxAllowed));
  }

  return { charge, discharge };
}

/**
 * Fiyat Eşiği stratejisi için anlık şarj/deşarj hesapla
 */
function computePriceThreshold(priceTryMwh, availableForCharge, socKwh, currentCapKwh, battery, params) {
  const lowThreshold = params.buyThresholdTryMwh || 500;
  const highThreshold = params.sellThresholdTryMwh || 2000;
  const minSocKwh = battery.minSoc * currentCapKwh;
  const maxSocKwh = battery.maxSoc * currentCapKwh;

  let charge = 0;
  let discharge = 0;

  if (priceTryMwh <= lowThreshold) {
    const maxAllowed = Math.min(battery.maxChargePowerKw, maxSocKwh - socKwh, availableForCharge);
    charge = Math.max(0, maxAllowed);
  } else if (priceTryMwh >= highThreshold) {
    const maxAllowed = Math.min(battery.maxDischargePowerKw, socKwh - minSocKwh);
    discharge = Math.max(0, maxAllowed);
  }

  return { charge, discharge };
}

/**
 * NPV hesapla
 */
function computeNpv(cashFlows, discountRate) {
  let npv = 0;
  for (let i = 0; i < cashFlows.length; i++) {
    npv += cashFlows[i] / Math.pow(1 + discountRate, i);
  }
  return npv;
}

/**
 * IRR hesapla (Newton-Raphson yaklaşımı)
 */
function computeIrr(cashFlows) {
  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const factor = Math.pow(1 + rate, i);
      npv += cashFlows[i] / factor;
      dnpv -= i * cashFlows[i] / (factor * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const delta = npv / dnpv;
    rate -= delta;
    if (Math.abs(delta) < 1e-8) break;
  }
  return isFinite(rate) ? rate : null;
}

/**
 * Finansal KPI hesapla
 */
function computeKpis(hourlyResults, battery, financialParams) {
  const {
    discountRate = 0.12,
    projectLifeYears = 15,
    batteryCapacityKwh,
    inverterCostTry = 0
  } = financialParams || {};

  const capacityKwh = batteryCapacityKwh || battery.nominalCapacityKwh;
  const costPerKwh = battery.costPerKwhTry || 25000;
  const annualMaint = battery.annualMaintenanceTry || capacityKwh * 100;
  const scrapPct = battery.scrapValuePct || 0.10;

  const initialInvestment = capacityKwh * costPerKwh + (inverterCostTry || 0);
  const scrapValue = initialInvestment * scrapPct;

  const totalRevenueTry = hourlyResults.reduce((s, r) => s + (r.revenueTry || 0), 0);
  const totalDischargeMwh = hourlyResults.reduce((s, r) => s + (r.dischargeKw || 0), 0) / 1000;
  const totalChargeKwh = hourlyResults.reduce((s, r) => s + (r.chargeKw || 0), 0);
  const totalDischargeKwh = hourlyResults.reduce((s, r) => s + (r.dischargeKw || 0), 0);

  const yillikNetGelir = totalRevenueTry - annualMaint;

  const cashFlows = [-initialInvestment];
  for (let y = 1; y <= projectLifeYears; y++) {
    const degradeFactor = Math.pow(1 - battery.calendarDegradationPctPerYear / 100, y);
    let yillikGelir = yillikNetGelir * degradeFactor;
    if (y === projectLifeYears) yillikGelir += scrapValue;
    cashFlows.push(yillikGelir);
  }

  const npv = computeNpv(cashFlows, discountRate);
  const irr = computeIrr(cashFlows);

  const lifetimeDischargeMwh = totalDischargeMwh * projectLifeYears;
  const lifetimeCost = initialInvestment + annualMaint * projectLifeYears - scrapValue;
  const lcoe = lifetimeDischargeMwh > 0 ? (lifetimeCost / lifetimeDischargeMwh) : null;

  const roi = yillikNetGelir > 0 ? (initialInvestment / yillikNetGelir) : null;

  let geriOdeme = null;
  let kumulatif = -initialInvestment;
  for (let y = 1; y <= projectLifeYears; y++) {
    const degradeFactor = Math.pow(1 - battery.calendarDegradationPctPerYear / 100, y);
    kumulatif += yillikNetGelir * degradeFactor;
    if (kumulatif >= 0 && geriOdeme === null) {
      geriOdeme = y;
    }
  }

  return {
    initialInvestmentTry: Math.round(initialInvestment),
    annualRevenueTry: Math.round(totalRevenueTry),
    annualMaintenanceTry: Math.round(annualMaint),
    annualNetRevenueTry: Math.round(yillikNetGelir),
    npvTry: Math.round(npv),
    irrPct: irr !== null ? Math.round(irr * 10000) / 100 : null,
    lcoeTryMwh: lcoe !== null ? Math.round(lcoe) : null,
    roiYears: roi !== null ? Math.round(roi * 10) / 10 : null,
    paybackYears: geriOdeme,
    projectLifeYears,
    totalDischargeMwh: Math.round(totalDischargeMwh * 10) / 10,
    totalChargeKwh: Math.round(totalChargeKwh),
    totalDischargeKwh: Math.round(totalDischargeKwh),
    roundTripEfficiencyPct: totalChargeKwh > 0 ? Math.round((totalDischargeKwh / totalChargeKwh) * 1000) / 10 : null
  };
}

/**
 * Ana simülasyon fonksiyonu
 * @param {Array} pvsystData - [{hourIndex, dcKw, acKw}] 8760 eleman
 * @param {Array} epiasData  - [{hourIndex, priceTryMwh}] 8760 eleman
 * @param {Object} battery   - batarya özellikleri
 * @param {string} strategy  - 'arbitraj' | 'peak_shaving' | 'price_threshold'
 * @param {Object} params    - strateji parametreleri + finansal parametreler
 */
function runSimulation(pvsystData, epiasData, battery, strategy, params) {
  const n = Math.min(pvsystData.length, epiasData.length, 8760);
  const acMaxPower = params.acMaxPowerKw || battery.maxDischargePowerKw;

  const minSoc = battery.minSoc || 0.1;
  const maxSoc = battery.maxSoc || 0.9;
  const nomCap = battery.nominalCapacityKwh;

  let socKwh = nomCap * minSoc;
  let cumulativeRevenue = 0;
  let cumulativeCycleEquiv = 0;

  let arbitrajPlan = null;
  if (strategy === "arbitraj") {
    arbitrajPlan = computeArbitragePlan(epiasData, battery, params);
  }

  const hourlyResults = [];
  const monthlyData = Array.from({ length: 12 }, () => ({
    revenueTry: 0, chargeKwh: 0, dischargeKwh: 0
  }));

  for (let h = 0; h < n; h++) {
    const pv = pvsystData[h];
    const ep = epiasData[h];

    const dcKw = pv.dcKw || 0;
    const acKw = pv.acKw || 0;
    const priceTryMwh = ep.priceTryMwh || 0;

    // Clipping: DC inverter limitini aşan kısım
    const clippingKw = Math.max(0, dcKw - acMaxPower);

    // Mevcut kapasiteyi degradasyonla hesapla
    const calDeg = computeCalendarDegradation(h, battery.calendarDegradationPctPerYear || 2.0);
    const cycDeg = computeCycleDegradation(battery, cumulativeCycleEquiv);
    const currentCapKwh = nomCap * Math.min(calDeg, cycDeg);

    const minSocKwh = minSoc * currentCapKwh;
    const maxSocKwh = maxSoc * currentCapKwh;
    socKwh = clamp(socKwh, minSocKwh, maxSocKwh);

    let chargeKw = 0;
    let dischargeKw = 0;

    if (strategy === "arbitraj") {
      const plan = arbitrajPlan[h];
      chargeKw = clamp(
        Math.min(plan.charge, clippingKw > 0 ? clippingKw : plan.charge),
        0,
        Math.min(battery.maxChargePowerKw, maxSocKwh - socKwh)
      );
      dischargeKw = clamp(
        plan.discharge,
        0,
        Math.min(battery.maxDischargePowerKw, socKwh - minSocKwh)
      );
    } else if (strategy === "peak_shaving") {
      const ps = computePeakShaving(acKw, socKwh, currentCapKwh, battery, params);
      chargeKw = clamp(ps.charge, 0, Math.min(battery.maxChargePowerKw, maxSocKwh - socKwh));
      dischargeKw = clamp(ps.discharge, 0, Math.min(battery.maxDischargePowerKw, socKwh - minSocKwh));
    } else {
      const pt = computePriceThreshold(priceTryMwh, clippingKw, socKwh, currentCapKwh, battery, params);
      chargeKw = clamp(pt.charge, 0, Math.min(battery.maxChargePowerKw, maxSocKwh - socKwh));
      dischargeKw = clamp(pt.discharge, 0, Math.min(battery.maxDischargePowerKw, socKwh - minSocKwh));
    }

    // SOC güncelle
    const chargeEff = getChargeEff(battery);
    const dischargeEff = getDischargeEff(battery);

    const actualCharge = chargeKw * chargeEff;
    const actualDischarge = dischargeKw / dischargeEff;

    socKwh = clamp(socKwh + actualCharge - actualDischarge, minSocKwh, maxSocKwh);

    // Döngü sayısı (equivalen tam döngü)
    const cycleDepth = (chargeKw + dischargeKw) / 2 / (nomCap * (maxSoc - minSoc));
    cumulativeCycleEquiv += cycleDepth;

    // Gelir hesapla (deşarj edilirken fiyattan kazanç, şarj ederken maliyet)
    const revenueTry = (dischargeKw - chargeKw) * (priceTryMwh / 1000);
    cumulativeRevenue += revenueTry;

    // Ay indeksi (0..11)
    const monthIdx = Math.floor(h / 730);
    if (monthIdx < 12) {
      monthlyData[monthIdx].revenueTry += revenueTry;
      monthlyData[monthIdx].chargeKwh += chargeKw;
      monthlyData[monthIdx].dischargeKwh += dischargeKw;
    }

    const socPct = currentCapKwh > 0 ? (socKwh / currentCapKwh) * 100 : 0;

    hourlyResults.push({
      hourIndex: h,
      dcKw: Math.round(dcKw * 100) / 100,
      acKw: Math.round(acKw * 100) / 100,
      clippingKw: Math.round(clippingKw * 100) / 100,
      chargeKw: Math.round(chargeKw * 100) / 100,
      dischargeKw: Math.round(dischargeKw * 100) / 100,
      socPct: Math.round(socPct * 10) / 10,
      socKwh: Math.round(socKwh * 100) / 100,
      priceTryMwh: Math.round(priceTryMwh * 10) / 10,
      revenueTry: Math.round(revenueTry * 100) / 100,
      cumulativeRevenueTry: Math.round(cumulativeRevenue * 100) / 100,
      currentCapKwh: Math.round(currentCapKwh * 100) / 100
    });
  }

  const kpis = computeKpis(hourlyResults, battery, {
    ...(params.financial || {}),
    batteryCapacityKwh: nomCap
  });

  return {
    hourly: hourlyResults,
    monthly: monthlyData.map((m, i) => ({
      month: i + 1,
      revenueTry: Math.round(m.revenueTry),
      chargeKwh: Math.round(m.chargeKwh),
      dischargeKwh: Math.round(m.dischargeKwh)
    })),
    kpis,
    meta: {
      strategy,
      totalHours: n,
      batteryModel: battery.model,
      batteryCapacityKwh: nomCap
    }
  };
}

/**
 * PVSyst CSV parse fonksiyonu
 * E_Grid = sahaya verilen AC enerji (kWh)
 * EArray = DC uretim (kWh, opsiyonel)
 * Tum kolonlari dinamik tespit eder
 */
function parsePvsystCsv(csvText) {
  const lines = csvText.split(/\r?\n/);

  let headerLineIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    if (
      (lines[i].includes("E_Grid") || lines[i].includes("EArray")) &&
      lines[i].includes(";")
    ) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx === -1) {
    throw new Error("PVSyst CSV baslik satiri bulunamadi (E_Grid/EArray).");
  }

  const headers = lines[headerLineIdx]
    .split(";")
    .map(h => h.trim().replace(/^"/, "").replace(/"$/, ""));

  const unitLine = lines[headerLineIdx + 1] || "";
  const units = unitLine
    .split(";")
    .map(u => u.trim().toLowerCase());

  function colIdx(...names) {
    for (const n of names) {
      const idx = headers.findIndex(h => h.toLowerCase() === n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function scaleFactor(idx) {
    if (idx < 0) return 1;
    const u = units[idx] || "";
    if (u.includes("wh") && !u.includes("kwh")) return 0.001;
    return 1;
  }

  const eGridIdx  = colIdx("E_Grid", "EGrid");
  const eArrayIdx = colIdx("EArray");

  if (eGridIdx === -1) {
    throw new Error(`E_Grid kolonu bulunamadi. Mevcut: ${headers.join(", ")}`);
  }

  const scaleGrid  = scaleFactor(eGridIdx);
  const scaleArray = scaleFactor(eArrayIdx);

  const data = [];
  for (let i = headerLineIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const c = line.split(";").map(v => v.trim().replace(",", "."));

    const eGridKwh  = (parseFloat(c[eGridIdx])  || 0) * scaleGrid;
    const eArrayKwh = eArrayIdx >= 0 ? (parseFloat(c[eArrayIdx]) || 0) * scaleArray : eGridKwh;

    // Eski alanlarla uyumluluk: dcKw = eArray, acKw = eGrid
    data.push({
      hourIndex: data.length,
      dcKw: eArrayKwh,
      acKw: eGridKwh,
      eArrayKwh,
      eGridKwh
    });

    if (data.length >= 8760) break;
  }

  if (data.length < 8700) {
    throw new Error(`Yetersiz veri: ${data.length} saat (min 8700 bekleniyor).`);
  }

  return data;
}

/**
 * EPIAS saatlik fiyat verisini simülasyon formatına dönüştür.
 * Hem PVSyst hem EPIAS Türkiye saati (UTC+3) kullanır — kaydırma gerekmez.
 * Frontend, her EPIAS kaydı için yil-ici-saat-indeksi (0..8759) hesaplayarak gönderir.
 */
function alignEpiasData(epiasHourly) {
  if (!epiasHourly || epiasHourly.length === 0) return [];

  const aligned = new Array(8760).fill(null).map((_, i) => ({
    hourIndex: i,
    priceTryMwh: 0
  }));

  for (const entry of epiasHourly) {
    const idx = entry.hourIndex !== undefined ? Number(entry.hourIndex) : (entry.hour || 0);
    if (idx >= 0 && idx < 8760) {
      aligned[idx].priceTryMwh = entry.priceTryMwh || entry.price || 0;
    }
  }

  // Bosluk doldur: fiyat girisi olmayan saatler icin onceki saatten fiyat al
  let sonFiyat = 1000;
  for (let i = 0; i < 8760; i++) {
    if (aligned[i].priceTryMwh > 0) {
      sonFiyat = aligned[i].priceTryMwh;
    } else {
      aligned[i].priceTryMwh = sonFiyat;
    }
  }

  return aligned;
}

module.exports = { runSimulation, parsePvsystCsv, alignEpiasData, computeKpis };
