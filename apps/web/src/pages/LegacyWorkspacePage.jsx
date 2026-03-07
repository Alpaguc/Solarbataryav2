import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

function getApiRoot() {
  const apiBase =
    import.meta.env.VITE_API_URL ||
    (window.location.hostname === "localhost"
      ? "http://localhost:3001/api"
      : "https://solarbataryav2-api.onrender.com/api");
  return apiBase.replace(/\/api\/?$/, "");
}

function LegacyWorkspacePage() {
  const { token } = useAuth();
  const apiRoot = useMemo(() => getApiRoot(), []);
  const iframeSrc = useMemo(() => {
    if (!token) {
      return "";
    }
    return `${apiRoot}/legacy?token=${encodeURIComponent(token)}`;
  }, [apiRoot, token]);

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
