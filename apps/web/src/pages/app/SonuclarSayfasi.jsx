import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const AY_ADLARI = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];

function fmt(val, birlik = "", ondalik = 0) {
  if (val === null || val === undefined) return "-";
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return "-";
  return num.toLocaleString("tr-TR", { maximumFractionDigits: ondalik }) + (birlik ? " " + birlik : "");
}

/* ===== BASIT SVG GRAFIKLER ===== */
function BarChart({ data, yKey, color = "#E8500A", label, height = 180 }) {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => d[yKey] || 0);
  const maxV = Math.max(...vals.map(Math.abs), 1);
  const W = 560;
  const barW = (W - 40) / data.length;
  const zero = height / 2;

  return (
    <svg viewBox={`0 0 ${W} ${height + 30}`} style={{ width: "100%", maxHeight: 220 }}>
      {data.map((d, i) => {
        const v = d[yKey] || 0;
        const h = (Math.abs(v) / maxV) * (height * 0.9);
        const y = v >= 0 ? zero - h : zero;
        const x = 30 + i * barW;
        return (
          <g key={i}>
            <rect x={x + 1} y={y} width={barW - 2} height={h} fill={v >= 0 ? color : "#DC2626"} opacity={0.85} />
            <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="9" fill="#94A3B8">
              {d.month ? AY_ADLARI[(d.month - 1) % 12] : i}
            </text>
          </g>
        );
      })}
      <line x1="30" y1={zero} x2={W} y2={zero} stroke="#E2E8F0" strokeWidth="1" />
    </svg>
  );
}

