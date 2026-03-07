import { Navigate, Route, Routes } from "react-router-dom";
import PublicNavbar from "./components/PublicNavbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import LegacyWorkspacePage from "./pages/LegacyWorkspacePage";

function PrivateLayout() {
  const { cikisYap } = useAuth();

  return (
    <div className="uygulama-kapsayici">
      <div className="legacy-topbar">
        <button type="button" className="btn btn-danger" onClick={cikisYap}>
          Cikis
        </button>
      </div>
      <Routes>
        <Route index element={<LegacyWorkspacePage />} />
        <Route path="simulasyon" element={<LegacyWorkspacePage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </div>
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
                <Navigate to="/app" replace />
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
