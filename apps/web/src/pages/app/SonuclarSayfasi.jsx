import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const AY_ADLARI = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];
const AY_KISA = ["Oca", "Sub", "Mar", "Nis", "May", "Haz",
  "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];

// Her ayin gun sayisi (leap year degil)
const AY_GUNLER = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const AY_SINIRLAR = (() => {
  let saat = 0;
  const sinirlar = [0];
  for (const g of AY_GUNLER) { saat += g * 24; sinirlar.push(saat); }
  return sinirlar;
})();

function fmt(val, birlik = "", ondalik = 0) {
  if (val === null || val === undefined) return "-";
  const num = Number(val);
  if (isNaN(num)) return "-";
  return num.toLocaleString("tr-TR", { maximumFractionDigits: ondalik }) + (birlik ? " " + birlik : "");
}

function renk(val) {
  return val > 0 ? "var(--success)" : val < 0 ? "var(--danger)" : "var(--text-muted)";
}

/* ===== SVG BAR CHART ===== */
function BarChart({ data, yKey, color = "#E8500A", onTikla, secilenIdx, yLabel, height = 160 }) {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => d[yKey] || 0);
  const maxAbs = Math.max(...vals.map(Math.abs), 0.01);
  const W = 600;
  const BAR_TOPLAM = (W - 60) / data.length;
  const BAR_G = Math.max(BAR_TOPLAM * 0.65, 2);
  const BAR_OFF = (BAR_TOPLAM - BAR_G) / 2;
  const ZERO_Y = height * 0.65;

  return (
    <svg viewBox={`0 0 ${W} ${height + 24}`} style={{ width: "100%", display: "block" }}>
      <line x1="40" y1={ZERO_Y} x2={W - 10} y2={ZERO_Y} stroke="#E2E8F0" strokeWidth="1" />
      {data.map((d, i) => {
        const v = d[yKey] || 0;
        const barH = Math.max((Math.abs(v) / maxAbs) * (ZERO_Y * 0.92), v !== 0 ? 2 : 0);
        const y = v >= 0 ? ZERO_Y - barH : ZERO_Y;
        const x = 40 + i * BAR_TOPLAM + BAR_OFF;
        const secili = secilenIdx === i;
        const c = v >= 0 ? color : "#DC2626";
        return (
          <g key={i} style={{ cursor: onTikla ? "pointer" : "default" }} onClick={() => onTikla && onTikla(i, d)}>
            <rect x={x} y={y} width={BAR_G} height={barH}
              fill={c} opacity={secili ? 1 : 0.78} rx="2"
              stroke={secili ? "#1B2B5E" : "none"} strokeWidth="2" />
            {data.length <= 32 && (
              <text x={x + BAR_G / 2} y={height + 18} textAnchor="middle" fontSize={data.length > 20 ? "7" : "9"} fill="#64748B">
                {d._label || ""}
              </text>
            )}
          </g>
        );
      })}
      {yLabel && <text x="10" y="12" fontSize="8" fill="#94A3B8" transform="rotate(-90,10,12)">{yLabel}</text>}
    </svg>
  );
}

