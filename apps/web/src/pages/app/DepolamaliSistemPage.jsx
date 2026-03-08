import { useAppWorkspace } from "../../context/AppWorkspaceContext";

function DepolamaliSistemPage() {
  const { depolamaliSistem, depolamaliSistemTamam, alanGuncelle } = useAppWorkspace();

  return (
    <section className="app-modul">
      <header className="app-modul-baslik glass-card">
        <h1>Depolamali Sistem</h1>
        <p>Batarya kapasitesi, inverter gucu ve SOC hedeflerini ayri bir modulde yonet.</p>
        <span className={`durum-cipi ${depolamaliSistemTamam ? "hazir" : "eksik"}`}>
          {depolamaliSistemTamam ? "Sistem Hazir" : "Sistem Eksik"}
        </span>
      </header>

      <div className="modul-iki-kolon">
        <article className="glass-card">
          <h2>Donanim Parametreleri</h2>
          <form className="simulasyon-form">
            <label>
              Batarya Kimyasi
              <select
                value={depolamaliSistem.bataryaKimyasi}
                onChange={(e) => alanGuncelle("depolamaliSistem", { bataryaKimyasi: e.target.value })}
              >
                <option value="LFP">LFP</option>
                <option value="NMC">NMC</option>
                <option value="LTO">LTO</option>
              </select>
            </label>
            <label>
              Depolama Kapasitesi (kWh)
              <input
                type="number"
                min="1"
                value={depolamaliSistem.depolamaKapasitesiKwh}
                onChange={(e) => alanGuncelle("depolamaliSistem", { depolamaKapasitesiKwh: e.target.value })}
              />
            </label>
            <label>
              Inverter Gucu (kW)
              <input
                type="number"
                min="1"
                value={depolamaliSistem.inverterGucuKw}
                onChange={(e) => alanGuncelle("depolamaliSistem", { inverterGucuKw: e.target.value })}
              />
            </label>
          </form>
        </article>

        <article className="glass-card">
          <h2>Isletme Parametreleri</h2>
          <form className="simulasyon-form">
            <div className="form-grid">
              <label>
                Min SOC
                <input
                  type="number"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  value={depolamaliSistem.minSoc}
                  onChange={(e) => alanGuncelle("depolamaliSistem", { minSoc: e.target.value })}
                />
              </label>
              <label>
                Max SOC
                <input
                  type="number"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={depolamaliSistem.maxSoc}
                  onChange={(e) => alanGuncelle("depolamaliSistem", { maxSoc: e.target.value })}
                />
              </label>
              <label>
                Hedef Sarj SOC
                <input
                  type="number"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={depolamaliSistem.hedefSarjSoc}
                  onChange={(e) => alanGuncelle("depolamaliSistem", { hedefSarjSoc: e.target.value })}
                />
              </label>
              <label>
                Hedef Desarj SOC
                <input
                  type="number"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  value={depolamaliSistem.hedefDesarjSoc}
                  onChange={(e) => alanGuncelle("depolamaliSistem", { hedefDesarjSoc: e.target.value })}
                />
              </label>
            </div>
            <label>
              Gunluk Dongu Sayisi
              <input
                type="number"
                min="0.3"
                max="3"
                step="0.1"
                value={depolamaliSistem.gunlukDongu}
                onChange={(e) => alanGuncelle("depolamaliSistem", { gunlukDongu: e.target.value })}
              />
            </label>
          </form>
        </article>
      </div>
    </section>
  );
}

export default DepolamaliSistemPage;
