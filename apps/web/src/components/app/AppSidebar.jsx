import { NavLink, useLocation } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const WIZARD_MENULER = [
  { to: "/app/pvsyst", num: "1", label: "PVSyst Verisi", alt: "CSV yukle", stateKey: "pvsystData" },
  { to: "/app/batarya", num: "2", label: "Batarya Secimi", alt: "Katalog / BTR", stateKey: "secilenBatarya" },
  { to: "/app/strateji", num: "3", label: "Strateji", alt: "Arbitraj / Peak / Esik", stateKey: "stratejiKonfig" },
  { to: "/app/simulasyon", num: "4", label: "Simulasyon", alt: "Calistir", stateKey: "simulasyonSonucu" },
  { to: "/app/sonuclar", num: "5", label: "Sonuclar", alt: "KPI & Grafik", stateKey: "simulasyonSonucu" }
];

function AppSidebar({ user, onLogout }) {
  const location = useLocation();
  const { projeListesi, secilenProje, pvsystData, secilenBatarya, stratejiKonfig, simulasyonSonucu } =
    useAppWorkspace();

  const stateMap = { pvsystData, secilenBatarya, stratejiKonfig, simulasyonSonucu };

  function adimDurumu(menu, idx) {
    const val = stateMap[menu.stateKey];
    const tamamlandi = Boolean(val);
    const aktif = location.pathname.startsWith(menu.to);
    return { tamamlandi, aktif };
  }

  const ilkTamamlanmamiAdim = WIZARD_MENULER.findIndex(m => !stateMap[m.stateKey]);
  const erisimSiniri = ilkTamamlanmamiAdim === -1 ? WIZARD_MENULER.length : ilkTamamlanmamiAdim;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-rozet">SB</span>
        <div>
          <strong>SolarBatarya</strong>
          <small>GES + Depolama Analizi</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/app/projeler"
          className={({ isActive }) => `sidebar-link ${isActive ? "aktif" : ""}`}
        >
          <span className="sidebar-wizard-num">P</span>
          <span className="sidebar-link-icerik">
            <span>Projelerim</span>
            <small>{projeListesi.length} proje</small>
          </span>
        </NavLink>

        {secilenProje && (
          <div className="sidebar-secilen-proje">
            <div className="sidebar-proje-etiketi">Aktif Proje</div>
            <div className="sidebar-proje-adi">{secilenProje.projectName}</div>
          </div>
        )}

        {secilenProje && (
          <>
            <hr className="sidebar-ayirici" />
            <div className="sidebar-nav-bolum">Simulasyon Adimlari</div>

            {WIZARD_MENULER.map((menu, idx) => {
              const { tamamlandi, aktif } = adimDurumu(menu, idx);
              const erisimVar = secilenProje && idx <= erisimSiniri;

              if (!erisimVar) {
                return (
                  <div key={menu.to} className="sidebar-pasif">
                    <span className="sidebar-wizard-num">{menu.num}</span>
                    <span className="sidebar-link-icerik">
                      <span>{menu.label}</span>
                      <small>Onceki adimi tamamla</small>
                    </span>
                  </div>
                );
              }

              return (
                <NavLink
                  key={menu.to}
                  to={menu.to}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "aktif" : ""} ${tamamlandi && !isActive ? "sidebar-wizard-tamamlandi" : ""}`
                  }
                >
                  <span className="sidebar-wizard-num">
                    {tamamlandi && !aktif ? "✓" : menu.num}
                  </span>
                  <span className="sidebar-link-icerik">
                    <span>{menu.label}</span>
                    <small>{tamamlandi ? "Tamamlandi" : menu.alt}</small>
                  </span>
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-kullanici">
          <div className="sidebar-avatar">
            {(user?.fullName || user?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-kullanici-bilgi">
            <strong>{user?.fullName || "Kullanici"}</strong>
            <small>{user?.email || ""}</small>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-kucuk w-full mt-2"
          style={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.15)" }}
          onClick={onLogout}
        >
          Cikis Yap
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;