/* ===== SVG LINE CHART ===== */
function LineChart({ data, keys, colors, height = 160 }) {
  if (!data || data.length < 2) return null;
  const W = 700;
  const PAD = { l: 40, r: 10, t: 10, b: 10 };
  const allVals = keys.flatMap(k => data.map(d => d[k] || 0));
  const maxV = Math.max(...allVals, 0.01);
  const minV = Math.min(...allVals, 0);
  const range = maxV - minV || 0.01;
  const chartW = W - PAD.l - PAD.r;
  const chartH = height - PAD.t - PAD.b;

  function pt(i, val) {
    const x = PAD.l + (i / (data.length - 1)) * chartW;
    const y = PAD.t + ((maxV - val) / range) * chartH;
    return `${x},${y}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", display: "block" }}>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#E2E8F0" strokeWidth="1" />
      <line x1={PAD.l} y1={PAD.t + chartH} x2={W - PAD.r} y2={PAD.t + chartH} stroke="#E2E8F0" strokeWidth="1" />
      {minV < 0 && (
        <line x1={PAD.l} y1={PAD.t + (maxV / range) * chartH}
          x2={W - PAD.r} y2={PAD.t + (maxV / range) * chartH}
          stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="4,2" />
      )}
      {keys.map((k, ki) => (
        <polyline key={k}
          points={data.map((d, i) => pt(i, d[k] || 0)).join(" ")}
          fill="none" stroke={colors[ki]} strokeWidth="1.5" opacity={0.9} />
      ))}
    </svg>
  );
}

/* ===== AGREGASYON HESAPLA ===== */
function aylikVeriHesapla(hourly) {
  return AY_SINIRLAR.slice(0, 12).map((bas, ayIdx) => {
    const son = AY_SINIRLAR[ayIdx + 1];
    const saatler = hourly.filter(h => h.hourIndex >= bas && h.hourIndex < son);
    return {
      ay: ayIdx + 1,
      _label: AY_KISA[ayIdx],
      acKwh: saatler.reduce((s, h) => s + (h.acKw || 0), 0),
      dcKwh: saatler.reduce((s, h) => s + (h.dcKw || 0), 0),
      sarjKwh: saatler.reduce((s, h) => s + (h.chargeKw || 0), 0),
      desarjKwh: saatler.reduce((s, h) => s + (h.dischargeKw || 0), 0),
      klipingKwh: saatler.reduce((s, h) => s + (h.clippingKw || 0), 0),
      gelirTry: saatler.reduce((s, h) => s + (h.revenueTry || 0), 0),
      _saatSayisi: saatler.length
    };
  });
}

function gunlukVeriHesapla(hourly, ayIdx) {
  const ayBas = AY_SINIRLAR[ayIdx];
  const aySon = AY_SINIRLAR[ayIdx + 1];
  const ayHourly = hourly.filter(h => h.hourIndex >= ayBas && h.hourIndex < aySon);
  const gunSayisi = AY_GUNLER[ayIdx];
  return Array.from({ length: gunSayisi }, (_, gunNo) => {
    const gBas = ayBas + gunNo * 24;
    const gSon = gBas + 24;
    const saatler = ayHourly.filter(h => h.hourIndex >= gBas && h.hourIndex < gSon);
    return {
      gunNo,
      _label: String(gunNo + 1),
      acKwh: saatler.reduce((s, h) => s + (h.acKw || 0), 0),
      dcKwh: saatler.reduce((s, h) => s + (h.dcKw || 0), 0),
      sarjKwh: saatler.reduce((s, h) => s + (h.chargeKw || 0), 0),
      desarjKwh: saatler.reduce((s, h) => s + (h.dischargeKw || 0), 0),
      klipingKwh: saatler.reduce((s, h) => s + (h.clippingKw || 0), 0),
      gelirTry: saatler.reduce((s, h) => s + (h.revenueTry || 0), 0),
      socOrt: saatler.length > 0 ? saatler.reduce((s, h) => s + (h.socPct || 0), 0) / saatler.length : 0
    };
  });
}

function saatlikVeriHesapla(hourly, ayIdx, gunNo) {
  const gBas = AY_SINIRLAR[ayIdx] + gunNo * 24;
  return hourly.filter(h => h.hourIndex >= gBas && h.hourIndex < gBas + 24).map(h => ({
    ...h,
    _label: String(h.hourIndex % 24).padStart(2, "0") + ":00"
  }));
}

/* ===== KPI TABLOSU ===== */
function KpiTablosu({ kpis }) {
  if (!kpis) return null;
  const satirlar = [
    { etiket: "Baslangic Yatirimi", deger: fmt(kpis.initialInvestmentTry, "₺"), renk2: "var(--secondary)" },
    { etiket: "Yillik Gelir (Brut)", deger: fmt(kpis.annualRevenueTry, "₺"), renk2: "var(--success)" },
    { etiket: "Yillik Bakim Maliyeti", deger: fmt(kpis.annualMaintenanceTry, "₺"), renk2: "var(--danger)" },
    { etiket: "Yillik Net Gelir", deger: fmt(kpis.annualNetRevenueTry, "₺"), renk2: kpis.annualNetRevenueTry >= 0 ? "var(--success)" : "var(--danger)" },
    { etiket: "Net Bugunku Deger (NPV)", deger: fmt(kpis.npvTry, "₺"), renk2: kpis.npvTry >= 0 ? "var(--success)" : "var(--danger)" },
    { etiket: "Ic Getiri Orani (IRR)", deger: kpis.irrPct !== null ? `%${kpis.irrPct}` : "-", renk2: "var(--primary)" },
    { etiket: "LCOE", deger: fmt(kpis.lcoeTryMwh, "₺/MWh"), renk2: "var(--text)" },
    { etiket: "Geri Odeme Suresi", deger: kpis.paybackYears ? `${kpis.paybackYears} yil` : "Geri odenmiyor", renk2: "var(--text)" },
    { etiket: "Toplam Desarj", deger: fmt(kpis.totalDischargeMwh, "MWh", 1), renk2: "var(--text)" },
    { etiket: "Round-Trip Verimlilik", deger: kpis.roundTripEfficiencyPct ? `%${kpis.roundTripEfficiencyPct}` : "-", renk2: "var(--text)" }
  ];
  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { etiket: "NPV", deger: fmt(kpis.npvTry, "₺"), vurgulu: true },
          { etiket: "IRR", deger: kpis.irrPct !== null ? `%${kpis.irrPct}` : "-" },
          { etiket: "Geri Odeme", deger: kpis.paybackYears ? `${kpis.paybackYears} yil` : "-" },
          { etiket: "Yillik Net Gelir", deger: fmt(kpis.annualNetRevenueTry, "₺") }
        ].map(k => (
          <div key={k.etiket} className={`kpi-kart ${k.vurgulu ? "vurgulu" : ""}`}>
            <div className="kpi-etiket">{k.etiket}</div>
            <div className="kpi-deger">{k.deger}</div>
          </div>
        ))}
      </div>
      <div className="tablo-kap">
        <table className="tablo">
          <thead><tr><th>Gosterge</th><th>Deger</th></tr></thead>
          <tbody>
            {satirlar.map(s => (
              <tr key={s.etiket}>
                <td>{s.etiket}</td>
                <td style={{ fontWeight: 700, color: s.renk2 }}>{s.deger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== AYLIK DETAY TABLO ===== */
function DetayTablo({ veri, kolonlar, onTikla }) {
  return (
    <div className="tablo-kap" style={{ marginTop: 16 }}>
      <table className="tablo">
        <thead>
          <tr>
            {kolonlar.map(k => <th key={k.key}>{k.baslik}</th>)}
            {onTikla && <th>Detay</th>}
          </tr>
        </thead>
        <tbody>
          {veri.map((satir, i) => (
            <tr key={i} style={{ cursor: onTikla ? "pointer" : "default" }}
              onClick={() => onTikla && onTikla(i, satir)}>
              {kolonlar.map(k => (
                <td key={k.key} style={k.renkFn ? { fontWeight: 700, color: k.renkFn(satir[k.key]) } : {}}>
                  {k.fmt ? k.fmt(satir[k.key]) : satir[k.key]}
                </td>
              ))}
              {onTikla && <td style={{ color: "var(--primary)", fontSize: "0.8rem", fontWeight: 600 }}>Detay &rsaquo;</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===== EFSANE ===== */
function Efsane({ renkler }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.78rem", marginBottom: 8 }}>
      {renkler.map(e => (
        <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 12, background: e.renk, borderRadius: 2, display: "inline-block" }} />
          {e.label}
        </div>
      ))}
    </div>
  );
}

/* ===== ANA SAYFA ===== */
function SonuclarSayfasi() {
  const navigate = useNavigate();
  const { simulasyonSonucu, secilenBatarya, stratejiKonfig } = useAppWorkspace();

  const [aktifSekme, setAktifSekme] = useState("uretim");
  const [secilenAy, setSecilenAy] = useState(null);   // 0-11
  const [secilenGun, setSecilenGun] = useState(null);  // 0-30

  if (!simulasyonSonucu) {
    return (
      <div>
        <div className="sayfa-baslik"><h2>5 — Sonuclar</h2><p>Henuz simulasyon sonucu yok.</p></div>
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

  const { summary, hourly = [] } = simulasyonSonucu;
  const { kpis, meta } = summary;

  const STRATEJI_ADI = { arbitraj: "Arbitraj", peak_shaving: "Peak Shaving", price_threshold: "Fiyat Esigi" };

  // Hesaplanan veri serileri
  const aylikVeri = useMemo(() => aylikVeriHesapla(hourly), [hourly]);
  const gunlukVeri = useMemo(() => secilenAy !== null ? gunlukVeriHesapla(hourly, secilenAy) : [], [hourly, secilenAy]);
  const saatlikVeri = useMemo(() => (secilenAy !== null && secilenGun !== null) ? saatlikVeriHesapla(hourly, secilenAy, secilenGun) : [], [hourly, secilenAy, secilenGun]);

  // Breadcrumb seviyesi
  const seviye = secilenGun !== null ? "saat" : secilenAy !== null ? "gun" : "ay";

  const geriDon = () => {
    if (secilenGun !== null) setSecilenGun(null);
    else if (secilenAy !== null) setSecilenAy(null);
  };

  return (
    <div>
      <div className="sayfa-baslik" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>5 — Simulasyon Sonuclari</h2>
          <p>{secilenBatarya?.model} &bull; {STRATEJI_ADI[stratejiKonfig?.strategyType] || meta?.strategy} &bull; {meta?.totalHours || 8760} saat</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-outline btn-kucuk" onClick={() => navigate("/app/simulasyon")}>Yeniden Calistir</button>
          <button type="button" className="btn btn-ghost btn-kucuk" onClick={() => window.print()}>PDF</button>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="tab-bar" style={{ marginBottom: 0 }}>
        {[
          { key: "finansal", label: "Finansal Analiz" },
          { key: "uretim", label: "Uretim & Batarya Analizi" },
          { key: "saatlik", label: "Saatlik Grafik" }
        ].map(s => (
          <button key={s.key} type="button"
            className={`tab-btn ${aktifSekme === s.key ? "aktif" : ""}`}
            onClick={() => { setAktifSekme(s.key); setSecilenAy(null); setSecilenGun(null); }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>

        {/* ===== FİNANSAL ===== */}
        {aktifSekme === "finansal" && (
          <div className="card">
            <div className="card-baslik">Finansal Gostergeler</div>
            <KpiTablosu kpis={kpis} />
          </div>
        )}

        {/* ===== ÜRETİM & BATARYA ANALİZİ ===== */}
        {aktifSekme === "uretim" && (
          <div style={{ display: "grid", gap: 16 }}>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
              <button type="button"
                style={{ border: "none", background: "none", cursor: seviye === "ay" ? "default" : "pointer",
                  color: seviye === "ay" ? "var(--text-muted)" : "var(--primary)", fontWeight: 600, padding: 0 }}
                onClick={() => { setSecilenAy(null); setSecilenGun(null); }}>
                Yillik Ozet
              </button>
              {secilenAy !== null && (
                <>
                  <span style={{ color: "var(--text-muted)" }}>/</span>
                  <button type="button"
                    style={{ border: "none", background: "none", cursor: secilenGun !== null ? "pointer" : "default",
                      color: secilenGun !== null ? "var(--primary)" : "var(--text-muted)", fontWeight: 600, padding: 0 }}
                    onClick={() => setSecilenGun(null)}>
                    {AY_ADLARI[secilenAy]}
                  </button>
                </>
              )}
              {secilenGun !== null && (
                <>
                  <span style={{ color: "var(--text-muted)" }}>/</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                    {secilenGun + 1}. Gun
                  </span>
                </>
              )}
              {seviye !== "ay" && (
                <button type="button" className="btn btn-ghost btn-kucuk" style={{ marginLeft: 8 }} onClick={geriDon}>
                  Geri
                </button>
              )}
            </div>

            {/* ===== YILLIK SEVIYE ===== */}
            {seviye === "ay" && (
              <>
                {/* Ozet KPI satiri */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { etiket: "Yillik Uretim (E_Grid)", deger: fmt(aylikVeri.reduce((s, a) => s + a.acKwh, 0) / 1000, "MWh", 1) },
                    { etiket: "Yillik Sarj", deger: fmt(aylikVeri.reduce((s, a) => s + a.sarjKwh, 0) / 1000, "MWh", 1) },
                    { etiket: "Yillik Desarj", deger: fmt(aylikVeri.reduce((s, a) => s + a.desarjKwh, 0) / 1000, "MWh", 1) },
                    { etiket: "Yillik Net Gelir", deger: fmt(aylikVeri.reduce((s, a) => s + a.gelirTry, 0), "₺") }
                  ].map(k => (
                    <div key={k.etiket} className="kpi-kart">
                      <div className="kpi-etiket">{k.etiket}</div>
                      <div className="kpi-deger" style={{ fontSize: "1.1rem" }}>{k.deger}</div>
                    </div>
                  ))}
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">Aylik E_Grid Uretimi (kWh) — Ay'a tikla detaya git</div>
                  <Efsane renkler={[{ label: "E_Grid (kWh)", renk: "#1B2B5E" }]} />
                  <BarChart data={aylikVeri} yKey="acKwh" color="#1B2B5E" height={160}
                    onTikla={(i) => { setSecilenAy(i); setSecilenGun(null); }}
                    secilenIdx={secilenAy} />
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">Aylik Batarya Geliri (₺) — Ay'a tikla detaya git</div>
                  <Efsane renkler={[{ label: "Gelir (₺)", renk: "#E8500A" }, { label: "Zarar", renk: "#DC2626" }]} />
                  <BarChart data={aylikVeri} yKey="gelirTry" color="#E8500A" height={160}
                    onTikla={(i) => { setSecilenAy(i); setSecilenGun(null); }}
                    secilenIdx={secilenAy} />
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">Aylik Sarj / Desarj (kWh)</div>
                  <Efsane renkler={[{ label: "Sarj (kWh)", renk: "#16A34A" }, { label: "Desarj (kWh)", renk: "#E8500A" }]} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <BarChart data={aylikVeri} yKey="sarjKwh" color="#16A34A" height={140}
                      onTikla={(i) => { setSecilenAy(i); setSecilenGun(null); }} secilenIdx={secilenAy} />
                    <BarChart data={aylikVeri} yKey="desarjKwh" color="#E8500A" height={140}
                      onTikla={(i) => { setSecilenAy(i); setSecilenGun(null); }} secilenIdx={secilenAy} />
                  </div>
                </div>

                <DetayTablo
                  veri={aylikVeri}
                  onTikla={(i) => { setSecilenAy(i); setSecilenGun(null); }}
                  kolonlar={[
                    { key: "ay", baslik: "Ay", fmt: v => AY_ADLARI[(v - 1) % 12] },
                    { key: "acKwh", baslik: "E_Grid (kWh)", fmt: v => fmt(v, "", 0) },
                    { key: "sarjKwh", baslik: "Sarj (kWh)", fmt: v => fmt(v, "", 0) },
                    { key: "desarjKwh", baslik: "Desarj (kWh)", fmt: v => fmt(v, "", 0) },
                    { key: "klipingKwh", baslik: "Kliping (kWh)", fmt: v => fmt(v, "", 0) },
                    { key: "gelirTry", baslik: "Gelir (₺)", fmt: v => fmt(v, "₺"), renkFn: v => renk(v) }
                  ]}
                />
              </>
            )}

            {/* ===== AYLIK SEVIYE (gunluk) ===== */}
            {seviye === "gun" && secilenAy !== null && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { etiket: "Aylik Uretim", deger: fmt(gunlukVeri.reduce((s, g) => s + g.acKwh, 0) / 1000, "MWh", 2) },
                    { etiket: "Aylik Sarj", deger: fmt(gunlukVeri.reduce((s, g) => s + g.sarjKwh, 0), "kWh", 0) },
                    { etiket: "Aylik Desarj", deger: fmt(gunlukVeri.reduce((s, g) => s + g.desarjKwh, 0), "kWh", 0) },
                    { etiket: "Aylik Gelir", deger: fmt(gunlukVeri.reduce((s, g) => s + g.gelirTry, 0), "₺") }
                  ].map(k => (
                    <div key={k.etiket} className="kpi-kart">
                      <div className="kpi-etiket">{k.etiket}</div>
                      <div className="kpi-deger" style={{ fontSize: "1.1rem" }}>{k.deger}</div>
                    </div>
                  ))}
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">{AY_ADLARI[secilenAy]} — Gunluk E_Grid Uretimi (kWh) — Gun'e tikla saatlik goster</div>
                  <Efsane renkler={[{ label: "E_Grid (kWh)", renk: "#1B2B5E" }]} />
                  <BarChart data={gunlukVeri} yKey="acKwh" color="#1B2B5E" height={160}
                    onTikla={(i) => setSecilenGun(i)} secilenIdx={secilenGun} />
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">{AY_ADLARI[secilenAy]} — Gunluk Batarya Geliri (₺)</div>
                  <Efsane renkler={[{ label: "Gelir (₺)", renk: "#E8500A" }, { label: "Zarar", renk: "#DC2626" }]} />
                  <BarChart data={gunlukVeri} yKey="gelirTry" color="#E8500A" height={140}
                    onTikla={(i) => setSecilenGun(i)} secilenIdx={secilenGun} />
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">{AY_ADLARI[secilenAy]} — Gunluk Sarj / Desarj (kWh)</div>
                  <Efsane renkler={[{ label: "Sarj (kWh)", renk: "#16A34A" }, { label: "Desarj (kWh)", renk: "#E8500A" }]} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <BarChart data={gunlukVeri} yKey="sarjKwh" color="#16A34A" height={130}
                      onTikla={(i) => setSecilenGun(i)} secilenIdx={secilenGun} />
                    <BarChart data={gunlukVeri} yKey="desarjKwh" color="#E8500A" height={130}
                      onTikla={(i) => setSecilenGun(i)} secilenIdx={secilenGun} />
                  </div>
                </div>

                <DetayTablo
                  veri={gunlukVeri}
                  onTikla={(i) => setSecilenGun(i)}
                  kolonlar={[
                    { key: "gunNo", baslik: "Gun", fmt: v => `${AY_KISA[secilenAy]} ${v + 1}` },
                    { key: "acKwh", baslik: "E_Grid (kWh)", fmt: v => fmt(v, "", 1) },
                    { key: "sarjKwh", baslik: "Sarj (kWh)", fmt: v => fmt(v, "", 1) },
                    { key: "desarjKwh", baslik: "Desarj (kWh)", fmt: v => fmt(v, "", 1) },
                    { key: "klipingKwh", baslik: "Kliping (kWh)", fmt: v => fmt(v, "", 1) },
                    { key: "gelirTry", baslik: "Gelir (₺)", fmt: v => fmt(v, "₺", 2), renkFn: v => renk(v) },
                    { key: "socOrt", baslik: "Ort. SOC (%)", fmt: v => fmt(v, "%", 1) }
                  ]}
                />
              </>
            )}

            {/* ===== SAATLİK SEVIYE ===== */}
            {seviye === "saat" && secilenAy !== null && secilenGun !== null && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { etiket: "Gunluk Uretim", deger: fmt(saatlikVeri.reduce((s, h) => s + (h.acKw || 0), 0), "kWh", 1) },
                    { etiket: "Gunluk Sarj", deger: fmt(saatlikVeri.reduce((s, h) => s + (h.chargeKw || 0), 0), "kWh", 1) },
                    { etiket: "Gunluk Desarj", deger: fmt(saatlikVeri.reduce((s, h) => s + (h.dischargeKw || 0), 0), "kWh", 1) },
                    { etiket: "Gunluk Gelir", deger: fmt(saatlikVeri.reduce((s, h) => s + (h.revenueTry || 0), 0), "₺", 2) }
                  ].map(k => (
                    <div key={k.etiket} className="kpi-kart">
                      <div className="kpi-etiket">{k.etiket}</div>
                      <div className="kpi-deger" style={{ fontSize: "1.1rem" }}>{k.deger}</div>
                    </div>
                  ))}
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">{AY_ADLARI[secilenAy]} {secilenGun + 1}. Gun — Saatlik E_Grid Uretimi (kW)</div>
                  <Efsane renkler={[{ label: "E_Grid (kW)", renk: "#1B2B5E" }, { label: "Kliping (kW)", renk: "#D97706" }]} />
                  <BarChart data={saatlikVeri.map(h => ({ ...h, acKw: h.acKw || 0 }))}
                    yKey="acKw" color="#1B2B5E" height={140} />
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">{AY_ADLARI[secilenAy]} {secilenGun + 1}. Gun — SOC & Sarj/Desarj</div>
                  <Efsane renkler={[
                    { label: "SOC (%)", renk: "#7C3AED" },
                    { label: "Sarj (kW)", renk: "#16A34A" },
                    { label: "Desarj (kW)", renk: "#E8500A" }
                  ]} />
                  <LineChart data={saatlikVeri} keys={["socPct", "chargeKw", "dischargeKw"]}
                    colors={["#7C3AED", "#16A34A", "#E8500A"]} height={180} />
                </div>

                <div className="grafik-kutu">
                  <div className="grafik-baslik">{AY_ADLARI[secilenAy]} {secilenGun + 1}. Gun — EPIAS Fiyati (₺/MWh)</div>
                  <Efsane renkler={[{ label: "EPIAS Fiyati", renk: "#D97706" }]} />
                  <LineChart data={saatlikVeri} keys={["priceTryMwh"]} colors={["#D97706"]} height={140} />
                </div>

                <div className="tablo-kap">
                  <table className="tablo">
                    <thead>
                      <tr>
                        <th>Saat</th>
                        <th>E_Grid (kW)</th>
                        <th>Kliping (kW)</th>
                        <th>Sarj (kW)</th>
                        <th>Desarj (kW)</th>
                        <th>SOC (%)</th>
                        <th>Fiyat (₺/MWh)</th>
                        <th>Gelir (₺)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saatlikVeri.map((h, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{h._label}</td>
                          <td>{fmt(h.acKw, "", 2)}</td>
                          <td style={{ color: (h.clippingKw || 0) > 0 ? "#D97706" : undefined }}>{fmt(h.clippingKw, "", 2)}</td>
                          <td style={{ color: (h.chargeKw || 0) > 0 ? "#16A34A" : undefined }}>{fmt(h.chargeKw, "", 2)}</td>
                          <td style={{ color: (h.dischargeKw || 0) > 0 ? "#E8500A" : undefined }}>{fmt(h.dischargeKw, "", 2)}</td>
                          <td>{fmt(h.socPct, "%", 1)}</td>
                          <td>{fmt(h.priceTryMwh, "", 0)}</td>
                          <td style={{ fontWeight: 700, color: renk(h.revenueTry) }}>{fmt(h.revenueTry, "₺", 2)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                        <td>TOPLAM</td>
                        <td>{fmt(saatlikVeri.reduce((s, h) => s + (h.acKw || 0), 0), "kWh", 1)}</td>
                        <td>{fmt(saatlikVeri.reduce((s, h) => s + (h.clippingKw || 0), 0), "kWh", 1)}</td>
                        <td>{fmt(saatlikVeri.reduce((s, h) => s + (h.chargeKw || 0), 0), "kWh", 1)}</td>
                        <td>{fmt(saatlikVeri.reduce((s, h) => s + (h.dischargeKw || 0), 0), "kWh", 1)}</td>
                        <td>-</td>
                        <td>-</td>
                        <td style={{ color: renk(saatlikVeri.reduce((s, h) => s + (h.revenueTry || 0), 0)) }}>
                          {fmt(saatlikVeri.reduce((s, h) => s + (h.revenueTry || 0), 0), "₺", 2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== SAATLİK GRAFİK SEKME ===== */}
        {aktifSekme === "saatlik" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="alert alert-info">
              Ilk 168 saat (7 gun) gosteriliyor. Detayli gunluk analiz icin "Uretim & Batarya Analizi" sekmesini kullanin.
            </div>
            <div className="grafik-kutu">
              <div className="grafik-baslik">SOC (%) — Ilk 168 Saat</div>
              <LineChart data={hourly.slice(0, 168)} keys={["socPct"]} colors={["#7C3AED"]} height={160} />
            </div>
            <div className="grafik-kutu">
              <div className="grafik-baslik">E_Grid & Sarj/Desarj (kW) — Ilk 168 Saat</div>
              <Efsane renkler={[{ label: "E_Grid", renk: "#1B2B5E" }, { label: "Sarj", renk: "#16A34A" }, { label: "Desarj", renk: "#E8500A" }]} />
              <LineChart data={hourly.slice(0, 168)} keys={["acKw", "chargeKw", "dischargeKw"]}
                colors={["#1B2B5E", "#16A34A", "#E8500A"]} height={180} />
            </div>
            <div className="grafik-kutu">
              <div className="grafik-baslik">EPIAS Fiyati (₺/MWh) — Ilk 168 Saat</div>
              <LineChart data={hourly.slice(0, 168)} keys={["priceTryMwh"]} colors={["#D97706"]} height={140} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default SonuclarSayfasi;
