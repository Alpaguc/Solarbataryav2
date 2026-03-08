import { createContext, useContext, useMemo, useState } from "react";

const AppWorkspaceContext = createContext(null);

const HESAPLAMA_YONTEMLERI = [
  {
    code: "standart_dod",
    name: "Standart DOD",
    description: "DOD tabanli dengeli omur ve gelir modeli.",
    gelirKatsayisi: 1,
    yaslanmaKatsayisi: 1
  },
  {
    code: "korumali_omur",
    name: "Korumali Omur",
    description: "Daha dusuk gerilimle daha iyi kapasite korunumu odakli.",
    gelirKatsayisi: 0.9,
    yaslanmaKatsayisi: 0.75
  },
  {
    code: "agresif_getiri",
    name: "Agresif Getiri",
    description: "Yuksek kullanim ile daha fazla gelir, daha hizli yaslanma.",
    gelirKatsayisi: 1.2,
    yaslanmaKatsayisi: 1.35
  }
];

const varsayilanVeriGirisi = {
  projeAdi: "",
  lokasyon: "",
  kuruluGucKw: 5000,
  yillikUretimMwh: 9200,
  yillikTuketimMwh: 8600,
  bazEnerjiFiyatiTryMwh: 2850
};

const varsayilanDepolamaliSistem = {
  bataryaKimyasi: "LFP",
  depolamaKapasitesiKwh: 10000,
  inverterGucuKw: 2500,
  minSoc: 0.1,
  maxSoc: 0.95,
  hedefSarjSoc: 0.9,
  hedefDesarjSoc: 0.2,
  gunlukDongu: 1
};

const varsayilanHesaplama = {
  yontemKodu: "standart_dod",
  projeYili: 10,
  enerjiFiyatArtisYuzde: 12,
  iskontoOraniYuzde: 18,
  yillikBakimTry: 15000
};

function toNumber(deger, fallback = 0) {
  const sayi = Number(deger);
  return Number.isFinite(sayi) ? sayi : fallback;
}

function hesaplaAylikKapasiteSerisi({ projeYili, depolamaKapasitesiKwh, yaslanmaOraniYillik }) {
  const toplamAy = projeYili * 12;
  const seri = [];
  for (let ay = 1; ay <= toplamAy; ay += 1) {
    const yilKarsiligi = ay / 12;
    const kapasiteOrani = Math.max(0.6, 1 - yaslanmaOraniYillik * yilKarsiligi);
    seri.push({
      ay,
      kapasiteKwh: Number((depolamaKapasitesiKwh * kapasiteOrani).toFixed(2))
    });
  }
  return seri;
}

function hesaplaSocOrnekSerisi({ hedefSarjSoc, hedefDesarjSoc }) {
  const seri = [];
  for (let saatIndex = 0; saatIndex < 24 * 14; saatIndex += 1) {
    const gunIciSaat = saatIndex % 24;
    const faz = gunIciSaat / 24;
    const genlik = Math.max(0.01, hedefSarjSoc - hedefDesarjSoc);
    const socYuzde = (hedefDesarjSoc + genlik * (0.5 + 0.5 * Math.sin((faz - 0.25) * Math.PI * 2))) * 100;
    seri.push({
      saatIndex,
      socYuzde: Number(socYuzde.toFixed(2))
    });
  }
  return seri;
}

