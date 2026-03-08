import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const AppWorkspaceContext = createContext(null);

function bugunIso() {
  return new Date().toISOString().slice(0, 10);
}

function yilBasiIso() {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

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

function varsayilanVeriGirisi(projeAdi = "", lokasyon = "", kuruluGucKw = 5000) {
  return {
    projeAdi,
    lokasyon,
    kuruluGucKw,
    yillikUretimMwh: 9200,
    yillikTuketimMwh: 8600,
    bazEnerjiFiyatiTryMwh: 2850,
    pvsystKayitSayisi: 0,
    pvsystDosyaAdi: "",
    epiasKayitSayisi: 0,
    epiasStartDate: yilBasiIso(),
    epiasEndDate: bugunIso()
  };
}

const VARSAYILAN_DEPOLAMALI_SISTEM = {
  bataryaKimyasi: "LFP",
  depolamaKapasitesiKwh: 10000,
  inverterGucuKw: 2500,
  minSoc: 0.1,
  maxSoc: 0.95,
  hedefSarjSoc: 0.9,
  hedefDesarjSoc: 0.2,
  gunlukDongu: 1
};

const VARSAYILAN_HESAPLAMA = {
  yontemKodu: "standart_dod",
  projeYili: 10,
  enerjiFiyatArtisYuzde: 12,
  iskontoOraniYuzde: 18,
  yillikBakimTry: 15000
};

function storageKey(projeId) {
  return `sb_ws_${projeId}`;
}

function projeVerisiYukle(projeId) {
  if (!projeId) return null;
  try {
    const ham = localStorage.getItem(storageKey(projeId));
    return ham ? JSON.parse(ham) : null;
  } catch (_e) {
    return null;
  }
}

function projeVerisiKaydet(projeId, veriGirisi, depolamaliSistem, hesaplama) {
  if (!projeId) return;
  try {
    localStorage.setItem(
      storageKey(projeId),
      JSON.stringify({ veriGirisi, depolamaliSistem, hesaplama })
    );
  } catch (_e) {
    // Kayit yapılamazsa sessizce devam et
  }
}

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

function simStorageKey(projeId) {
  return `sb_sim_${projeId}`;
}

function simVerisiYukle(projeId) {
  if (!projeId) return null;
  try {
    const ham = localStorage.getItem(simStorageKey(projeId));
    return ham ? JSON.parse(ham) : null;
  } catch (_e) {
    return null;
  }
}

function simVerisiKaydet(projeId, data) {
  if (!projeId) return;
  try {
    localStorage.setItem(simStorageKey(projeId), JSON.stringify(data));
  } catch (_e) { /* ignore */ }
}

function AppWorkspaceProvider({ children }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [veriGirisi, setVeriGirisi] = useState(varsayilanVeriGirisi());
  const [depolamaliSistem, setDepolamaliSistem] = useState(VARSAYILAN_DEPOLAMALI_SISTEM);
  const [hesaplama, setHesaplama] = useState(VARSAYILAN_HESAPLAMA);
  const [analizSonucu, setAnalizSonucu] = useState(null);

  const [projeListesi, setProjeListesi] = useState([]);
  const [secilenProje, setSecilenProje] = useState(null);
  const [totalProjectsCreated, setTotalProjectsCreated] = useState(0);
  const [projeYukleniyor, setProjeYukleniyor] = useState(false);
  const [projeHata, setProjeHata] = useState("");

  // Yeni simulasyon state'leri
  const [pvsystData, setPvsystDataRaw] = useState(null);
  const [pvsystFilename, setPvsystFilename] = useState(null);
  const [secilenBatarya, setSecilenBataryaRaw] = useState(null);
  const [stratejiKonfig, setStratejiKonfigRaw] = useState(null);
  const [simulasyonSonucu, setSimulasyonSonucuRaw] = useState(null);

  // Proje degisiminde otomatik kayit icin ref takibi
  const kaydediliyor = useRef(false);

  // Proje secili oldugunda durumu localStorage'a otomatik kaydet
  useEffect(() => {
    if (!secilenProje?.id || kaydediliyor.current) return;
    projeVerisiKaydet(secilenProje.id, veriGirisi, depolamaliSistem, hesaplama);
  }, [veriGirisi, depolamaliSistem, hesaplama, secilenProje]);

  // Simulasyon state fonksiyonlari
  function setPvsystData(data, filename = null) {
    setPvsystDataRaw(data);
    if (filename) setPvsystFilename(filename);
    if (secilenProje?.id) {
      const kayitli = simVerisiYukle(secilenProje.id) || {};
      simVerisiKaydet(secilenProje.id, { ...kayitli, pvsystFilename: filename || kayitli.pvsystFilename });
    }
  }

  function setSecilenBatarya(batarya) {
    setSecilenBataryaRaw(batarya);
    if (secilenProje?.id) {
      const kayitli = simVerisiYukle(secilenProje.id) || {};
      simVerisiKaydet(secilenProje.id, { ...kayitli, secilenBatarya: batarya });
    }
  }

  function setStratejiKonfig(konfig) {
    setStratejiKonfigRaw(konfig);
    if (secilenProje?.id) {
      const kayitli = simVerisiYukle(secilenProje.id) || {};
      simVerisiKaydet(secilenProje.id, { ...kayitli, stratejiKonfig: konfig });
    }
  }

  function setSimulasyonSonucu(sonuc) {
    setSimulasyonSonucuRaw(sonuc);
    if (secilenProje?.id) {
      const kayitli = simVerisiYukle(secilenProje.id) || {};
      simVerisiKaydet(secilenProje.id, { ...kayitli, simulasyonSonucu: sonuc });
    }
  }

  const projeYukle = useCallback(async () => {
    setProjeYukleniyor(true);
    setProjeHata("");
    try {
      if (!supabase) throw new Error("Supabase baglantisi yok.");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProjeListesi([]);
        setProjeYukleniyor(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const tumVeri = data || [];
      const aktifler = tumVeri
        .filter(p => !p.is_deleted)
        .map(p => ({
          id: p.id,
          projectName: p.project_name,
          location: p.location,
          installedPowerKw: p.installed_power_kw,
          description: p.description,
          createdAt: p.created_at
        }));
      setProjeListesi(aktifler);
      setTotalProjectsCreated(tumVeri.length);
    } catch (_err) {
      setProjeHata("Projeler yuklenemedi: " + (_err?.message || ""));
    } finally {
      setProjeYukleniyor(false);
    }
  }, []);

  // Auth hazir ve kullanici giris yapmissa projeleri Supabase'den yukle (her deploy sonrasi kalici)
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (!isAuthenticated) setProjeListesi([]);
      return;
    }
    projeYukle();
  }, [authLoading, isAuthenticated, projeYukle]);

  // Giris cikis veya hesap degisince proje listesini yeniden yukle
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) projeYukle();
      else setProjeListesi([]);
    });
    return () => subscription?.unsubscribe();
  }, [projeYukle]);

  // Proje acildiginda o projeye ait kayitli durumu yukle
  function projeAc(proje) {
    kaydediliyor.current = true;

    const kayitli = projeVerisiYukle(proje.id);

    if (kayitli) {
      setVeriGirisi(kayitli.veriGirisi || varsayilanVeriGirisi(proje.projectName, proje.location, proje.installedPowerKw));
      setDepolamaliSistem(kayitli.depolamaliSistem || VARSAYILAN_DEPOLAMALI_SISTEM);
      setHesaplama(kayitli.hesaplama || VARSAYILAN_HESAPLAMA);
    } else {
      setVeriGirisi(varsayilanVeriGirisi(
        proje.projectName,
        proje.location,
        proje.installedPowerKw || 5000
      ));
      setDepolamaliSistem(VARSAYILAN_DEPOLAMALI_SISTEM);
      setHesaplama(VARSAYILAN_HESAPLAMA);
    }

    // Simulasyon state'lerini proje'ye gore yukle
    const simKayitli = simVerisiYukle(proje.id);
    setPvsystDataRaw(null);
    setPvsystFilename(simKayitli?.pvsystFilename || null);
    setSecilenBataryaRaw(simKayitli?.secilenBatarya || null);
    setStratejiKonfigRaw(simKayitli?.stratejiKonfig || null);
    setSimulasyonSonucuRaw(simKayitli?.simulasyonSonucu || null);

    setAnalizSonucu(null);
    setSecilenProje(proje);

    setTimeout(() => { kaydediliyor.current = false; }, 50);
  }

  async function projeOlustur(payload) {
    if (!supabase) throw new Error("Supabase baglantisi yok.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Proje olusturmak icin giris yapmaniz gerekiyor.");

    const { projectName, location, installedPowerKw, description } = payload;
    const { data, error } = await supabase
      .from("user_projects")
      .insert({
        user_id: user.id,
        project_name: projectName,
        location: location,
        installed_power_kw: installedPowerKw || null,
        description: description || null,
        is_deleted: false
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const yeniProje = {
      id: data.id,
      projectName: data.project_name,
      location: data.location,
      installedPowerKw: data.installed_power_kw,
      description: data.description,
      createdAt: data.created_at
    };
    await projeYukle();
    projeAc(yeniProje);
    return yeniProje;
  }

  async function projeSil(projeId) {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("user_projects")
          .update({ is_deleted: true })
          .eq("id", projeId)
          .eq("user_id", user.id);
      }
    }
    try { localStorage.removeItem(storageKey(projeId)); } catch (_e) { /* ignore */ }
    try { localStorage.removeItem(simStorageKey(projeId)); } catch (_e) { /* ignore */ }
    setProjeListesi((prev) => prev.filter((p) => p.id !== projeId));
    if (secilenProje?.id === projeId) {
      setSecilenProje(null);
      setVeriGirisi(varsayilanVeriGirisi());
      setDepolamaliSistem(VARSAYILAN_DEPOLAMALI_SISTEM);
      setHesaplama(VARSAYILAN_HESAPLAMA);
      setAnalizSonucu(null);
      setPvsystDataRaw(null);
      setSecilenBataryaRaw(null);
      setStratejiKonfigRaw(null);
      setSimulasyonSonucuRaw(null);
    }
  }

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
      analizHesapla,
      projeListesi,
      secilenProje,
      totalProjectsCreated,
      projeYukleniyor,
      projeHata,
      projeYukle,
      projeOlustur,
      projeSil,
      projeAc,
      // Yeni simulasyon state'leri
      pvsystData,
      pvsystFilename,
      setPvsystData,
      secilenBatarya,
      setSecilenBatarya,
      stratejiKonfig,
      setStratejiKonfig,
      simulasyonSonucu,
      setSimulasyonSonucu
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      veriGirisi,
      depolamaliSistem,
      hesaplama,
      analizSonucu,
      veriGirisiTamam,
      depolamaliSistemTamam,
      analizHazir,
      projeListesi,
      secilenProje,
      totalProjectsCreated,
      projeYukleniyor,
      projeHata,
      projeYukle,
      pvsystData,
      pvsystFilename,
      secilenBatarya,
      stratejiKonfig,
      simulasyonSonucu
    ]
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
