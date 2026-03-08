import { useAppWorkspace } from "../../context/AppWorkspaceContext";

function VeriGirisiPage() {
  const { veriGirisi, veriGirisiTamam, alanGuncelle } = useAppWorkspace();

  return (
    <section className="app-modul">
      <header className="app-modul-baslik glass-card">
        <h1>Veri Girisi</h1>
        <p>Tesis ve enerji verilerini bu alanda ayri sekilde yonet. Bu adim tamamlanmadan analiz acilmaz.</p>
        <span className={`durum-cipi ${veriGirisiTamam ? "hazir" : "eksik"}`}>{veriGirisiTamam ? "Veri Hazir" : "Veri Eksik"}</span>
      </header>

      <div className="modul-iki-kolon">
        <article className="glass-card">
          <h2>Tesis Bilgileri</h2>
          <form className="simulasyon-form">
            <label>
              Proje Adi
              <input
                value={veriGirisi.projeAdi}
                onChange={(e) => alanGuncelle("veriGirisi", { projeAdi: e.target.value })}
                placeholder="Ornek: Aydin GES Depolama"
              />
            </label>
            <label>
              Lokasyon
              <input
                value={veriGirisi.lokasyon}
                onChange={(e) => alanGuncelle("veriGirisi", { lokasyon: e.target.value })}
                placeholder="Il / Ilce"
              />
            </label>
            <label>
              Kurulu Guc (kW)
              <input
                type="number"
                min="1"
                value={veriGirisi.kuruluGucKw}
                onChange={(e) => alanGuncelle("veriGirisi", { kuruluGucKw: e.target.value })}
              />
            </label>
          </form>
        </article>

        <article className="glass-card">
          <h2>Enerji Verileri</h2>
          <form className="simulasyon-form">
            <label>
              Yillik Uretim (MWh)
              <input
                type="number"
                min="1"
                value={veriGirisi.yillikUretimMwh}
                onChange={(e) => alanGuncelle("veriGirisi", { yillikUretimMwh: e.target.value })}
              />
            </label>
            <label>
              Yillik Tuketim (MWh)
              <input
                type="number"
                min="0"
                value={veriGirisi.yillikTuketimMwh}
                onChange={(e) => alanGuncelle("veriGirisi", { yillikTuketimMwh: e.target.value })}
              />
            </label>
            <label>
              Baz Enerji Fiyati (TL/MWh)
              <input
                type="number"
                min="1"
                value={veriGirisi.bazEnerjiFiyatiTryMwh}
                onChange={(e) => alanGuncelle("veriGirisi", { bazEnerjiFiyatiTryMwh: e.target.value })}
              />
            </label>
          </form>
        </article>
      </div>
    </section>
  );
}

export default VeriGirisiPage;
