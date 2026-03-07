const { guncelleKapasite } = require("./degradation");

function ortalama(arr) {
  if (!arr.length) return 0;
  return arr.reduce((toplam, v) => toplam + v, 0) / arr.length;
}

function mevsimselUretimKatsayisi(gunIndex) {
  const aci = (2 * Math.PI * gunIndex) / 365;
  return 0.75 + 0.25 * Math.sin(aci - Math.PI / 3);
}

function aylikEtiket(yil, ay) {
  return `${yil}-${String(ay + 1).padStart(2, "0")}`;
}

function simulasyonCalistir({
  girdi,
  bataryaModeli,
  gunesProfiliSaatlikKwh,
  tarifeProfiliSaatlikTryMwh
}) {
  const projeYili = girdi.projectYears;
  const toplamGun = projeYili * 365;
  const ilkKapasiteKwh = Number(bataryaModeli.nominal_capacity_kwh);
  let kapasiteKwh = ilkKapasiteKwh;
  let socKwh = ilkKapasiteKwh * 0.5;

  const minSoc = Number(bataryaModeli.min_soc);
  const maxSoc = Number(bataryaModeli.max_soc);
  const gunlukSarjHedefi = girdi.dailyChargeTargetSoc;
  const gunlukDesarjHedefi = girdi.dailyDischargeTargetSoc;

  const gucLimitiKwhSaat = Number(bataryaModeli.nominal_power_kw);
  const roundTripVerim = Number(bataryaModeli.round_trip_efficiency);
  const sarjVerimi = Math.sqrt(roundTripVerim);
  const desarjVerimi = Math.sqrt(roundTripVerim);

  let bazGelir = 0;
  let depolamaliGelir = 0;

  const saatlikSocOrnek = [];
  const aylikKapasiteSerisi = [];
  const yillikNakitAkisi = [];
  const saatlikDetay = [];
  const aylikFarkToplam = new Map();

  let yillikBazGelir = 0;
  let yillikDepolamaliGelir = 0;

  const fiyatlarKwh = tarifeProfiliSaatlikTryMwh.map((v) => v / 1000);
  const gunlukEsikFiyat = ortalama(fiyatlarKwh) * 1.18;

  const baslangic = new Date("2026-01-01T00:00:00.000Z");

  for (let gun = 0; gun < toplamGun; gun += 1) {
    const tarih = new Date(baslangic.getTime() + gun * 24 * 3600 * 1000);
    const yil = tarih.getUTCFullYear();
    const ay = tarih.getUTCMonth();
    const ayKey = aylikEtiket(yil, ay);

    let gunlukMinSoc = Number.POSITIVE_INFINITY;
    let gunlukMaxSoc = Number.NEGATIVE_INFINITY;
    let gunlukDesarjToplam = 0;

    for (let saat = 0; saat < 24; saat += 1) {
      const fiyatTryKwh = fiyatlarKwh[saat];
      const hamGunes = gunesProfiliSaatlikKwh[saat] * mevsimselUretimKatsayisi(gun);
      const gunesKwh = Math.max(0, hamGunes);

      const bazSaatlikGelir = gunesKwh * fiyatTryKwh;
      bazGelir += bazSaatlikGelir;
      yillikBazGelir += bazSaatlikGelir;

      let depolamaliSaatlikGelir = 0;
      let sarjEnerjisi = 0;
      let desarjEnerjisi = 0;

      const ustSinirKwh = kapasiteKwh * Math.min(maxSoc, gunlukSarjHedefi);
      const altSinirKwh = kapasiteKwh * Math.max(minSoc, gunlukDesarjHedefi);

      const depoyaBosAlan = Math.max(0, ustSinirKwh - socKwh);
      const depolamaIcinUygun = Math.min(gucLimitiKwhSaat, depoyaBosAlan / sarjVerimi);
      sarjEnerjisi = Math.min(gunesKwh, depolamaIcinUygun);
      socKwh += sarjEnerjisi * sarjVerimi;

      const direktSatis = Math.max(0, gunesKwh - sarjEnerjisi);
      depolamaliSaatlikGelir += direktSatis * fiyatTryKwh;

      if (fiyatTryKwh >= gunlukEsikFiyat && socKwh > altSinirKwh) {
        const depodanCekilebilir = Math.max(0, socKwh - altSinirKwh);
        const depodanKullanim = Math.min(gucLimitiKwhSaat, depodanCekilebilir);
        desarjEnerjisi = depodanKullanim;
        socKwh -= desarjEnerjisi;
        depolamaliSaatlikGelir += desarjEnerjisi * desarjVerimi * fiyatTryKwh;
        gunlukDesarjToplam += desarjEnerjisi;
      }

      depolamaliGelir += depolamaliSaatlikGelir;
      yillikDepolamaliGelir += depolamaliSaatlikGelir;

      const socOrani = kapasiteKwh > 0 ? socKwh / kapasiteKwh : 0;
      gunlukMinSoc = Math.min(gunlukMinSoc, socOrani);
      gunlukMaxSoc = Math.max(gunlukMaxSoc, socOrani);

      if (saatlikSocOrnek.length < 336) {
        saatlikSocOrnek.push({
          saatIndex: saatlikSocOrnek.length,
          socYuzde: Number((socOrani * 100).toFixed(2)),
          fiyatTryMwh: Number((fiyatTryKwh * 1000).toFixed(2))
        });
      }

      if (saatlikDetay.length < 24 * 365) {
        saatlikDetay.push({
          timestamp: new Date(tarih.getTime() + saat * 3600 * 1000).toISOString(),
          hourIndex: gun * 24 + saat,
          socPercent: Number((socOrani * 100).toFixed(2)),
          capacityKwh: Number(kapasiteKwh.toFixed(4)),
          chargeKwh: Number(sarjEnerjisi.toFixed(4)),
          dischargeKwh: Number((desarjEnerjisi * desarjVerimi).toFixed(4)),
          revenueTry: Number(depolamaliSaatlikGelir.toFixed(4))
        });
      }
    }

    const dodOrani = Math.max(0, gunlukMaxSoc - gunlukMinSoc);
    const efc = kapasiteKwh > 0 ? gunlukDesarjToplam / kapasiteKwh : 0;
    kapasiteKwh = guncelleKapasite({
      mevcutKapasiteKwh: kapasiteKwh,
      ilkKapasiteKwh,
      efc,
      dodOrani,
      cycleLifeAt80Dod: bataryaModeli.cycle_life_at_80_dod,
      yillikTakvimKaybiYuzde: bataryaModeli.calendar_degradation_pct_per_year
    });
    socKwh = Math.min(socKwh, kapasiteKwh * maxSoc);

    const ayToplam = aylikFarkToplam.get(ayKey) || { baz: 0, depolamali: 0, kapasite: kapasiteKwh };
    ayToplam.kapasite = kapasiteKwh;
    ayToplam.baz = bazGelir;
    ayToplam.depolamali = depolamaliGelir;
    aylikFarkToplam.set(ayKey, ayToplam);

    const ayinSonGunu = new Date(Date.UTC(yil, ay + 1, 0)).getUTCDate();
    if (tarih.getUTCDate() === ayinSonGunu) {
      aylikKapasiteSerisi.push({
        ay: ayKey,
        kapasiteKwh: Number(kapasiteKwh.toFixed(2)),
        kapasiteYuzde: Number(((kapasiteKwh / ilkKapasiteKwh) * 100).toFixed(2))
      });
    }

    if ((gun + 1) % 365 === 0) {
      const yilNo = (gun + 1) / 365;
      const yillikEkGelir = yillikDepolamaliGelir - yillikBazGelir - girdi.annualMaintenanceCostTry;
      yillikNakitAkisi.push({
        yil: yilNo,
        bazGelirTry: Number(yillikBazGelir.toFixed(2)),
        depolamaliGelirTry: Number(yillikDepolamaliGelir.toFixed(2)),
        yillikBakimTry: Number(girdi.annualMaintenanceCostTry.toFixed(2)),
        netEkGelirTry: Number(yillikEkGelir.toFixed(2))
      });
      yillikBazGelir = 0;
      yillikDepolamaliGelir = 0;
    }
  }

  const toplamEkGelir = depolamaliGelir - bazGelir;
  const ilkYilNetEkGelir = yillikNakitAkisi[0]?.netEkGelirTry ?? 0;
  const yatirimMaliyeti = Number(bataryaModeli.base_cost_try);
  const geriOdemeYili = ilkYilNetEkGelir > 0 ? yatirimMaliyeti / ilkYilNetEkGelir : null;
  const toplamBakim = girdi.annualMaintenanceCostTry * projeYili;
  const roi = yatirimMaliyeti > 0 ? ((toplamEkGelir - toplamBakim - yatirimMaliyeti) / yatirimMaliyeti) * 100 : 0;

  return {
    summary: {
      totalBaselineRevenueTry: Number(bazGelir.toFixed(2)),
      totalWithBatteryRevenueTry: Number(depolamaliGelir.toFixed(2)),
      extraRevenueTry: Number(toplamEkGelir.toFixed(2)),
      totalMaintenanceCostTry: Number(toplamBakim.toFixed(2)),
      investmentCostTry: Number(yatirimMaliyeti.toFixed(2)),
      paybackYears: geriOdemeYili ? Number(geriOdemeYili.toFixed(2)) : null,
      roiPercent: Number(roi.toFixed(2)),
      finalCapacityKwh: Number(kapasiteKwh.toFixed(2)),
      finalCapacityPercent: Number(((kapasiteKwh / ilkKapasiteKwh) * 100).toFixed(2))
    },
    series: {
      hourlySocSample: saatlikSocOrnek,
      monthlyCapacity: aylikKapasiteSerisi,
      annualCashflow: yillikNakitAkisi
    },
    hourlyResults: saatlikDetay
  };
}

module.exports = {
  simulasyonCalistir
};
