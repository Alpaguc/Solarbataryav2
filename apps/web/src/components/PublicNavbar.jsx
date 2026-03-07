import { Link, useLocation } from "react-router-dom";

function PublicNavbar() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <header className="public-navbar">
      <div className="public-logo">
        <span className="logo-rozet">SB</span>
        <div>
          <strong>SolarBatarya</strong>
          <small>Solar & Battery Platform</small>
        </div>
      </div>
      <nav>
        <Link to="/" className="btn btn-ghost">
          Ana Sayfa
        </Link>
        <a href="/#urunler">Urunler</a>
        <a href="/#cozumler">Cozumler</a>
        <a href="/#hakkimizda">Hakkimizda</a>
        <a href="/#fiyatlandirma">Fiyatlandirma</a>
        <a href="/#nasil-calisir">Nasil Kullanilir</a>
        <Link to="/login" className={`btn btn-outline ${isLoginPage ? "is-active" : ""}`}>
          Hesabim
        </Link>
        <Link to="/login?mode=register" className="btn btn-primary">
          Kayit Ol
        </Link>
      </nav>
    </header>
  );
}

export default PublicNavbar;
