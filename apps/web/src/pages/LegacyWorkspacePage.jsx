import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

function getApiRoot() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
  return apiBase.replace(/\/api\/?$/, "");
}

function LegacyWorkspacePage() {
  const { token } = useAuth();
  const iframeSrc = useMemo(() => {
    const apiRoot = getApiRoot();
    return `${apiRoot}/legacy?token=${encodeURIComponent(token)}`;
  }, [token]);

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
