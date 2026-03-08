import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const STRATEJILER = [
  {
    key: "arbitraj",
    adi: "Arbitraj",
    ikon: "📈",
    aciklama: "En ucuz saatlerde satin al, en pahali saatlerde sat. EPIAS fiyat verisiyle net geliri maksimize et."
  },
  {
    key: "peak_shaving",
    adi: "Peak Shaving",
    ikon: "⚡",
    aciklama: "Sahaya gucunu belirli bir limite kisitla. Limit asiminda fazla enerjiyi bataryaya depola, dusuk saatlerde desarj et."
  },
  {
    key: "price_threshold",
    adi: "Fiyat Esigi",
    ikon: "🎯",
    aciklama: "EPIAS fiyati alt esik altindaysa klipping enerjisini depola, ust esik ustundeyse desarj ederek sat."
  }
];

function ArbitrajForm({ params, onChange }) {
  return (
    <div>
      <div className="alert alert-info">
        Tum yilin EPIAS fiyati analiz edilir. En ucuz %33 saatler sarj, en pahali %33 saatler desarj olarak planlanan.
        SOC kisitlari gozzetilir.
      </div>
    </div>
  );
}

function PeakShavingForm({ params, onChange }) {
  return (
    <div className="form-grid-2">
      <div className="form-grup">
        <label>Maksimum Sahaya Gucu (kW)</label>
        <input
          type="number"
          min="1"
          value={params.gridLimitKw || ""}
          onChange={e => onChange({ ...params, gridLimitKw: Number(e.target.value) })}
          placeholder="ornek: 500"
        />
        <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
          Sahaya gonderilecek maksimum guc. Bu degeri asan DC uretim bataryaya yonlendirilir.
        </small>
      </div>
    </div>
  );
}

function PriceThresholdForm({ params, onChange }) {
  return (
    <div className="form-grid-2">
      <div className="form-grup">
        <label>Sarj Alt Esigi (₺/MWh)</label>
        <input
          type="number"
          min="0"
          value={params.buyThresholdTryMwh || ""}
          onChange={e => onChange({ ...params, buyThresholdTryMwh: Number(e.target.value) })}
          placeholder="ornek: 500"
        />
        <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
          EPIAS fiyati bu degerin altindaysa klipping enerjisi bataryaya yuklenir.
        </small>
      </div>
      <div className="form-grup">
        <label>Desarj Ust Esigi (₺/MWh)</label>
        <input
          type="number"
          min="0"
          value={params.sellThresholdTryMwh || ""}
          onChange={e => onChange({ ...params, sellThresholdTryMwh: Number(e.target.value) })}
          placeholder="ornek: 2000"
        />
        <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
          EPIAS fiyati bu degerin ustundeyse batarya sahaya desarj yapar.
        </small>
      </div>
    </div>
  );
}

function StratejiSayfasi() {
  const navigate = useNavigate();
  const { stratejiKonfig, setStratejiKonfig, secilenBatarya } = useAppWorkspace();

  const [seciliStrateji, setSeciliStrateji] = useState(stratejiKonfig?.strategyType || null);
  const [stratejParams, setStratejParams] = useState(stratejiKonfig?.strategyParams || {});
  const [finansalParams, setFinansalParams] = useState(stratejiKonfig?.financialParams || {
    discountRate: 0.12,
    projectLifeYears: 15,
    inverterCostTry: 0
  });
  const [gridParams, setGridParams] = useState(stratejiKonfig?.gridParams || {
    acMaxPowerKw: secilenBatarya?.maxDischargePowerKw || "",
    dcPowerKw: "",
    gridLimitKw: ""
  });

  function handleKaydet() {
    if (!seciliStrateji) return;
    setStratejiKonfig({
      strategyType: seciliStrateji,
      strategyParams: stratejParams,
      financialParams: finansalParams,
      gridParams
    });
    navigate("/app/simulasyon");
  }

  return (
    <div>
      <div className="sayfa-baslik">
        <h2>3 — Strateji Secimi</h2>
        <p>Batarya isletim stratejisini ve parametreleri belirleyin.</p>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <div className="card">
          <div className="card-baslik">Isletim Stratejisi</div>
          <div className="strateji-secim-grid">
            {STRATEJILER.map(str => (
              <div
                key={str.key}
                className={`strateji-kart ${seciliStrateji === str.key ? "secili" : ""}`}
                onClick={() => setSeciliStrateji(str.key)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setSeciliStrateji(str.key)}
              >
                <div className="strateji-kart-ikon">{str.ikon}</div>
                <div className="strateji-kart-adi">{str.adi}</div>
                <div className="strateji-kart-aciklama">{str.aciklama}</div>
              </div>
            ))}
          </div>

          {seciliStrateji && (
            <div style={{ marginTop: 20 }}>
              <div className="card-baslik">Strateji Parametreleri</div>
              {seciliStrateji === "arbitraj" && <ArbitrajForm params={stratejParams} onChange={setStratejParams} />}
              {seciliStrateji === "peak_shaving" && <PeakShavingForm params={stratejParams} onChange={setStratejParams} />}
              {seciliStrateji === "price_threshold" && <PriceThresholdForm params={stratejParams} onChange={setStratejParams} />}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-baslik">Sistem Parametreleri</div>
          <div className="form-grid-3">
            <div className="form-grup">
              <label>AC Inverter Limit (kW)</label>
              <input
                type="number"
                min="1"
                value={gridParams.acMaxPowerKw}
                onChange={e => setGridParams(p => ({ ...p, acMaxPowerKw: Number(e.target.value) }))}
                placeholder="Inverter AC cikis gucu"
              />
              <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                Bu limiti asan DC uretim klipping'dir ve bataryaya yonlendirilir.
              </small>
            </div>
            <div className="form-grup">
              <label>DC Panel Gucu (kWp)</label>
              <input
                type="number"
                min="1"
                value={gridParams.dcPowerKw}
                onChange={e => setGridParams(p => ({ ...p, dcPowerKw: Number(e.target.value) }))}
                placeholder="GES toplam guc"
              />
            </div>
            <div className="form-grup">
              <label>Sahaya Baglanti Limiti (kW)</label>
              <input
                type="number"
                min="1"
                value={gridParams.gridLimitKw}
                onChange={e => setGridParams(p => ({ ...p, gridLimitKw: Number(e.target.value) }))}
                placeholder="Opsiyonel"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-baslik">Finansal Parametreler</div>
          <div className="form-grid-3">
            <div className="form-grup">
              <label>Iskonto Orani (%)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="30"
                value={finansalParams.discountRate * 100}
                onChange={e => setFinansalParams(p => ({ ...p, discountRate: Number(e.target.value) / 100 }))}
              />
            </div>
            <div className="form-grup">
              <label>Proje Omru (Yil)</label>
              <input
                type="number"
                min="5"
                max="30"
                value={finansalParams.projectLifeYears}
                onChange={e => setFinansalParams(p => ({ ...p, projectLifeYears: Number(e.target.value) }))}
              />
            </div>
            <div className="form-grup">
              <label>Inverter Maliyeti (₺)</label>
              <input
                type="number"
                min="0"
                value={finansalParams.inverterCostTry}
                onChange={e => setFinansalParams(p => ({ ...p, inverterCostTry: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-primary btn-buyuk"
            disabled={!seciliStrateji}
            onClick={handleKaydet}
          >
            Simulasyona Gec &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

export default StratejiSayfasi;
