import { Navigate, Route, Routes } from "react-router-dom";
import PublicNavbar from "./components/PublicNavbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppWorkspaceProvider } from "./context/AppWorkspaceContext";
import AppShell from "./components/app/AppShell";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import VeriGirisiPage from "./pages/app/VeriGirisiPage";
import DepolamaliSistemPage from "./pages/app/DepolamaliSistemPage";
import HesaplamaYontemleriPage from "./pages/app/HesaplamaYontemleriPage";
import AnalizPage from "./pages/app/AnalizPage";

function PrivateLayout() {
  const { user, cikisYap } = useAuth();

  return (
    <AppWorkspaceProvider>
      <AppShell user={user} onLogout={cikisYap}>
        <Routes>
          <Route index element={<Navigate to="/app/veri-girisi" replace />} />
          <Route path="veri-girisi" element={<VeriGirisiPage />} />
          <Route path="depolamali-sistem" element={<DepolamaliSistemPage />} />
          <Route path="hesaplama-yontemleri" element={<HesaplamaYontemleriPage />} />
          <Route path="analiz" element={<AnalizPage />} />
          <Route path="*" element={<Navigate to="/app/veri-girisi" replace />} />
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
                <Navigate to="/app/veri-girisi" replace />
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
