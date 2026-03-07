import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

function getApiRoot() {
  const apiBase =
    import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001/api" : "");
  if (!apiBase) {
    return "";
  }
  return apiBase.replace(/\/api\/?$/, "");
}

function LegacyWorkspacePage() {
  const { token } = useAuth();
  const apiRoot = useMemo(() => getApiRoot(), []);
  const iframeSrc = useMemo(() => {
    if (!apiRoot || !token) {
      return "";
    }
    return `${apiRoot}/legacy?token=${encodeURIComponent(token)}`;
  }, [apiRoot, token]);

  if (!apiRoot) {
    return (
      <div className="legacy-wrapper">
        <div className="auth-card glass-card" style={{ maxWidth: 760, margin: "32px auto" }}>
          <h2>API adresi tanimli degil</h2>
          <p>Bu alanin calismasi icin Netlify ortam degiskenlerinde `VITE_API_URL` tanimli olmali.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="legacy-wrapper">
      <iframe
        title="SolarBatarya Legacy Workspace"
        src={iframeSrc}
        className="legacy-frame"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}

export default LegacyWorkspacePage;