function hesaplaAnalizSonucu(veriGirisi, depolamaliSistem, hesaplama) {
  const yontem =
    HESAPLAMA_YONTEMLERI.find((item) => item.code === hesaplama.yontemKodu) || HESAPLAMA_YONTEMLERI[0];

  const projeYili = Math.max(1, toNumber(hesaplama.projeYili, 10));
  const bazEnerjiFiyati = Math.max(1, toNumber(veriGirisi.bazEnerjiFiyatiTryMwh, 2850));
  const fiyatArtis = Math.max(0, toNumber(hesaplama.enerjiFiyatArtisYuzde, 12) / 100);
  const bakim = Math.max(0, toNumber(hesaplama.yillikBakimTry, 15000));
  const depolamaKapasitesi = Math.max(1, toNumber(depolamaliSistem.depolamaKapasitesiKwh, 10000));
  const inverterGucu = Math.max(1, toNumber(depolamaliSistem.inverterGucuKw, 2500));
  const gunlukDongu = Math.max(0.3, toNumber(depolamaliSistem.gunlukDongu, 1));
  const yillikUretim = Math.max(1, toNumber(veriGirisi.yillikUretimMwh, 9200));

  const depolamaEtkiOrani = Math.min(0.52, (depolamaKapasitesi / Math.max(1, inverterGucu * 8)) * 0.22 * yontem.gelirKatsayisi);
  const yaslanmaOraniYillik = 0.022 * yontem.yaslanmaKatsayisi + (gunlukDongu - 1) * 0.007;

  let toplamBazGelir = 0;
  let toplamDepolamaliGelir = 0;
  let toplamEkGelir = 0;
  let birikimliNetEkGelir = 0;
  const yatirimMaliyetiTry = depolamaKapasitesi * 7200 + inverterGucu * 1600;
  let geriOdemeYili = null;
  const annualCashflow = [];

  for (let yil = 1; yil <= projeYili; yil += 1) {
    const yilFiyat = bazEnerjiFiyati * (1 + fiyatArtis) ** (yil - 1);
    const bazGelirTry = yillikUretim * yilFiyat;
    const kapasiteKorunum = Math.max(0.62, 1 - yaslanmaOraniYillik * yil);
    const depolamaliGelirTry = bazGelirTry * (1 + depolamaEtkiOrani * kapasiteKorunum);
    const yillikBakimTry = bakim * (1 + 0.08) ** (yil - 1);
    const netEkGelirTry = depolamaliGelirTry - bazGelirTry - yillikBakimTry;

    toplamBazGelir += bazGelirTry;
    toplamDepolamaliGelir += depolamaliGelirTry;
    toplamEkGelir += netEkGelirTry;
    birikimliNetEkGelir += netEkGelirTry;

    if (!geriOdemeYili && birikimliNetEkGelir >= yatirimMaliyetiTry) {
      geriOdemeYili = yil;
    }

    annualCashflow.push({
      yil,
      bazGelirTry: Number(bazGelirTry.toFixed(2)),
      depolamaliGelirTry: Number(depolamaliGelirTry.toFixed(2)),
      yillikBakimTry: Number(yillikBakimTry.toFixed(2)),
      netEkGelirTry: Number(netEkGelirTry.toFixed(2))
    });
  }

  const finalCapacityPercent = Math.max(60, 100 - yaslanmaOraniYillik * projeYili * 100);
  const finalCapacityKwh = depolamaKapasitesi * (finalCapacityPercent / 100);
  const roiPercent = (toplamEkGelir / Math.max(1, yatirimMaliyetiTry)) * 100;

  return {
    methodCode: yontem.code,
    calculatedAt: new Date().toISOString(),
    summary: {
      totalWithBatteryRevenueTry: Number(toplamDepolamaliGelir.toFixed(2)),
      extraRevenueTry: Number(toplamEkGelir.toFixed(2)),
      paybackYears: geriOdemeYili,
      roiPercent: Number(roiPercent.toFixed(2)),
      finalCapacityKwh: Number(finalCapacityKwh.toFixed(2)),
      finalCapacityPercent: Number(finalCapacityPercent.toFixed(2))
    },
    series: {
      monthlyCapacity: hesaplaAylikKapasiteSerisi({
        projeYili,
        depolamaKapasitesiKwh: depolamaKapasitesi,
        yaslanmaOraniYillik
      }),
      hourlySocSample: hesaplaSocOrnekSerisi({
        hedefSarjSoc: toNumber(depolamaliSistem.hedefSarjSoc, 0.9),
        hedefDesarjSoc: toNumber(depolamaliSistem.hedefDesarjSoc, 0.2)
      }),
      annualCashflow
    }
  };
}

function AppWorkspaceProvider({ children }) {
  const [veriGirisi, setVeriGirisi] = useState(varsayilanVeriGirisi);
  const [depolamaliSistem, setDepolamaliSistem] = useState(varsayilanDepolamaliSistem);
  const [hesaplama, setHesaplama] = useState(varsayilanHesaplama);
  const [analizSonucu, setAnalizSonucu] = useState(null);

  const veriGirisiTamam = Boolean(
    String(veriGirisi.projeAdi || "").trim() &&
      String(veriGirisi.lokasyon || "").trim() &&
      toNumber(veriGirisi.kuruluGucKw, 0) > 0 &&
      toNumber(veriGirisi.yillikUretimMwh, 0) > 0
  );

  const depolamaliSistemTamam = Boolean(
    toNumber(depolamaliSistem.depolamaKapasitesiKwh, 0) > 0 &&
      toNumber(depolamaliSistem.inverterGucuKw, 0) > 0
  );

  const analizHazir = veriGirisiTamam && depolamaliSistemTamam;

  function alanGuncelle(alan, patch) {
    if (alan === "veriGirisi") {
      setVeriGirisi((prev) => ({ ...prev, ...patch }));
      return;
    }
    if (alan === "depolamaliSistem") {
      setDepolamaliSistem((prev) => ({ ...prev, ...patch }));
      return;
    }
    if (alan === "hesaplama") {
      setHesaplama((prev) => ({ ...prev, ...patch }));
    }
  }

  function analizHesapla() {
    const sonuc = hesaplaAnalizSonucu(veriGirisi, depolamaliSistem, hesaplama);
    setAnalizSonucu(sonuc);
    return sonuc;
  }

  const value = useMemo(
    () => ({
      veriGirisi,
      depolamaliSistem,
      hesaplama,
      analizSonucu,
      veriGirisiTamam,
      depolamaliSistemTamam,
      analizHazir,
      hesaplamaYontemleri: HESAPLAMA_YONTEMLERI,
      alanGuncelle,
      analizHesapla
    }),
    [veriGirisi, depolamaliSistem, hesaplama, analizSonucu, veriGirisiTamam, depolamaliSistemTamam, analizHazir]
  );

  return <AppWorkspaceContext.Provider value={value}>{children}</AppWorkspaceContext.Provider>;
}

function useAppWorkspace() {
  const context = useContext(AppWorkspaceContext);
  if (!context) {
    throw new Error("useAppWorkspace sadece AppWorkspaceProvider altinda kullanilabilir.");
  }
  return context;
}

export { AppWorkspaceProvider, useAppWorkspace };
