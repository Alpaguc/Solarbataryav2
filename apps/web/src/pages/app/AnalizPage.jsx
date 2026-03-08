import { useMemo, useState } from "react";
import AnnualCashflowTable from "../../components/AnnualCashflowTable";
import KpiCards from "../../components/KpiCards";
import LineChart from "../../components/LineChart";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

function AnalizPage() {
  const { analizHazir, analizSonucu, analizHesapla, veriGirisiTamam, depolamaliSistemTamam } = useAppWorkspace();
  const [hesaplaniyor, setHesaplaniyor] = useState(false);

  const eksikAdimlar = useMemo(() => {
    const liste = [];
    if (!veriGirisiTamam) liste.push("Veri Girisi");
    if (!depolamaliSistemTamam) liste.push("Depolamali Sistem");
    return liste;
  }, [veriGirisiTamam, depolamaliSistemTamam]);

  async function analizCalistir() {
    setHesaplaniyor(true);
    await Promise.resolve();
    analizHesapla();
    setHesaplaniyor(false);
  }

  return (
    <section className="app-modul">
      <header className="app-modul-baslik glass-card">
        <h1>Analiz</h1>
        <p>Girdi, depolama ve hesaplama ayarlarina gore KPI, grafik ve nakit akisi sonuclarini bu alanda gor.</p>
      </header>

      {!analizHazir && (
        <div className="hata-kutu">
          Analiz icin once su adimlari tamamla: <strong>{eksikAdimlar.join(", ")}</strong>
        </div>
      )}

      <div className="glass-card">
        <button type="button" className="btn btn-primary" disabled={!analizHazir || hesaplaniyor} onClick={analizCalistir}>
          {hesaplaniyor ? "Hesaplaniyor..." : analizSonucu ? "Analizi Guncelle" : "Analizi Baslat"}
        </button>
      </div>

      {!analizSonucu && (
        <div className="bos-durum glass-card-white">
          <h3>Analiz paneli hazir</h3>
          <p>Soldaki moduller tamamlandiginda tek tik ile KPI ve grafik sonuclarini burada goruntuleyebilirsin.</p>
        </div>
      )}

      {analizSonucu && (
        <>
          <div className="glass-card">
            <KpiCards summary={analizSonucu.summary} />
          </div>
          <div className="glass-card">
            <LineChart title="Aylik Kapasite Dususu (kWh)" data={analizSonucu.series.monthlyCapacity} xAlan="ay" yAlan="kapasiteKwh" />
          </div>
          <div className="glass-card">
            <LineChart
              title="Ilk 2 Hafta SOC Orneklemi (%)"
              data={analizSonucu.series.hourlySocSample}
              xAlan="saatIndex"
              yAlan="socYuzde"
              renk="#27ae60"
            />
          </div>
          <div className="glass-card">
            <AnnualCashflowTable rows={analizSonucu.series.annualCashflow} />
          </div>
        </>
      )}
    </section>
  );
}

export default AnalizPage;
