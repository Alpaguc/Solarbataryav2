import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

/* ===================================================
   PVSyst Saatlik CSV Parser
   - Kolon basliklarini dinamik tespit eder
   - Tum mevcut kolonlari okur
   - Birim satirini parse ederek olcekleme yapar
   =================================================== */
function parsePvsystCsv(rawText) {
  const lines = rawText.split(/\r?\n/);

  // Metadata satirlarini topla (= ile baslayan ya da ilk 15 satir)
  const meta = {};
  let headerLineIdx = -1;

  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i];
    // Metadata: "Key=Value" ya da "Key Value" formati
    const eqMatch = line.match(/^([^;=]+)=(.+)/);
    if (eqMatch) {
      meta[eqMatch[1].trim()] = eqMatch[2].trim();
    }
    // Baslik satiri: E_Grid veya EArray icermeli
    if (
      (line.includes("E_Grid") || line.includes("EArray")) &&
      line.includes(";")
    ) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx === -1) {
    throw new Error(
      "CSV baslik satiri bulunamadi. E_Grid veya EArray kolonunu iceren, noktalı virgul ayiracli bir PVSyst Hourly CSV bekleniyor."
    );
  }

  // Kolon basliklarini parse et
  const headers = lines[headerLineIdx]
    .split(";")
    .map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));

  // Birim satirini parse et (bir sonraki satir)
  const unitLine = lines[headerLineIdx + 1] || "";
  const units = unitLine
    .split(";")
    .map((u) => u.trim().replace(/^"/, "").replace(/"$/, "").toLowerCase());

  // Kolon indekslerini bul
  function colIdx(...names) {
    for (const n of names) {
      const idx = headers.findIndex(
        (h) => h.toLowerCase() === n.toLowerCase()
      );
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const cols = {
    date:       colIdx("date", "date hour"),
    globHor:    colIdx("GlobHor", "Gh", "GlobalHorizontal"),
    diffHor:    colIdx("DiffHor", "Dh"),
    globInc:    colIdx("GlobInc", "Gi", "GlobalInclined"),
    globEff:    colIdx("GlobEff", "GEffInc"),
    tAmb:       colIdx("T_Amb", "T Amb", "Tamb", "Tair"),
    tArray:     colIdx("TArray", "T_Array"),
    windVel:    colIdx("WindVel", "WS", "Wind"),
    eArray:     colIdx("EArray"),
    eGrid:      colIdx("E_Grid", "EGrid"),
    pr:         colIdx("PR"),
    shdLoss:    colIdx("ShdLoss", "ShdFct"),
  };

  if (cols.eGrid === -1) {
    throw new Error(
      `E_Grid kolonu bulunamadi. Bulunan kolonlar: ${headers.join(", ")}`
    );
  }

  // Birim bazli olcekleme: W -> kW icin /1000, kWh kalirsa 1
  function scaleFactor(idx) {
    if (idx < 0) return 1;
    const u = units[idx] || "";
    if (u.includes("wh") && !u.includes("kwh")) return 0.001; // Wh -> kWh
    if (u === "w/m2" || u === "w m2" || u === "wm2") return 1; // Wh/m2 vs W/m2
    return 1;
  }

  const scaleEArray = scaleFactor(cols.eArray);
  const scaleEGrid  = scaleFactor(cols.eGrid);

  // Veri satirlarini oku (baslik + birim satiri atlaniyor)
  const data = [];
  const dataStart = headerLineIdx + 2;

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const c = line.split(";").map((v) => v.trim().replace(",", "."));

    function flt(idx) {
      if (idx < 0) return null;
      const v = parseFloat(c[idx]);
      return isNaN(v) ? null : v;
    }

    data.push({
      hourIndex:  data.length,
      globHor:    flt(cols.globHor),
      diffHor:    flt(cols.diffHor),
      globInc:    flt(cols.globInc),
      globEff:    flt(cols.globEff),
      tAmb:       flt(cols.tAmb),
      tArray:     flt(cols.tArray),
      windVel:    flt(cols.windVel),
      eArrayKwh:  cols.eArray >= 0 ? (flt(cols.eArray) || 0) * scaleEArray : null,
      eGridKwh:   (flt(cols.eGrid) || 0) * scaleEGrid,
      pr:         flt(cols.pr),
    });

    if (data.length >= 8760) break;
  }

  if (data.length < 8700) {
    throw new Error(
      `Yetersiz veri: ${data.length} saat (en az 8700 bekleniyor). Dosya tam yillik mi?`
    );
  }

  // Mevcut kolon listesi
  const mevcutKolonlar = Object.entries(cols)
    .filter(([, v]) => v >= 0)
    .map(([k]) => k);

  return { data, meta, headers, units, cols: mevcutKolonlar };
}

