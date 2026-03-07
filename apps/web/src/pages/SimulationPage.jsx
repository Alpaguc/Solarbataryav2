import { useEffect, useMemo, useState } from "react";
import {
  getBrands,
  getModels,
  getSolarProfiles,
  getTariffs,
  runSimulation
} from "../api/client";
import LoadingBox from "../components/LoadingBox";
import KpiCards from "../components/KpiCards";
import LineChart from "../components/LineChart";
import AnnualCashflowTable from "../components/AnnualCashflowTable";

function SimulationPage({ project }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [solarProfiles, setSolarProfiles] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    brandId: "",
    batteryModelId: "",
    solarProfileCode: "",
    tariffProfileCode: "",
    projectYears: 10,
    dailyChargeTargetSoc: 0.9,
    dailyDischargeTargetSoc: 0.2,
    annualMaintenanceCostTry: 15000,
    tariffType: "sanayi"
  });

  useEffect(() => {
    async function ilkYukleme() {
      try {
        setLoading(true);
        const [brandData, solarData, tariffData] = await Promise.all([getBrands(), getSolarProfiles(), getTariffs()]);
        setBrands(brandData);
        setSolarProfiles(solarData);
        setTariffs(tariffData);

        const firstBrand = brandData[0];
        if (firstBrand) {
          const modelData = await getModels(firstBrand.id);
          setModels(modelData);
          setForm((prev) => ({
            ...prev,
            brandId: String(firstBrand.id),
            batteryModelId: String(modelData[0]?.id || ""),
            solarProfileCode: solarData[0]?.code || "",
            tariffProfileCode: tariffData[0]?.code || ""
          }));
        }
      } catch (err) {
        setError(err.response?.data?.error || "Katalog verileri yuklenemedi.");
      } finally {
        setLoading(false);
      }
    }

    ilkYukleme();
  }, []);

  async function markaDegistir(brandId) {
    setForm((prev) => ({ ...prev, brandId, batteryModelId: "" }));
    try {
      const modelData = await getModels(Number(brandId));
      setModels(modelData);
      setForm((prev) => ({ ...prev, batteryModelId: String(modelData[0]?.id || "") }));
    } catch (err) {
      setError(err.response?.data?.error || "Marka modelleri yuklenemedi.");
    }
  }

  async function formGonder(event) {
    event.preventDefault();
    setError("");
    setRunning(true);
    try {
      const payload = {
        projectId: Number(project?.id),
        batteryModelId: Number(form.batteryModelId),
        solarProfileCode: form.solarProfileCode,
        tariffProfileCode: form.tariffProfileCode,
        projectYears: Number(form.projectYears),
        dailyChargeTargetSoc: Number(form.dailyChargeTargetSoc),
        dailyDischargeTargetSoc: Number(form.dailyDischargeTargetSoc),
        annualMaintenanceCostTry: Number(form.annualMaintenanceCostTry),
        tariffType: form.tariffType
      };
      const sonuc = await runSimulation(payload);
      setResult(sonuc);
    } catch (err) {
      setError(err.response?.data?.error || "Simulasyon baslatilamadi.");
    } finally {
      setRunning(false);
    }
  }

  const seciliModel = useMemo(
    () => models.find((item) => String(item.id) === String(form.batteryModelId)),
    [models, form.batteryModelId]
  );

  if (loading) return <LoadingBox text="Katalog verileri yukleniyor..." />;

  return (
    <section className="simulasyon-sayfasi">
      <div className="sol-panel glass-card">
        <h2>Minimal Girdi Formu</h2>
        <p>
          Bu akista sadece marka-model, profil ve temel kullanim hedefleri secilir. Teknik parametreler batarya
          katalog veritabanindan otomatik gelir.
        </p>
        {project && (
          <div className="proje-etiket">
            <strong>Proje:</strong> {project.projectName} | <strong>Lokasyon:</strong> {project.location}
          </div>
        )}

        <form onSubmit={formGonder} className="simulasyon-form">
          <label>
            Batarya Markasi
            <select value={form.brandId} onChange={(e) => markaDegistir(e.target.value)}>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Batarya Modeli
            <select
              value={form.batteryModelId}
              onChange={(e) => setForm((prev) => ({ ...prev, batteryModelId: e.target.value }))}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.nominalCapacityKwh} kWh
                </option>
              ))}
            </select>
          </label>

          <label>
            Gunes Profili
            <select
              value={form.solarProfileCode}
              onChange={(e) => setForm((prev) => ({ ...prev, solarProfileCode: e.target.value }))}
            >
              {solarProfiles.map((profile) => (
                <option key={profile.code} value={profile.code}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tarife Profili
            <select
              value={form.tariffProfileCode}
              onChange={(e) => setForm((prev) => ({ ...prev, tariffProfileCode: e.target.value }))}
            >
              {tariffs.map((tariff) => (
                <option key={tariff.code} value={tariff.code}>
                  {tariff.name}
                </option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Proje Suresi (Yil)
              <input
                type="number"
                min="1"
                max="30"
                value={form.projectYears}
                onChange={(e) => setForm((prev) => ({ ...prev, projectYears: e.target.value }))}
              />
            </label>
            <label>
              Sarj Hedef SOC
              <input
                type="number"
                min="0.5"
                max="0.99"
                step="0.01"
                value={form.dailyChargeTargetSoc}
                onChange={(e) => setForm((prev) => ({ ...prev, dailyChargeTargetSoc: e.target.value }))}
              />
            </label>
            <label>
              Desarj Alt SOC
              <input
                type="number"
                min="0.05"
                max="0.5"
                step="0.01"
                value={form.dailyDischargeTargetSoc}
                onChange={(e) => setForm((prev) => ({ ...prev, dailyDischargeTargetSoc: e.target.value }))}
              />
            </label>
            <label>
              Yillik Bakim Maliyeti (TL)
              <input
                type="number"
                min="0"
                step="1000"
                value={form.annualMaintenanceCostTry}
                onChange={(e) => setForm((prev) => ({ ...prev, annualMaintenanceCostTry: e.target.value }))}
              />
            </label>
          </div>

          <button disabled={running || !form.batteryModelId} type="submit" className="btn btn-primary btn-block">
            {running ? "Hesaplama Yapiliyor..." : "Simulasyonu Calistir"}
          </button>
        </form>

        {seciliModel && (
          <div className="model-ozet glass-card-white">
            <h3>Secili Batarya Ozeti</h3>
            <ul>
              <li>
                <strong>Kimya:</strong> {seciliModel.chemistry}
              </li>
              <li>
                <strong>Nominal Kapasite:</strong> {seciliModel.nominalCapacityKwh} kWh
              </li>
              <li>
                <strong>Nominal Guc:</strong> {seciliModel.nominalPowerKw} kW
              </li>
              <li>
                <strong>80% DOD Cevrim:</strong> {seciliModel.cycleLifeAt80Dod}
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="sag-panel glass-card">
        <div className="sonuc-baslik">
          <h2>Simulasyon Sonuclari</h2>
          <small>Gercekci DOD + kapasite omru + maliyet etkisi</small>
        </div>

        {error && <div className="hata-kutu">{error}</div>}

        {!result && !error && (
          <div className="bos-durum glass-card-white">
            <h3>Sonuc paneli hazir</h3>
            <p>Soldan secimlerini yapip simulasyonu baslattiginda grafik ve KPI sonucunu burada goreceksin.</p>
          </div>
        )}

        {result && (
          <>
            <KpiCards summary={result.summary} />
            <LineChart title="Aylik Kapasite Dususu (kWh)" data={result.series.monthlyCapacity} xAlan="ay" yAlan="kapasiteKwh" />
            <LineChart title="Ilk 2 Hafta SOC Degisimi (%)" data={result.series.hourlySocSample} xAlan="saatIndex" yAlan="socYuzde" renk="#27ae60" />
            <AnnualCashflowTable rows={result.series.annualCashflow} />
          </>
        )}
      </div>
    </section>
  );
}

export default SimulationPage;
