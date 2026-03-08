import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

function parsePvsystCsv(text) {
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].includes("EArray") || lines[i].includes("E_Grid")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("PVSyst CSV baslik satiri bulunamadi (EArray/E_Grid).");

  const headers = lines[headerIdx].split(";").map(h => h.trim());
  const dcIdx = headers.findIndex(h => h === "EArray" || h === "GlobInc");
  const acIdx = headers.findIndex(h => h === "E_Grid");

  if (acIdx === -1) throw new Error("E_Grid kolonu bulunamadi.");

  const data = [];
  let unitLine = lines[headerIdx + 1] || "";
  const unitCols = unitLine.split(";");
  const acUnit = (unitCols[acIdx] || "kWh").trim();
  const scaleFactor = acUnit.toLowerCase().includes("kwh") ? 1 : 0.001;

  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(";");
    const dcKw = dcIdx >= 0 ? (parseFloat(cols[dcIdx]?.replace(",", ".")) || 0) * scaleFactor : 0;
    const acKw = (parseFloat(cols[acIdx]?.replace(",", ".")) || 0) * scaleFactor;
    data.push({ hourIndex: data.length, dcKw, acKw });
    if (data.length >= 8760) break;
  }

  if (data.length < 8700) throw new Error(`Yetersiz veri: ${data.length} saat (min 8700 bekleniyor).`);
  return data;
}

function ayAdi(ayIdx) {
  const AYLAR = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];
  return AYLAR[ayIdx] || "";
}

