import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import PublicNavbar from "./components/PublicNavbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppWorkspaceProvider, useAppWorkspace } from "./context/AppWorkspaceContext";
import AppShell from "./components/app/AppShell";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProjeListesiPage from "./pages/app/ProjeListesiPage";
import VeriGirisiPage from "./pages/app/VeriGirisiPage";
import DepolamaliSistemPage from "./pages/app/DepolamaliSistemPage";
import HesaplamaYontemleriPage from "./pages/app/HesaplamaYontemleriPage";
import AnalizPage from "./pages/app/AnalizPage";

function ProjeGerekliGuard({ children }) {
  const { secilenProje } = useAppWorkspace();
  const navigate = useNavigate();

  if (!secilenProje) {
    return (
      <div className="proje-secilmedi-uyari glass-card">
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
            path="veri-girisi"
            element={
              <ProjeGerekliGuard>
                <VeriGirisiPage />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="depolamali-sistem"
            element={
              <ProjeGerekliGuard>
                <DepolamaliSistemPage />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="hesaplama-yontemleri"
            element={
              <ProjeGerekliGuard>
                <HesaplamaYontemleriPage />
              </ProjeGerekliGuard>
            }
          />
          <Route
            path="analiz"
            element={
              <ProjeGerekliGuard>
                <AnalizPage />
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