/* ===================================================
   Yardimci Fonksiyonlar
   =================================================== */
const AY_ADLARI = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];

function ayIndexi(hourIndex) {
  // PVSyst: Ocak 1-744, Subat 745-1416...
  const AY_SAATLERI = [744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760];
  return AY_SAATLERI.findIndex((s) => hourIndex < s);
}

function hesaplaAylik(data) {
  const aylar = Array.from({ length: 12 }, () => ({
    eGrid: 0, eArray: 0, globHor: 0, globInc: 0,
    tAmbSum: 0, tAmbN: 0, saat: 0
  }));

  for (const h of data) {
    const ai = ayIndexi(h.hourIndex);
    if (ai < 0 || ai > 11) continue;
    const a = aylar[ai];
    a.eGrid   += h.eGridKwh || 0;
    a.eArray  += h.eArrayKwh || 0;
    a.globHor += (h.globHor || 0);    // W/m2 * 1h = Wh/m2
    a.globInc += (h.globInc || 0);
    if (h.tAmb !== null) { a.tAmbSum += h.tAmb; a.tAmbN++; }
    a.saat++;
  }

  return aylar.map((a, i) => ({
    ay: AY_ADLARI[i],
    eGridMwh:     a.eGrid / 1000,
    eArrayMwh:    a.eArray / 1000,
    clippingMwh:  (a.eArray - a.eGrid) / 1000,
    globHorKwhM2: a.globHor / 1000,  // Wh/m2 -> kWh/m2
    globIncKwhM2: a.globInc / 1000,
    tAmbOrtalama: a.tAmbN > 0 ? a.tAmbSum / a.tAmbN : null,
  }));
}

/* ===================================================
   SVG Grafik Bilesenler
   =================================================== */
