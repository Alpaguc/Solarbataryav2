import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";
import { runSimulationNew, getEpiasData } from "../../api/client";

const STRATEJI_ADI = {
  arbitraj: "Arbitraj (Gelir Maksimizasyonu)",
  peak_shaving: "Peak Shaving (Guc Sinirlandirma)",
  price_threshold: "Fiyat Esigi Stratejisi"
};

function SimulasyonSayfasi() {
  const navigate = useNavigate();
  const {
    secilenProje, pvsystData, pvsystFilename, secilenBatarya, stratejiKonfig,
    setSimulasyonSonucu
  } = useAppWorkspace();

  const [durum, setDurum] = useState("hazir");
  const [ilerleme, setIlerleme] = useState(0);
  const [hata, setHata] = useState(null);

  const hazir = pvsystData && secilenBatarya && stratejiKonfig;

  async function handleCalistir() {
    if (!hazir) return;
    setDurum("calistirilyor");
    setHata(null);
    setIlerleme(10);

    try {
      setIlerleme(20);

      // EPIAS verisi cek — onceki tam yilin verisini kullan
      let epiasHourly = [];
      try {
        setIlerleme(30);
        const oncekiYil = new Date().getFullYear() - 1;
        const startDate = `${oncekiYil}-01-01`;
        const endDate = `${oncekiYil}-12-31`;
        const epiasRes = await getEpiasData({ startDate, endDate });
        if (epiasRes?.data && Array.isArray(epiasRes.data) && epiasRes.data.length > 0) {
          epiasHourly = epiasRes.data
            .map(d => {
              // d.Tarih = "DD.MM.YYYY", d.Saat = "HH:MM" (Türkiye saati)
              const trTarih = String(d.Tarih || "");
              const saat = String(d.Saat || "00:00");
              const parca = trTarih.split(".");
              if (parca.length < 3) return null;
              const day = Number(parca[0]);
              const month = Number(parca[1]);
              const year = Number(parca[2]);
              const hour = Number(saat.split(":")[0] || 0);
              if (!day || !month || !year || isNaN(hour)) return null;
              // Yil icerisindeki saat indeksi (Türkiye saati — PVSyst de UTC+3 ile calisir)
              const tarihObj = new Date(year, month - 1, day);
              const yilBasi = new Date(year, 0, 1);
              const gunSirasi = Math.round((tarihObj - yilBasi) / (24 * 3600 * 1000));
              const hourOfYear = gunSirasi * 24 + hour;
              if (hourOfYear < 0 || hourOfYear >= 8760) return null;
              return {
                hourIndex: hourOfYear,
                priceTryMwh: d["PTF (TL/MWh)"] || d.price || d.fiyat || 0
              };
            })
            .filter(Boolean);
        }
      } catch (_e) {
        // EPIAS erisilemezse backend dummy fiyat kullanir
        epiasHourly = [];
      }

      setIlerleme(50);

      // PVSyst CSV text yeniden oluştur (state'den data var zaten)
      const pvsystCsvMock = buildPvsystCsv(pvsystData);

      setIlerleme(60);

      const payload = {
        projectId: secilenProje.id,
        batteryCatalogId: secilenBatarya.id,
        pvsystCsvText: pvsystCsvMock,
        pvsystFilename: pvsystFilename || "upload.csv",
        epiasHourly,
        acMaxPowerKw: stratejiKonfig.gridParams?.acMaxPowerKw || secilenBatarya.maxDischargePowerKw,
        dcPowerKw: stratejiKonfig.gridParams?.dcPowerKw || null,
        gridLimitKw: stratejiKonfig.gridParams?.gridLimitKw || null,
        strategyType: stratejiKonfig.strategyType,
        strategyParams: stratejiKonfig.strategyParams,
        financialParams: stratejiKonfig.financialParams
      };

      setIlerleme(70);
      const result = await runSimulationNew(payload);
      setIlerleme(95);

      setSimulasyonSonucu(result);
      setIlerleme(100);
      setDurum("tamamlandi");

      setTimeout(() => navigate("/app/sonuclar"), 800);
    } catch (e) {
      setHata(e.response?.data?.message || e.message);
      setDurum("hata");
    }
  }

  return (
    <div>
      <div className="sayfa-baslik">
        <h2>4 — Simulasyon</h2>
        <p>Parametreleri kontrol edin ve simulasyonu baslatın.</p>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        {/* Ozet */}
        <div className="card">
          <div className="card-baslik">Simulasyon Ozeti</div>
          <div>
            <div className="sim-ozet-satir">
              <span>Proje</span>
              <strong>{secilenProje?.projectName || "-"}</strong>
            </div>
            <div className="sim-ozet-satir">
              <span>PVSyst Verisi</span>
              <strong>
                {pvsystData ? (
                  <span style={{ color: "var(--success)" }}>
                    {pvsystData.length} saat yuklu
                  </span>
                ) : (
                  <span style={{ color: "var(--danger)" }}>Eksik — PVSyst sayfasina gidin</span>
                )}
              </strong>
            </div>
            <div className="sim-ozet-satir">
              <span>Batarya</span>
              <strong>
                {secilenBatarya ? (
                  `${secilenBatarya.manufacturer} ${secilenBatarya.model} (${secilenBatarya.nominalCapacityKwh} kWh)`
                ) : (
                  <span style={{ color: "var(--danger)" }}>Eksik — Batarya sayfasina gidin</span>
                )}
              </strong>
            </div>
            <div className="sim-ozet-satir">
              <span>Strateji</span>
              <strong>
                {stratejiKonfig ? (
                  STRATEJI_ADI[stratejiKonfig.strategyType] || stratejiKonfig.strategyType
                ) : (
                  <span style={{ color: "var(--danger)" }}>Eksik — Strateji sayfasina gidin</span>
                )}
              </strong>
            </div>
            {stratejiKonfig?.gridParams?.acMaxPowerKw && (
              <div className="sim-ozet-satir">
                <span>AC Inverter Limit</span>
                <strong>{stratejiKonfig.gridParams.acMaxPowerKw} kW</strong>
              </div>
            )}
            {stratejiKonfig?.financialParams?.projectLifeYears && (
              <div className="sim-ozet-satir">
                <span>Proje Omru</span>
                <strong>{stratejiKonfig.financialParams.projectLifeYears} yil</strong>
              </div>
            )}
          </div>
        </div>

        {/* Calistir */}
        <div className="card">
          {durum === "hazir" && (
            <div className="sim-durum-kutu">
              <div className="sim-durum-ikon" style={{ background: "var(--primary-light)", color: "var(--primary)", width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.1rem" }}>SIM</div>
              <div className="sim-durum-baslik">Simulasyona Hazir</div>
              <div className="sim-durum-alt">
                8760 saatlik yillik enerji dengesi hesaplanacak. Birkaç saniye sürebilir.
              </div>
              <button
                type="button"
                className="btn btn-primary btn-buyuk mt-3"
                disabled={!hazir}
                onClick={handleCalistir}
              >
                Simulasyonu Calistir
              </button>
              {!hazir && (
                <div className="alert alert-warning mt-3">
                  Simulasyon icin PVSyst verisi, batarya ve strateji secimi gereklidir.
                </div>
              )}
            </div>
          )}

          {durum === "calistirilyor" && (
            <div className="sim-durum-kutu">
              <div className="spinner" />
              <div className="sim-durum-baslik">Simulasyon Calistiriliyor...</div>
              <div className="sim-durum-alt">8760 saat hesaplaniyor, lutfen bekleyin.</div>
              <div className="progress-bar mt-3" style={{ width: "100%", maxWidth: 320 }}>
                <div className="progress-fill" style={{ width: `${ilerleme}%` }} />
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 6 }}>
                %{ilerleme}
              </div>
            </div>
          )}

          {durum === "tamamlandi" && (
            <div className="sim-durum-kutu">
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="sim-durum-baslik">Simulasyon Tamamlandi!</div>
              <div className="sim-durum-alt">Sonuclara yonlendiriliyorsunuz...</div>
            </div>
          )}

          {durum === "hata" && (
            <div className="sim-durum-kutu">
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </div>
              <div className="sim-durum-baslik">Simulasyon Hatasi</div>
              <div className="alert alert-danger" style={{ maxWidth: 480 }}>{hata}</div>
              <button
                type="button"
                className="btn btn-primary mt-3"
                onClick={() => { setDurum("hazir"); setHata(null); }}
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * In-memory PVSyst data'dan minimal CSV olustur (backend parse edebilmesi icin).
 * Baslik satirinda tarih, EArray, E_Grid olmali (backend E_Grid/EArray ile satir tespit eder).
 */
function buildPvsystCsv(pvsystData) {
  const header = "tarih;GlobInc;GlobEff;EArray;E_Grid";
  const unit = ";W/m2;W/m2;kW;kW";
  const lines = [
    "PVSyst Re-export",
    "", "", "", "", "", "", "", "", "", "", "", "",
    header,
    unit
  ];
  const AY_GUN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  pvsystData.forEach((h, idx) => {
    const hourIdx = h.hourIndex != null ? h.hourIndex : idx;
    const hh = hourIdx % 24;
    let gunNo = Math.floor(hourIdx / 24);
    let ay = 0;
    while (ay < 12 && gunNo >= AY_GUN[ay]) {
      gunNo -= AY_GUN[ay];
      ay++;
    }
    const gun = gunNo + 1;
    const dd = String(gun).padStart(2, "0");
    const mm = String(ay + 1).padStart(2, "0");
    const eArray = (h.eArrayKwh ?? h.dcKw ?? 0).toFixed(3);
    const eGrid  = (h.eGridKwh  ?? h.acKw ?? 0).toFixed(3);
    lines.push(`${dd}.${mm}.1990 ${String(hh).padStart(2, "0")}:00;0;0;${eArray};${eGrid}`);
  });
  return lines.join("\n");
}

export default SimulasyonSayfasi;
