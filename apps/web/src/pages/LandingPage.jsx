import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <div className="landing-wrapper">
      <section className="pv-hero">
        <div className="pv-hero-left">
          <span className="pv-badge">Yeni Nesil Gunes Enerjisi Tasarimi</span>
          <h1>
            SolarBatarya ile
            <br />
            Depolamali GES
            <br />
            <span className="pv-accent">Tasariminda</span>
            <br />
            Yeni Cag
          </h1>
          <p>
            SolarBatarya; arazi ve cati tipi projelerde batarya secimi, DOD etkisi, kapasite omru ve ekonomik
            ciktilari tek platformda sunar. Giris yaptiktan sonra tek proje olusturup simulasyona gecersin.
          </p>
          <div className="pv-hero-actions">
            <Link className="btn btn-primary" to="/login">
              Kayit Ol
            </Link>
            <a className="btn btn-secondary" href="#ozellikler">
              Ozellikleri Kesfet
            </a>
          </div>
          <div className="pv-stats">
            <div>
              <strong>90%+</strong>
              <span>Manuel Is Yuku Azalimi</span>
            </div>
            <div>
              <strong>10+</strong>
              <span>Proje Tipi</span>
            </div>
            <div>
              <strong>2+</strong>
              <span>Ulke Kapsami</span>
            </div>
          </div>
        </div>

        <div className="pv-hero-right">
          <div className="pv-hero-media">
            <img
              src="https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80"
              alt="SolarBatarya Hero"
            />
          </div>
        </div>
      </section>

      <section id="ozellikler" className="feature-grid">
        <article className="glass-card-white">
          <h3>Ne Yapiyor?</h3>
          <p>
            Secebilecegin batarya markalari ve modelleri ile depolamali sistem performansini saatlik bazda simule
            eder.
          </p>
        </article>
        <article className="glass-card-white">
          <h3>Nasil Yapiyor?</h3>
          <p>
            SOC, DOD, cevrim omru, takvim yaslanmasi ve tarife profillerini birlestirerek yatirim metriklerini
            hesaplar.
          </p>
        </article>
        <article className="glass-card-white">
          <h3>Neden Onemli?</h3>
          <p>Teknik ve finansal etkiyi ayni yerde gostererek daha dogru kapasite ve marka secimi yapmani saglar.</p>
        </article>
      </section>

      <section id="urunler" className="public-info-card">
        <h2>Urunler</h2>
        <p>
          SolarBatarya uygulamasinda batarya marka/model katalogu, proje olusturma adimi ve simulasyon ekrani birlikte
          calisir.
        </p>
      </section>

      <section id="cozumler" className="public-info-card">
        <h2>Cozumler</h2>
        <p>
          Depolamali GES yatiriminda teknik ve finansal belirsizligi azaltmak icin SOC, DOD, yaslanma, geri odeme ve
          ROI metrikleri tek raporda sunulur.
        </p>
      </section>

      <section id="hakkimizda" className="public-info-card">
        <h2>Hakkimizda</h2>
        <p>
          Enerji alaninda gercek sahaya uygun karar destek ekranlari olusturmak icin gelistirilen bir platformdur.
        </p>
      </section>

      <section id="fiyatlandirma" className="public-info-card">
        <h2>Fiyatlandirma</h2>
        <p>Deneme surumuyle baslayip proje bazli lisans modeline gecis yapilabilir.</p>
      </section>

      <section id="nasil-calisir" className="public-info-card">
        <h2>Nasil Calisir?</h2>
        <ol className="adim-listesi">
          <li>Giris yap veya hesap olustur.</li>
          <li>Proje adi, lokasyon ve temel bilgilerle tek proje olustur.</li>
          <li>Batarya modeli sec ve simulasyonu baslat.</li>
          <li>Kapasite kaybi, geri odeme suresi ve ROI sonucunu incele.</li>
        </ol>
      </section>
    </div>
  );
}

export default LandingPage;