function BarChart({ seriler, yLabels, genislik = 560, yukseklik = 180 }) {
  if (!yLabels || !seriler?.length) return null;
  const n = yLabels.length;
  const maxVal = Math.max(
    ...seriler.flatMap((s) => s.degerler.map((v) => Math.abs(v || 0))),
    0.001
  );
  const PAD_L = 44;
  const PAD_B = 22;
  const barAlan = (genislik - PAD_L) / n;
  const barGenis = (barAlan * 0.7) / seriler.length;
  const h = yukseklik - PAD_B;

  // Y ekseni etiketleri
  const ySteps = 4;
  const yTick = maxVal / ySteps;

  return (
    <svg viewBox={`0 0 ${genislik} ${yukseklik + 10}`} style={{ width: "100%", display: "block" }}>
      {/* Y ekseni izgarasi */}
      {Array.from({ length: ySteps + 1 }, (_, yi) => {
        const y = h - (yi / ySteps) * h;
        const val = (yi / ySteps) * maxVal;
        return (
          <g key={yi}>
            <line x1={PAD_L} y1={y} x2={genislik} y2={y} stroke="#E2E8F0" strokeWidth="0.8" />
            <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize="8" fill="#94A3B8">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(val < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}

      {/* Cubuklar */}
      {yLabels.map((lbl, i) => {
        const baseX = PAD_L + i * barAlan + barAlan * 0.15;
        return (
          <g key={i}>
            {seriler.map((s, si) => {
              const val = Math.max(0, s.degerler[i] || 0);
              const bh = (val / maxVal) * h;
              const bx = baseX + si * (barGenis + 1);
              return (
                <rect
                  key={si}
                  x={bx}
                  y={h - bh}
                  width={barGenis}
                  height={bh}
                  fill={s.renk}
                  opacity={0.85}
                  rx={1}
                >
                  <title>{`${s.ad}: ${val.toFixed(2)}`}</title>
                </rect>
              );
            })}
            <text
              x={PAD_L + i * barAlan + barAlan / 2}
              y={h + PAD_B - 4}
              textAnchor="middle"
              fontSize="8.5"
              fill="#64748B"
            >
              {lbl}
            </text>
          </g>
        );
      })}

      {/* Eksenler */}
      <line x1={PAD_L} y1={0} x2={PAD_L} y2={h} stroke="#CBD5E1" strokeWidth="1" />
      <line x1={PAD_L} y1={h} x2={genislik} y2={h} stroke="#CBD5E1" strokeWidth="1" />
    </svg>
  );
}

function LineChart({ seri, yLabels, renk = "#E8500A", genislik = 560, yukseklik = 140 }) {
  if (!seri || seri.length === 0) return null;
  const maxV = Math.max(...seri.map(Math.abs), 0.001);
  const minV = Math.min(...seri, 0);
  const range = maxV - minV || 0.001;
  const PAD_L = 44;
  const PAD_B = 22;
  const w = genislik - PAD_L;
  const h = yukseklik - PAD_B;

  const pts = seri
    .map((v, i) => {
      const x = PAD_L + (i / (seri.length - 1)) * w;
      const y = h - ((v - minV) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${genislik} ${yukseklik + 10}`} style={{ width: "100%", display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = h - f * h;
        const val = minV + f * range;
        return (
          <g key={f}>
            <line x1={PAD_L} y1={y} x2={genislik} y2={y} stroke="#E2E8F0" strokeWidth="0.8" />
            <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize="8" fill="#94A3B8">
              {val.toFixed(val < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}

      <polyline points={pts} fill="none" stroke={renk} strokeWidth="2" />

      {yLabels.map((lbl, i) => (
        <text
          key={i}
          x={PAD_L + (i / (yLabels.length - 1)) * w}
          y={h + PAD_B - 4}
          textAnchor="middle"
          fontSize="8.5"
          fill="#64748B"
        >
          {lbl}
        </text>
      ))}

      <line x1={PAD_L} y1={0} x2={PAD_L} y2={h} stroke="#CBD5E1" strokeWidth="1" />
      <line x1={PAD_L} y1={h} x2={genislik} y2={h} stroke="#CBD5E1" strokeWidth="1" />
    </svg>
  );
}

/* ===================================================
   Renk Etiketi
   =================================================== */
function RenkEtiket({ renk, ad }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "var(--text-soft)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: renk, display: "inline-block", flexShrink: 0 }} />
      {ad}
    </span>
  );
}

/* ===================================================
   Ana Sayfa
   =================================================== */
function PvsystSayfasi() {
  const navigate = useNavigate();
  const { pvsystData, setPvsystData, pvsystFilename } = useAppWorkspace();
  const [yukluDosya, setYukluDosya] = useState(
    pvsystFilename ? { name: pvsystFilename } : null
  );
  const [parseInfo, setParseInfo] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [aktifGrafik, setAktifGrafik] = useState("uretim");
  const inputRef = useRef(null);

  /* Aylik ozet */
  const aylik = pvsystData ? hesaplaAylik(pvsystData) : null;
  const aylar = AY_ADLARI;

  const toplamEGrid  = aylik ? aylik.reduce((s, a) => s + a.eGridMwh, 0) : 0;
  const toplamEArray = aylik ? aylik.reduce((s, a) => s + a.eArrayMwh, 0) : 0;
  const toplamClip   = toplamEArray - toplamEGrid;
  const clipPct      = toplamEArray > 0 ? (toplamClip / toplamEArray * 100) : 0;
  const toplamGlobHor = aylik ? aylik.reduce((s, a) => s + a.globHorKwhM2, 0) : 0;
  const toplamGlobInc = aylik ? aylik.reduce((s, a) => s + a.globIncKwhM2, 0) : 0;
  const prOrtalama   = pvsystData
    ? (pvsystData.filter(h => h.pr !== null).reduce((s, h) => s + (h.pr || 0), 0) /
       Math.max(1, pvsystData.filter(h => h.pr !== null).length))
    : null;

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const text = await file.text();
      const result = parsePvsystCsv(text);
      setPvsystData(result.data, file.name);
      setYukluDosya({ name: file.name, size: (file.size / 1024).toFixed(0) });
      setParseInfo({ mevcutKolonlar: result.cols, headerIdx: result.headers });
    } catch (e) {
      setHata(e.message);
    } finally {
      setYukleniyor(false);
    }
  }, [setPvsystData]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  if (!pvsystData) {
    return (
      <div>
        <div className="sayfa-baslik">
          <h2>Adim 1 — PVSyst Verisi</h2>
          <p>PVSyst simulasyon ciktisindaki saatlik uretim CSV dosyasini yukleyin.</p>
        </div>

        <div className="card">
          <div
            style={{
              border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
              borderRadius: 12,
              padding: "48px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "var(--primary-light)" : "var(--bg)",
              transition: "all 0.2s"
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            {yukleniyor ? (
              <>
                <div className="spinner" style={{ margin: "0 auto 16px" }} />
                <div style={{ fontWeight: 600, color: "var(--text-soft)" }}>CSV okunuyor ve parse ediliyor...</div>
              </>
            ) : (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: 14,
                  background: "var(--primary-light)", margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--secondary)", marginBottom: 6 }}>
                  PVSyst CSV Dosyasini Suruklleyin veya Seçin
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  PVSyst Hourly simulation output (.csv) — noktalı virgul ayiracli
                </div>
              </>
            )}
            <input ref={inputRef} type="file" accept=".csv,.txt" hidden onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {hata && <div className="alert alert-danger mt-3">{hata}</div>}

          <div style={{ marginTop: 20, padding: "16px 20px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--secondary)", marginBottom: 10 }}>
              Beklenen Kolon Formati
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "var(--secondary)", color: "#fff" }}>
                    {["Kolon", "Birim", "Aciklama", "Zorunlu"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["E_Grid",   "kWh",   "Sahaya verilen enerji (AC cikis)",      "Evet"],
                    ["EArray",   "kWh",   "Array enerjisi (inverter oncesi DC)",    "Onerilir"],
                    ["GlobHor",  "W/m2",  "Yatay duzlem kuresel isima",            "Opsiyonel"],
                    ["GlobInc",  "W/m2",  "Egik duzlem kuresel isima",             "Opsiyonel"],
                    ["T_Amb",    "degC",  "Ortam sicakligi",                       "Opsiyonel"],
                    ["WindVel",  "m/s",   "Ruzgar hizi",                           "Opsiyonel"],
                    ["PR",       "-",     "Performans orani",                      "Opsiyonel"],
                  ].map(([col, unit, desc, req]) => (
                    <tr key={col} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "var(--primary)", fontWeight: 700 }}>{col}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{unit}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text-soft)" }}>{desc}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <span style={{
                          background: req === "Evet" ? "#FEE2E2" : req === "Onerilir" ? "var(--primary-light)" : "var(--bg)",
                          color: req === "Evet" ? "var(--danger)" : req === "Onerilir" ? "var(--primary)" : "var(--text-muted)",
                          borderRadius: 999, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700
                        }}>{req}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Veri yuklu ekran ---- */
  return (
    <div>
      <div className="sayfa-baslik" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>Adim 1 — PVSyst Verisi</h2>
          <p style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-soft)" }}>
            {yukluDosya?.name}
            {yukluDosya?.size && <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>({yukluDosya.size} KB)</span>}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-kucuk"
          onClick={() => { setPvsystData(null); setYukluDosya(null); setParseInfo(null); }}
        >
          Dosyayi Degistir
        </button>
      </div>

      {/* KPI KARTI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          {
            etiket: "E_Grid (AC Sahaya)",
            deger: toplamEGrid.toFixed(0),
            birim: "MWh/yil",
            renk: "var(--primary)",
            aciklama: "Invertorden sahaya verilen net enerji"
          },
          {
            etiket: "EArray (DC Uretim)",
            deger: toplamEArray > 0 ? toplamEArray.toFixed(0) : "—",
            birim: toplamEArray > 0 ? "MWh/yil" : "",
            renk: "var(--secondary)",
            aciklama: "Array cikisindaki DC enerji"
          },
          {
            etiket: "Clipping",
            deger: toplamEArray > 0 ? `${toplamClip.toFixed(1)}` : "—",
            birim: toplamEArray > 0 ? `MWh (%${clipPct.toFixed(1)})` : "",
            renk: clipPct > 5 ? "var(--warning)" : "var(--success)",
            aciklama: "Inverter limiti nedeniyle kesilen DC enerji — batarya icin potansiyel"
          },
          {
            etiket: "GlobHor",
            deger: toplamGlobHor > 0 ? toplamGlobHor.toFixed(0) : "—",
            birim: toplamGlobHor > 0 ? "kWh/m2" : "Kolon yok",
            renk: "#D97706",
            aciklama: "Yatay duzlem kuresel isima toplami"
          },
          {
            etiket: "GlobInc",
            deger: toplamGlobInc > 0 ? toplamGlobInc.toFixed(0) : "—",
            birim: toplamGlobInc > 0 ? "kWh/m2" : "Kolon yok",
            renk: "#0284C7",
            aciklama: "Panel duzlemi kuresel isima toplami"
          },
          {
            etiket: "Ort. PR",
            deger: prOrtalama !== null ? (prOrtalama < 2 ? (prOrtalama * 100).toFixed(1) : prOrtalama.toFixed(1)) : "—",
            birim: prOrtalama !== null ? "%" : "Kolon yok",
            renk: "var(--success)",
            aciklama: "Yillik ortalama performans orani"
          },
          {
            etiket: "Veri Noktasi",
            deger: pvsystData.length.toLocaleString("tr-TR"),
            birim: "saat",
            renk: "var(--text-soft)",
            aciklama: "CSV'den okunan saatlik kayit sayisi"
          },
        ].map((k) => (
          <div
            key={k.etiket}
            className="kpi-kart"
            title={k.aciklama}
            style={{ cursor: "help" }}
          >
            <div className="kpi-etiket">{k.etiket}</div>
            <div className="kpi-deger" style={{ fontSize: "1.4rem", color: k.renk }}>{k.deger}</div>
            <div className="kpi-birim">{k.birim}</div>
          </div>
        ))}
      </div>

      {/* GRAFIK SEKMELER */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "flex", borderBottom: "1px solid var(--border)",
          background: "var(--bg)", overflowX: "auto"
        }}>
          {[
            { key: "uretim",   label: "Uretim (E_Grid / EArray)" },
            { key: "clipping", label: "Clipping (DC — AC)" },
            { key: "isima",    label: "Isima (GlobHor / GlobInc)", gizle: toplamGlobHor === 0 },
            { key: "sicaklik", label: "Sicaklik (T_Amb)",
              gizle: !pvsystData.some(h => h.tAmb !== null) },
          ]
            .filter(s => !s.gizle)
            .map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setAktifGrafik(s.key)}
                style={{
                  padding: "12px 18px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  color: aktifGrafik === s.key ? "var(--primary)" : "var(--text-soft)",
                  borderBottom: `2px solid ${aktifGrafik === s.key ? "var(--primary)" : "transparent"}`,
                  whiteSpace: "nowrap",
                  transition: "all 0.15s"
                }}
              >
                {s.label}
              </button>
            ))}
        </div>

        <div style={{ padding: "20px 24px" }}>

          {aktifGrafik === "uretim" && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <RenkEtiket renk="#E8500A" ad="E_Grid — Sahaya AC Enerji (MWh)" />
                {toplamEArray > 0 && <RenkEtiket renk="#1B2B5E" ad="EArray — DC Uretim (MWh)" />}
              </div>
              <BarChart
                yLabels={aylar}
                seriler={[
                  toplamEArray > 0 && {
                    ad: "EArray (MWh)",
                    degerler: aylik.map(a => a.eArrayMwh),
                    renk: "#1B2B5E"
                  },
                  {
                    ad: "E_Grid (MWh)",
                    degerler: aylik.map(a => a.eGridMwh),
                    renk: "#E8500A"
                  }
                ].filter(Boolean)}
              />
              <div style={{ marginTop: 16, overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-soft)", fontWeight: 700 }}>Ay</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", color: "#E8500A", fontWeight: 700 }}>E_Grid (MWh)</th>
                      {toplamEArray > 0 && <th style={{ padding: "6px 10px", textAlign: "right", color: "#1B2B5E", fontWeight: 700 }}>EArray (MWh)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {aylik.map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>{a.ay}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: "#E8500A" }}>
                          {a.eGridMwh.toFixed(1)}
                        </td>
                        {toplamEArray > 0 && (
                          <td style={{ padding: "6px 10px", textAlign: "right", color: "#1B2B5E" }}>
                            {a.eArrayMwh.toFixed(1)}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                      <td style={{ padding: "6px 10px" }}>TOPLAM</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#E8500A" }}>{toplamEGrid.toFixed(1)}</td>
                      {toplamEArray > 0 && <td style={{ padding: "6px 10px", textAlign: "right", color: "#1B2B5E" }}>{toplamEArray.toFixed(1)}</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {aktifGrafik === "clipping" && (
            <>
              {toplamEArray > 0 ? (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <RenkEtiket renk="#DC2626" ad="Clipping (EArray - E_Grid) MWh" />
                    <span style={{
                      marginLeft: 8, padding: "3px 10px", borderRadius: 999,
                      background: clipPct > 5 ? "#FEF9C3" : "#DCFCE7",
                      color: clipPct > 5 ? "#713F12" : "#15803D",
                      fontSize: "0.78rem", fontWeight: 700
                    }}>
                      Yillik Toplam Clipping: {toplamClip.toFixed(1)} MWh — %{clipPct.toFixed(2)}
                    </span>
                    {clipPct > 3 && (
                      <span style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: 600 }}>
                        Batarya depolama icin uygun potansiyel mevcut!
                      </span>
                    )}
                  </div>
                  <BarChart
                    yLabels={aylar}
                    seriler={[{ ad: "Clipping (MWh)", degerler: aylik.map(a => a.clippingMwh), renk: "#DC2626" }]}
                  />
                  <div style={{ marginTop: 16, overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border)" }}>
                          {["Ay", "EArray (MWh)", "E_Grid (MWh)", "Clipping (MWh)", "Clipping %"].map(h => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: h === "Ay" ? "left" : "right", color: "var(--text-soft)", fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {aylik.map((a, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 600 }}>{a.ay}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{a.eArrayMwh.toFixed(1)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#E8500A", fontWeight: 700 }}>{a.eGridMwh.toFixed(1)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#DC2626", fontWeight: 700 }}>{a.clippingMwh.toFixed(1)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: a.clippingMwh > 0 ? "#D97706" : "var(--text-muted)" }}>
                              {a.eArrayMwh > 0 ? `%${(a.clippingMwh / a.eArrayMwh * 100).toFixed(1)}` : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                          <td style={{ padding: "6px 10px" }}>TOPLAM</td>
                          <td style={{ padding: "6px 10px", textAlign: "right" }}>{toplamEArray.toFixed(1)}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", color: "#E8500A" }}>{toplamEGrid.toFixed(1)}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", color: "#DC2626" }}>{toplamClip.toFixed(1)}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right" }}>%{clipPct.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="alert alert-info">
                  EArray kolonu CSV dosyasinda bulunamadi. Clipping hesaplamasi icin hem EArray hem E_Grid kolonu gereklidir.
                </div>
              )}
            </>
          )}

          {aktifGrafik === "isima" && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                {toplamGlobHor > 0 && <RenkEtiket renk="#D97706" ad="GlobHor — Yatay Duzlem (kWh/m2)" />}
                {toplamGlobInc > 0 && <RenkEtiket renk="#0284C7" ad="GlobInc — Panel Duzlemi (kWh/m2)" />}
              </div>
              <BarChart
                yLabels={aylar}
                seriler={[
                  toplamGlobHor > 0 && { ad: "GlobHor (kWh/m2)", degerler: aylik.map(a => a.globHorKwhM2), renk: "#D97706" },
                  toplamGlobInc > 0 && { ad: "GlobInc (kWh/m2)", degerler: aylik.map(a => a.globIncKwhM2), renk: "#0284C7" }
                ].filter(Boolean)}
              />
              <div style={{ marginTop: 14, overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-soft)", fontWeight: 700 }}>Ay</th>
                      {toplamGlobHor > 0 && <th style={{ padding: "6px 10px", textAlign: "right", color: "#D97706", fontWeight: 700 }}>GlobHor (kWh/m2)</th>}
                      {toplamGlobInc > 0 && <th style={{ padding: "6px 10px", textAlign: "right", color: "#0284C7", fontWeight: 700 }}>GlobInc (kWh/m2)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {aylik.map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>{a.ay}</td>
                        {toplamGlobHor > 0 && <td style={{ padding: "6px 10px", textAlign: "right" }}>{a.globHorKwhM2.toFixed(1)}</td>}
                        {toplamGlobInc > 0 && <td style={{ padding: "6px 10px", textAlign: "right" }}>{a.globIncKwhM2.toFixed(1)}</td>}
                      </tr>
                    ))}
                    <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                      <td style={{ padding: "6px 10px" }}>TOPLAM</td>
                      {toplamGlobHor > 0 && <td style={{ padding: "6px 10px", textAlign: "right", color: "#D97706" }}>{toplamGlobHor.toFixed(0)}</td>}
                      {toplamGlobInc > 0 && <td style={{ padding: "6px 10px", textAlign: "right", color: "#0284C7" }}>{toplamGlobInc.toFixed(0)}</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {aktifGrafik === "sicaklik" && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <RenkEtiket renk="#7C3AED" ad="T_Amb — Aylik Ortalama Sicaklik (°C)" />
              </div>
              <LineChart
                seri={aylik.map(a => a.tAmbOrtalama || 0)}
                yLabels={aylar}
                renk="#7C3AED"
                yukseklik={160}
              />
              <div style={{ marginTop: 14, overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-soft)", fontWeight: 700 }}>Ay</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", color: "#7C3AED", fontWeight: 700 }}>Ort. T_Amb (°C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aylik.map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>{a.ay}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>
                          {a.tAmbOrtalama !== null ? `${a.tAmbOrtalama.toFixed(1)} °C` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Parse bilgisi */}
      {parseInfo && (
        <div style={{
          marginTop: 12, padding: "10px 16px",
          background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)",
          fontSize: "0.78rem", color: "var(--text-muted)"
        }}>
          <strong style={{ color: "var(--text-soft)" }}>Tespit edilen kolonlar:</strong>{" "}
          {parseInfo.mevcutKolonlar.join(", ")}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          type="button"
          className="btn btn-primary btn-buyuk"
          onClick={() => navigate("/app/batarya")}
        >
          Batarya Secimine Gec
        </button>
      </div>
    </div>
  );
}

export default PvsystSayfasi;
