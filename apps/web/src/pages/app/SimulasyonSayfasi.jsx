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

      // EPIAS verisi cek
      let epiasHourly = [];
      try {
        setIlerleme(30);
        const epiasRes = await getEpiasData({ limit: 9000 });
        if (epiasRes?.data && Array.isArray(epiasRes.data)) {
          epiasHourly = epiasRes.data.map((d, i) => ({
            hourIndex: i,
            priceTryMwh: d.price || d.fiyat || 0
          }));
        }
      } catch (_e) {
        // EPIAS verisi yoksa dummy kullan
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
              <div className="sim-durum-ikon">🚀</div>
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
              <div className="sim-durum-ikon">✅</div>
              <div className="sim-durum-baslik">Simulasyon Tamamlandi!</div>
              <div className="sim-durum-alt">Sonuclara yonlendiriliyorsunuz...</div>
            </div>
          )}

          {durum === "hata" && (
            <div className="sim-durum-kutu">
              <div className="sim-durum-ikon">❌</div>
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
 * In-memory PVSyst data'dan minimal CSV olustur (backend parse edebilmesi icin)
 * eArrayKwh = DC uretim, eGridKwh = sahaya AC enerji
 */
function buildPvsystCsv(pvsystData) {
  const header = "Date Hour;EArray;E_Grid";
  const unit = ";kWh;kWh";
  const lines = [
    "PVSyst Re-export",
    "", "", "", "", "", "", "", "", "", "", "", "",
    header,
    unit
  ];
  for (const h of pvsystData) {
    const saat = String(h.hourIndex % 24).padStart(2, "0");
    const eArray = (h.eArrayKwh ?? h.dcKw ?? 0).toFixed(3);
    const eGrid  = (h.eGridKwh  ?? h.acKw ?? 0).toFixed(3);
    lines.push(`1.01.1990 ${saat}:00;${eArray};${eGrid}`);
  }
  return lines.join("\n");
}

export default SimulasyonSayfasi;
