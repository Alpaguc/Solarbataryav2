import { Link, useLocation } from "react-router-dom";

function Navbar({ user, onLogout }) {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-rozet">SB</span>
        <div>
          <strong>SolarBatarya</strong>
          <small>Depolamali Sistem</small>
        </div>
      </div>
      <nav className="sidebar-nav">
        <Link className={`sidebar-link ${location.pathname === "/app" ? "aktif" : ""}`} to="/app">
          <span className="sidebar-icon">i</span>
          <span>Proje Alani</span>
        </Link>
        <Link className={`sidebar-link ${location.pathname === "/app/simulasyon" ? "aktif" : ""}`} to="/app/simulasyon">
          <span className="sidebar-icon">S</span>
          <span>Simulasyon</span>
        </Link>
      </nav>
      <div className="sidebar-footer">
        <div className="kullanici-bilgi">
          <strong>{user?.fullName || "Kullanici"}</strong>
          <small>{user?.email || ""}</small>
        </div>
        <button type="button" className="btn btn-danger btn-block" onClick={onLogout}>
          Cikis
        </button>
      </div>
    </aside>
  );
}

export default Navbar;
