import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import PublicNavbar from "./components/PublicNavbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppWorkspaceProvider, useAppWorkspace } from "./context/AppWorkspaceContext";
import AppShell from "./components/app/AppShell";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProjeListesiPage from "./pages/app/ProjeListesiPage";
import PvsystSayfasi from "./pages/app/PvsystSayfasi";
import BataryaSayfasi from "./pages/app/BataryaSayfasi";
import StratejiSayfasi from "./pages/app/StratejiSayfasi";
import SimulasyonSayfasi from "./pages/app/SimulasyonSayfasi";
import SonuclarSayfasi from "./pages/app/SonuclarSayfasi";

function ProjeGerekliGuard({ children }) {
  const { secilenProje } = useAppWorkspace();
  const navigate = useNavigate();

  if (!secilenProje) {
    return (
      <div className="proje-secilmedi-uyari card">
        <div className="proje-secilmedi-ikon">P</div>
        <h3>Proje Secilmedi</h3>
        <p>Bu sayfayi kullanmak icin once bir proje secmelisiniz.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/app/projeler")}
        >
          Projelerime Git
        </button>
      </div>
    );
  }

  return children;
}

function PrivateLayout() {
  const { user, cikisYap } = useAuth();

  return (
    <AppWorkspaceProvider>
      <AppShell user={user} onLogout={cikisYap}>
        <Routes>
          <Route index element={<Navigate to="/app/projeler" replace />} />
          <Route path="projeler" element={<ProjeListesiPage />} />
          <Route
            path="pvsyst"
            element={
              <ProjeGerekliGuard>
                <PvsystSayfasi />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="batarya"
            element={
              <ProjeGerekliGuard>
                <BataryaSayfasi />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="strateji"
            element={
              <ProjeGerekliGuard>
                <StratejiSayfasi />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="simulasyon"
            element={
              <ProjeGerekliGuard>
                <SimulasyonSayfasi />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="sonuclar"
            element={
              <ProjeGerekliGuard>
                <SonuclarSayfasi />
              </ProjeGerekliGuard>
            }
          />
          <Route path="*" element={<Navigate to="/app/projeler" replace />} />
        </Routes>
      </AppShell>
    </AppWorkspaceProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="uygulama-kapsayici">
        <Routes>
          <Route
            path="/"
            element={
              <main className="public-content public-light-shell">
                <PublicNavbar />
                <LandingPage />
              </main>
            }
          />
          <Route
            path="/login"
            element={
              <main className="public-content public-light-shell">
                <PublicNavbar />
                <LoginPage />
              </main>
            }
          />
          <Route
            path="/app/*"
            element={
              <ProtectedRoute>
                <PrivateLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Navigate to="/app/projeler" replace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
