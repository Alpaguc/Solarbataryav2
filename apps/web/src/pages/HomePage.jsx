import { Link } from "react-router-dom";

function HomePage() {
  return (
    <section>
      <div className="hero-header glass-card">
        <h1>Daha az veri gir, daha gercekci batarya simule et</h1>
        <p>
          SolarBatarya, secilen batarya markasi/modeli ile DOD etkisini, kapasite omrunu, maliyetleri ve gelir
          etkisini tek bir analizde birlestirir.
        </p>
        <Link to="/simulasyon" className="ana-buton">
          Simulasyona Basla
        </Link>
      </div>

      <div className="feature-grid">
        <article className="glass-card-white">
          <h3>Minimal Giris</h3>
          <p>Lokasyon profili, tarife secimi ve batarya modeli ile hizli baslangic.</p>
        </article>
        <article className="glass-card-white">
          <h3>Gercekci Omur Modeli</h3>
          <p>Saatlik SOC takibi, DOD bazli cevrim kaybi ve takvim yaslanmasi birlikte hesaplanir.</p>
        </article>
        <article className="glass-card-white">
          <h3>Yatirim Analizi</h3>
          <p>Ek gelir, ROI, geri odeme suresi ve kapasite korunumu grafiklerle raporlanir.</p>
        </article>
      </div>
    </section>
  );
}

export default HomePage;
