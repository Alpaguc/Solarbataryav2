import { NavLink } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const PROJE_MENU = { to: "/app/projeler", icon: "P", label: "Projelerim", durumKey: "projeler" };

const ANALIZ_MENULER = [
  { to: "/app/veri-girisi", icon: "V", label: "Veri Girisi", durumKey: "veri" },
  { to: "/app/depolamali-sistem", icon: "D", label: "Depolamali Sistem", durumKey: "sistem" },
  { to: "/app/hesaplama-yontemleri", icon: "H", label: "Hesaplama Yontemleri", durumKey: "hesap" },
  { to: "/app/analiz", icon: "A", label: "Analiz", durumKey: "analiz" }
];

function AppSidebar({ user, onLogout }) {
  const { veriGirisiTamam, depolamaliSistemTamam, analizSonucu, projeListesi, secilenProje } =
    useAppWorkspace();

  function durumRozeti(durumKey) {
    if (durumKey === "projeler") {
      return `${projeListesi.length} proje`;
    }
    if (durumKey === "veri") {
      return veriGirisiTamam ? "Hazir" : "Eksik";
    }
    if (durumKey === "sistem") {
      return depolamaliSistemTamam ? "Hazir" : "Eksik";
    }
    if (durumKey === "analiz") {
      return analizSonucu ? "Guncel" : "Bos";
    }
    return "Ayarla";
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-rozet">SB</span>
        <div>
          <strong>SolarBatarya App</strong>
          <small>Moduler Calisma Alani</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          key={PROJE_MENU.to}
          to={PROJE_MENU.to}
          className={({ isActive }) => `sidebar-link ${isActive ? "aktif" : ""}`}
        >
          <span className="sidebar-icon">{PROJE_MENU.icon}</span>
          <span className="sidebar-link-icerik">
            <span>{PROJE_MENU.label}</span>
            <small>{durumRozeti(PROJE_MENU.durumKey)}</small>
          </span>
        </NavLink>

        {secilenProje && (
          <div className="sidebar-secilen-proje">
            <small className="sidebar-proje-etiketi">Aktif Proje</small>
            <span className="sidebar-proje-adi">{secilenProje.projectName}</span>
          </div>
        )}

        <div className="sidebar-ayirici" />

        {ANALIZ_MENULER.map((menu) => (
          <NavLink
            key={menu.to}
            to={menu.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "aktif" : ""} ${!secilenProje ? "sidebar-link-pasif" : ""}`
            }
          >
            <span className="sidebar-icon">{menu.icon}</span>
            <span className="sidebar-link-icerik">
              <span>{menu.label}</span>
              <small>{secilenProje ? durumRozeti(menu.durumKey) : "Proje Sec"}</small>
            </span>
          </NavLink>
        ))}
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

export default AppSidebar;
