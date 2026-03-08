import { useAppWorkspace } from "../../context/AppWorkspaceContext";

function HesaplamaYontemleriPage() {
  const { hesaplama, hesaplamaYontemleri, alanGuncelle } = useAppWorkspace();

  return (
    <section className="app-modul">
      <header className="app-modul-baslik glass-card">
        <h1>Hesaplama Yontemleri</h1>
        <p>Birden fazla hesaplama yaklasimi arasinda secim yap ve finansal parametre setini ayarla.</p>
      </header>

      <article className="glass-card">
        <h2>Yontem Secimi</h2>
        <div className="yontem-kart-grid">
          {hesaplamaYontemleri.map((yontem) => (
            <button
              key={yontem.code}
              type="button"
              className={`yontem-karti ${hesaplama.yontemKodu === yontem.code ? "aktif" : ""}`}
              onClick={() => alanGuncelle("hesaplama", { yontemKodu: yontem.code })}
            >
              <strong>{yontem.name}</strong>
              <p>{yontem.description}</p>
            </button>
          ))}
        </div>
      </article>

      <article className="glass-card">
        <h2>Finans ve Proje Parametreleri</h2>
        <form className="simulasyon-form">
          <div className="form-grid">
            <label>
              Proje Suresi (Yil)
              <input
                type="number"
                min="1"
                max="30"
                value={hesaplama.projeYili}
                onChange={(e) => alanGuncelle("hesaplama", { projeYili: e.target.value })}
              />
            </label>
            <label>
              Yillik Bakim (TL)
              <input
                type="number"
                min="0"
                value={hesaplama.yillikBakimTry}
                onChange={(e) => alanGuncelle("hesaplama", { yillikBakimTry: e.target.value })}
              />
            </label>
            <label>
              Enerji Fiyat Artisi (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={hesaplama.enerjiFiyatArtisYuzde}
                onChange={(e) => alanGuncelle("hesaplama", { enerjiFiyatArtisYuzde: e.target.value })}
              />
            </label>
            <label>
              Iskonto Orani (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={hesaplama.iskontoOraniYuzde}
                onChange={(e) => alanGuncelle("hesaplama", { iskontoOraniYuzde: e.target.value })}
              />
            </label>
          </div>
        </form>
      </article>
    </section>
  );
}

export default HesaplamaYontemleriPage;