function LineChart({ data, keys, colors, height = 180 }) {
  if (!data || data.length === 0) return null;
  const W = 700;
  const PAD = 40;
  const allVals = keys.flatMap(k => data.map(d => d[k] || 0));
  const maxV = Math.max(...allVals, 1);
  const minV = Math.min(...allVals, 0);
  const range = maxV - minV || 1;

  function pt(i, val) {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + ((maxV - val) / range) * (height - PAD * 2);
    return `${x},${y}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", maxHeight: height }}>
      {keys.map((k, ki) => {
        const pts = data.map((d, i) => pt(i, d[k] || 0)).join(" ");
        return (
          <polyline
            key={k}
            points={pts}
            fill="none"
            stroke={colors[ki]}
            strokeWidth="1.5"
            opacity={0.85}
          />
        );
      })}
      <line x1={PAD} y1={PAD} x2={PAD} y2={height - PAD} stroke="#E2E8F0" strokeWidth="1" />
      <line x1={PAD} y1={height - PAD} x2={W - PAD} y2={height - PAD} stroke="#E2E8F0" strokeWidth="1" />
    </svg>
  );
}

/* ===== KPI TABLOSU ===== */
function KpiTablosu({ kpis }) {
  if (!kpis) return null;
  const satirlar = [
    { etiket: "Baslangic Yatirimi", deger: fmt(kpis.initialInvestmentTry, "₺"), renk: "var(--secondary)" },
    { etiket: "Yillik Gelir", deger: fmt(kpis.annualRevenueTry, "₺"), renk: "var(--success)" },
    { etiket: "Yillik Bakim Maliyeti", deger: fmt(kpis.annualMaintenanceTry, "₺"), renk: "var(--danger)" },
    { etiket: "Yillik Net Gelir", deger: fmt(kpis.annualNetRevenueTry, "₺"), renk: "var(--success)" },
    { etiket: "Net Bugunku Deger (NPV)", deger: fmt(kpis.npvTry, "₺"), renk: kpis.npvTry >= 0 ? "var(--success)" : "var(--danger)" },
    { etiket: "Ic Getiri Orani (IRR)", deger: kpis.irrPct !== null ? `%${kpis.irrPct}` : "-", renk: "var(--primary)" },
    { etiket: "LCOE", deger: fmt(kpis.lcoeTryMwh, "₺/MWh"), renk: "var(--text)" },
    { etiket: "Geri Odeme Suresi", deger: kpis.paybackYears ? `${kpis.paybackYears} yil` : "Geri odenmiyor", renk: "var(--text)" },
    { etiket: "Toplam Desarj", deger: fmt(kpis.totalDischargeMwh, "MWh", 1), renk: "var(--text)" },
    { etiket: "Round-Trip Verimlilik", deger: kpis.roundTripEfficiencyPct ? `%${kpis.roundTripEfficiencyPct}` : "-", renk: "var(--text)" }
  ];

  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { etiket: "NPV", deger: fmt(kpis.npvTry, "₺"), vurgulu: true },
          { etiket: "IRR", deger: kpis.irrPct !== null ? `%${kpis.irrPct}` : "-", vurgulu: false },
          { etiket: "Geri Odeme", deger: kpis.paybackYears ? `${kpis.paybackYears} yıl` : "-", vurgulu: false },
          { etiket: "Yillik Net Gelir", deger: fmt(kpis.annualNetRevenueTry, "₺"), vurgulu: false }
        ].map(k => (
          <div key={k.etiket} className={`kpi-kart ${k.vurgulu ? "vurgulu" : ""}`}>
            <div className="kpi-etiket">{k.etiket}</div>
            <div className="kpi-deger">{k.deger}</div>
          </div>
        ))}
      </div>

      <div className="tablo-kap">
        <table className="tablo">
          <thead>
            <tr><th>Gosterge</th><th>Deger</th></tr>
          </thead>
          <tbody>
            {satirlar.map(s => (
              <tr key={s.etiket}>
                <td>{s.etiket}</td>
                <td style={{ fontWeight: 700, color: s.renk }}>{s.deger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== ANA SAYFA ===== */
function SonuclarSayfasi() {
  const navigate = useNavigate();
  const { simulasyonSonucu, secilenBatarya, stratejiKonfig } = useAppWorkspace();
  const [aktifSekme, setAktifSekme] = useState("finansal");

  if (!simulasyonSonucu) {
    return (
      <div>
        <div className="sayfa-baslik">
          <h2>5 — Sonuclar</h2>
          <p>Henuz simulasyon sonucu yok.</p>
        </div>
        <div className="card">
          <div className="sim-durum-kutu">
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--bg)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              </div>
            <div className="sim-durum-baslik">Sonuc Bulunamadi</div>
            <div className="sim-durum-alt">Once simulasyonu calistirmaniz gerekiyor.</div>
            <button type="button" className="btn btn-primary mt-3" onClick={() => navigate("/app/simulasyon")}>
              Simulasyon Sayfasina Git
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { summary, hourly } = simulasyonSonucu;
  const { kpis, monthly, meta } = summary;

  const STRATEJI_ADI = {
    arbitraj: "Arbitraj",
    peak_shaving: "Peak Shaving",
    price_threshold: "Fiyat Esigi"
  };

  return (
    <div>
      <div className="sayfa-baslik" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>5 — Simulasyon Sonuclari</h2>
          <p>
            {secilenBatarya?.model} &bull; {STRATEJI_ADI[stratejiKonfig?.strategyType] || meta?.strategy} &bull; {meta?.totalHours || 8760} saat
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline btn-kucuk"
            onClick={() => navigate("/app/simulasyon")}
          >
            Yeniden Calistir
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-kucuk"
            onClick={() => window.print()}
          >
            Yazdir / PDF
          </button>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: 0 }}>
        {[
          { key: "finansal", label: "Finansal Analiz" },
          { key: "aylik", label: "Aylik Gelir" },
          { key: "saatlik", label: "Saatlik Grafik" }
        ].map(s => (
          <button
            key={s.key}
            type="button"
            className={`tab-btn ${aktifSekme === s.key ? "aktif" : ""}`}
            onClick={() => setAktifSekme(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {aktifSekme === "finansal" && (
          <div className="card">
            <div className="card-baslik">Finansal Gostergeler</div>
            <KpiTablosu kpis={kpis} />
          </div>
        )}

        {aktifSekme === "aylik" && monthly && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="grafik-kutu">
              <div className="grafik-baslik">Aylik Gelir (₺)</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                  <span style={{ width: 12, height: 12, background: "#E8500A", borderRadius: 2, display: "inline-block" }} />
                  Gelir (pozitif)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                  <span style={{ width: 12, height: 12, background: "#DC2626", borderRadius: 2, display: "inline-block" }} />
                  Zarar (negatif)
                </div>
              </div>
              <BarChart data={monthly} yKey="revenueTry" color="#E8500A" height={180} />
            </div>

            <div className="grafik-kutu">
              <div className="grafik-baslik">Aylik Sarj / Desarj (kWh)</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                  <span style={{ width: 12, height: 12, background: "#1B2B5E", borderRadius: 2, display: "inline-block" }} />
                  Sarj
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                  <span style={{ width: 12, height: 12, background: "#E8500A", borderRadius: 2, display: "inline-block" }} />
                  Desarj
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <BarChart data={monthly} yKey="chargeKwh" color="#1B2B5E" height={150} />
                <BarChart data={monthly} yKey="dischargeKwh" color="#E8500A" height={150} />
              </div>
            </div>

            <div className="tablo-kap">
              <table className="tablo">
                <thead>
                  <tr>
                    <th>Ay</th>
                    <th>Gelir (₺)</th>
                    <th>Sarj (kWh)</th>
                    <th>Desarj (kWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map(m => (
                    <tr key={m.month}>
                      <td>{AY_ADLARI[(m.month - 1) % 12]}</td>
                      <td style={{ fontWeight: 700, color: m.revenueTry >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {fmt(m.revenueTry, "₺")}
                      </td>
                      <td>{fmt(m.chargeKwh, "kWh")}</td>
                      <td>{fmt(m.dischargeKwh, "kWh")}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                    <td>TOPLAM</td>
                    <td style={{ color: "var(--success)" }}>
                      {fmt(monthly.reduce((s, m) => s + m.revenueTry, 0), "₺")}
                    </td>
                    <td>{fmt(monthly.reduce((s, m) => s + m.chargeKwh, 0), "kWh")}</td>
                    <td>{fmt(monthly.reduce((s, m) => s + m.dischargeKwh, 0), "kWh")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aktifSekme === "saatlik" && hourly && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="alert alert-info">
              Ilk 168 saat (7 gun) gosteriliyor. Tum yil verisi sunucuda kayitlidir.
            </div>

            <div className="grafik-kutu">
              <div className="grafik-baslik">SOC (%) — Ilk 168 Saat</div>
              <LineChart
                data={hourly.slice(0, 168)}
                keys={["socPct"]}
                colors={["#E8500A"]}
                height={180}
              />
            </div>

            <div className="grafik-kutu">
              <div className="grafik-baslik">AC Uretim & Sarj/Desarj (kW) — Ilk 168 Saat</div>
              <LineChart
                data={hourly.slice(0, 168)}
                keys={["acKw", "chargeKw", "dischargeKw"]}
                colors={["#1B2B5E", "#16A34A", "#E8500A"]}
                height={200}
              />
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                {[
                  { label: "AC Uretim", color: "#1B2B5E" },
                  { label: "Sarj", color: "#16A34A" },
                  { label: "Desarj", color: "#E8500A" }
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                    <span style={{ width: 12, height: 12, background: l.color, borderRadius: 2, display: "inline-block" }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="grafik-kutu">
              <div className="grafik-baslik">EPIAS Fiyati (₺/MWh) — Ilk 168 Saat</div>
              <LineChart
                data={hourly.slice(0, 168)}
                keys={["priceTryMwh"]}
                colors={["#D97706"]}
                height={160}
              />
            </div>

            <div className="tablo-kap">
              <table className="tablo">
                <thead>
                  <tr>
                    <th>Saat</th>
                    <th>AC (kW)</th>
                    <th>Sarj (kW)</th>
                    <th>Desarj (kW)</th>
                    <th>SOC (%)</th>
                    <th>Fiyat (₺/MWh)</th>
                    <th>Gelir (₺)</th>
                  </tr>
                </thead>
                <tbody>
                  {hourly.slice(0, 48).map(h => (
                    <tr key={h.hourIndex}>
                      <td>{h.hourIndex}</td>
                      <td>{h.acKw?.toFixed(1)}</td>
                      <td style={{ color: h.chargeKw > 0 ? "var(--success)" : undefined }}>
                        {h.chargeKw?.toFixed(1)}
                      </td>
                      <td style={{ color: h.dischargeKw > 0 ? "var(--primary)" : undefined }}>
                        {h.dischargeKw?.toFixed(1)}
                      </td>
                      <td>{h.socPct?.toFixed(1)}%</td>
                      <td>{h.priceTryMwh?.toFixed(0)}</td>
                      <td style={{ fontWeight: 700, color: h.revenueTry >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {h.revenueTry?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SonuclarSayfasi;