function SimpleBarChart({ data, width = 600, height = 200 }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.dc, d.ac)));
  const barW = (width - 60) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height + 30}`} style={{ width: "100%", maxHeight: "220px" }}>
      {data.map((d, i) => {
        const x = 40 + i * barW;
        const dcH = (d.dc / maxVal) * height;
        const acH = (d.ac / maxVal) * height;
        return (
          <g key={i}>
            <rect
              x={x + barW * 0.05}
              y={height - dcH}
              width={barW * 0.4}
              height={dcH}
              fill="#1B2B5E"
              opacity={0.7}
            />
            <rect
              x={x + barW * 0.5}
              y={height - acH}
              width={barW * 0.4}
              height={acH}
              fill="#E8500A"
              opacity={0.85}
            />
            <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="9" fill="#94A3B8">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1="40" y1="0" x2="40" y2={height} stroke="#E2E8F0" strokeWidth="1" />
      <line x1="40" y1={height} x2={width} y2={height} stroke="#E2E8F0" strokeWidth="1" />
    </svg>
  );
}

function PvsystSayfasi() {
  const navigate = useNavigate();
  const { pvsystData, setPvsystData } = useAppWorkspace();
  const [yukluDosya, setYukluDosya] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const monthlyData = pvsystData ? Array.from({ length: 12 }, (_, mi) => {
    const ay = pvsystData.filter((_, hi) => Math.floor(hi / 730) === mi);
    return {
      label: ayAdi(mi),
      dc: ay.reduce((s, h) => s + h.dcKw, 0),
      ac: ay.reduce((s, h) => s + h.acKw, 0)
    };
  }) : [];

  const toplamDcMwh = pvsystData ? pvsystData.reduce((s, h) => s + h.dcKw, 0) / 1000 : 0;
  const toplamAcMwh = pvsystData ? pvsystData.reduce((s, h) => s + h.acKw, 0) / 1000 : 0;
  const clippingMwh = toplamDcMwh - toplamAcMwh;
  const clippingPct = toplamDcMwh > 0 ? (clippingMwh / toplamDcMwh * 100).toFixed(1) : 0;

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setHata("Lutfen bir .CSV dosyasi yukleyin.");
      return;
    }
    setYukleniyor(true);
    setHata(null);
    try {
      const text = await file.text();
      const parsed = parsePvsystCsv(text);
      setPvsystData(parsed, file.name);
      setYukluDosya({ name: file.name, size: (file.size / 1024).toFixed(0) });
    } catch (e) {
      setHata(e.message);
    } finally {
      setYukleniyor(false);
    }
  }, [setPvsystData]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
  }

  return (
    <div>
      <div className="sayfa-baslik">
        <h2>1 — PVSyst Verisi</h2>
        <p>PVSyst simulasyon ciktisindaki saatlik uretim CSV dosyasini yukleyin.</p>
      </div>

      {!pvsystData ? (
        <div className="card">
          <div
            className={`drop-zone ${dragOver ? "dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-zone-ikon">
              {yukleniyor ? (
                <div className="spinner" style={{ margin: "0 auto" }} />
              ) : "📊"}
            </div>
            <h4>PVSyst CSV Dosyasini Buraya Suruklleyin</h4>
            <p>veya tiklayin secmek icin</p>
            <p style={{ marginTop: 8, fontSize: "0.78rem" }}>Desteklenen: EArray, E_Grid kolonlarini iceren PVSyst Hourly dosyasi (.csv)</p>
            <input ref={inputRef} type="file" accept=".csv" hidden onChange={handleInputChange} />
          </div>

          {hata && (
            <div className="alert alert-danger mt-3">{hata}</div>
          )}

          <div className="card-baslik mt-3" style={{ fontSize: "0.9rem", color: "var(--text-soft)" }}>
            PVSyst CSV Format Rehberi:
          </div>
          <ul style={{ fontSize: "0.82rem", color: "var(--text-muted)", paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Dosya ayiraci: noktalı virgul (;)</li>
            <li>Gerekli kolonlar: <strong>EArray</strong> (DC uretim) ve <strong>E_Grid</strong> (AC uretim)</li>
            <li>8760 saatlik veri (1 tam yıl)</li>
            <li>PVSyst verisi UTC+0 saat dilimindendir</li>
          </ul>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div className="dosya-bilgi">
                <div className="dosya-bilgi-ikon">📊</div>
                <div className="dosya-bilgi-icerik">
                  <strong>{yukluDosya?.name || "pvsyst_output.csv"}</strong>
                  <span>{pvsystData.length} saatlik veri yuklu {yukluDosya?.size ? `(${yukluDosya.size} KB)` : ""}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-kucuk"
                onClick={() => { setPvsystData(null); setYukluDosya(null); }}
              >
                Dosyayi Degistir
              </button>
            </div>

            <div className="pvsyst-ozet-grid">
              <div className="pvsyst-ozet-kart">
                <strong>{toplamAcMwh.toFixed(0)} MWh</strong>
                <span>Toplam AC Uretim</span>
              </div>
              <div className="pvsyst-ozet-kart">
                <strong>{toplamDcMwh.toFixed(0)} MWh</strong>
                <span>Toplam DC Uretim</span>
              </div>
              <div className="pvsyst-ozet-kart">
                <strong>{clippingMwh.toFixed(1)} MWh</strong>
                <span>Clipping (DC-AC)</span>
              </div>
              <div className="pvsyst-ozet-kart">
                <strong>%{clippingPct}</strong>
                <span>Clipping Orani</span>
              </div>
              <div className="pvsyst-ozet-kart">
                <strong>{pvsystData.length}</strong>
                <span>Toplam Saat</span>
              </div>
            </div>
          </div>

          <div className="grafik-kutu">
            <div className="grafik-baslik">Aylik DC / AC Uretim (MWh)</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                <span style={{ width: 12, height: 12, background: "#1B2B5E", borderRadius: 2, opacity: 0.7, display: "inline-block" }} />
                DC Uretim
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                <span style={{ width: 12, height: 12, background: "#E8500A", borderRadius: 2, opacity: 0.85, display: "inline-block" }} />
                AC (Sarjebeke)
              </div>
            </div>
            <SimpleBarChart data={monthlyData} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary btn-buyuk"
              onClick={() => navigate("/app/batarya")}
            >
              Batarya Secimi &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PvsystSayfasi;
