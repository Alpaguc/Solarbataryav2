import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const PANEL_TEKNOLOJILERI = ["Monokristal Si (PERC)", "Monokristal Si (TOPCon)", "Polikristal Si", "HJT", "CdTe (İnce Film)", "CIGS", "Bifacial PERC", "Bifacial TOPCon"];
const BAGLANTI_GERILIMLERI = ["0.4 kV (AG)", "10 kV (OG)", "33 kV (OG)", "154 kV (YG)", "380 kV (YG)"];
const BAGLANTI_TIPLERI = ["Radyal", "Halka", "Çift Besleme", "Paralel"];
const ARAZI_TIPLERI = ["Tarım Arazisi (Hazine)", "Tarım Arazisi (Özel)", "Mera", "Orman İzinli", "Sanayi Arazisi", "Çatı / Sera GES", "Kapalı Alan", "Diğer"];

function FormBolum({ baslik, ikon, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
        paddingBottom: 10, borderBottom: "2px solid var(--primary-light)"
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: "var(--primary-light)", color: "var(--primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem", fontWeight: 700, flexShrink: 0
        }}>{ikon}</span>
        <span style={{ fontWeight: 700, color: "var(--secondary)", fontSize: "0.9rem" }}>{baslik}</span>
      </div>
      {children}
    </div>
  );
}

function Alan({ label, zorunlu, children, ipucu }) {
  return (
    <div className="form-grup" style={{ marginBottom: 12 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-soft)", marginBottom: 4, display: "block" }}>
        {label} {zorunlu && <span style={{ color: "var(--primary)" }}>*</span>}
      </label>
      {children}
      {ipucu && <small style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginTop: 3, display: "block" }}>{ipucu}</small>}
    </div>
  );
}

function YeniProjeModal({ onKapat, onOlustur, yukleniyor }) {
  const [aktifAdim, setAktifAdim] = useState(0);
  const [form, setForm] = useState({
    // Temel
    projectName: "",
    location: "",
    koordinatLat: "",
    koordinatLon: "",
    firma: "",
    isletmeYili: new Date().getFullYear(),
    // GES
    installedPowerKw: "",
    acInverterGucuKw: "",
    panelSayisi: "",
    panelTekn: "Monokristal Si (PERC)",
    panelGucuWp: "700",
    inverterSayisi: "",
    yillikUretimTahminiMwh: "",
    performansOrani: "80",
    // Baglanти
    baglantiGerilimi: "154 kV (YG)",
    baglantiTipi: "Radyal",
    sebekeBaglantiKapasitesiKw: "",
    dagitimSirketi: "",
    // Alan
    araziTipi: "Tarım Arazisi (Hazine)",
    araziAlanHektar: "",
    // Aciklama
    description: ""
  });
  const [hata, setHata] = useState("");

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setHata(""); };

  const ADIMLAR = [
    { label: "Temel Bilgiler", ikon: "1" },
    { label: "GES Teknik", ikon: "2" },
    { label: "Bağlantı & Alan", ikon: "3" }
  ];

  function validateAdim(adim) {
    if (adim === 0) {
      if (!form.projectName.trim() || form.projectName.trim().length < 2) { setHata("Proje adı en az 2 karakter olmalıdır."); return false; }
      if (!form.location.trim() || form.location.trim().length < 2) { setHata("Lokasyon bilgisi gereklidir."); return false; }
    }
    if (adim === 1) {
      if (!form.installedPowerKw || Number(form.installedPowerKw) <= 0) { setHata("Kurulu DC güç zorunludur."); return false; }
      if (!form.acInverterGucuKw || Number(form.acInverterGucuKw) <= 0) { setHata("AC inverter gücü zorunludur."); return false; }
    }
    return true;
  }

  function handleIleri() {
    if (!validateAdim(aktifAdim)) return;
    setAktifAdim(p => p + 1);
    setHata("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateAdim(aktifAdim)) return;
    const payload = {
      projectName: form.projectName.trim(),
      location: form.location.trim(),
      installedPowerKw: form.installedPowerKw ? Number(form.installedPowerKw) : null,
      description: [
        form.firma && `Firma: ${form.firma}`,
        form.isletmeYili && `İşletme Yılı: ${form.isletmeYili}`,
        form.acInverterGucuKw && `AC Güç: ${form.acInverterGucuKw} kW`,
        form.panelSayisi && `Panel Sayısı: ${form.panelSayisi} adet`,
        form.panelTekn && `Panel: ${form.panelTekn}`,
        form.panelGucuWp && `Panel Gücü: ${form.panelGucuWp} Wp`,
        form.yillikUretimTahminiMwh && `Yıllık Üretim: ${form.yillikUretimTahminiMwh} MWh`,
        form.performansOrani && `PR: %${form.performansOrani}`,
        form.baglantiGerilimi && `Gerilim: ${form.baglantiGerilimi}`,
        form.sebekeBaglantiKapasitesiKw && `Şebeke Kapasitesi: ${form.sebekeBaglantiKapasitesiKw} kW`,
        form.araziTipi && `Arazi: ${form.araziTipi}`,
        form.araziAlanHektar && `Alan: ${form.araziAlanHektar} ha`,
        form.koordinatLat && form.koordinatLon && `Koord: ${form.koordinatLat}, ${form.koordinatLon}`,
        form.description && form.description.trim()
      ].filter(Boolean).join(" | ") || null
    };
    try { await onOlustur(payload); } catch (err) { setHata(err?.message || "Proje oluşturulamadı."); }
  }

  const dcKw = Number(form.installedPowerKw) || 0;
  const acKw = Number(form.acInverterGucuKw) || 0;
  const ozeloran = dcKw && acKw ? (dcKw / acKw).toFixed(2) : null;

  return (
    <div className="modal-arkaplan" onClick={onKapat}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          boxShadow: "0 24px 64px rgba(27,43,94,0.22)",
          width: "100%",
          maxWidth: 780,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, var(--secondary) 0%, #2D3F7A 100%)",
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, var(--primary), #fc4a1a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem"
            }}>☀️</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.15rem" }}>Yeni GES Projesi Oluştur</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>
                Güneş Enerji Santrali + Batarya Depolama Sistemi
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onKapat}
            style={{
              background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
              width: 34, height: 34, borderRadius: 8, cursor: "pointer",
              fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >✕</button>
        </div>

        {/* Adım Göstergesi */}
        <div style={{
          display: "flex", borderBottom: "1px solid var(--border)",
          background: "var(--bg)", flexShrink: 0
        }}>
          {ADIMLAR.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { if (i < aktifAdim || validateAdim(aktifAdim)) { setHata(""); setAktifAdim(i); } }}
              style={{
                flex: 1, padding: "14px 8px", border: "none",
                background: "transparent", cursor: "pointer",
                borderBottom: `3px solid ${i === aktifAdim ? "var(--primary)" : i < aktifAdim ? "var(--success)" : "transparent"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: i === aktifAdim ? "var(--primary)" : i < aktifAdim ? "var(--success)" : "var(--border)",
                color: i <= aktifAdim ? "#fff" : "var(--text-muted)",
                fontSize: "0.8rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>{i < aktifAdim ? "✓" : i + 1}</span>
              <span style={{
                fontSize: "0.75rem", fontWeight: 600,
                color: i === aktifAdim ? "var(--primary)" : i < aktifAdim ? "var(--success)" : "var(--text-muted)"
              }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Form İçeriği */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

            {/* Adım 0 — Temel Bilgiler */}
            {aktifAdim === 0 && (
              <>
                <FormBolum baslik="Proje Kimliği" ikon="📋">
                  <div className="form-grid-2">
                    <Alan label="Proje Adı" zorunlu>
                      <input
                        value={form.projectName}
                        onChange={e => set("projectName", e.target.value)}
                        placeholder="Örn: Aydın GES Depolama Projesi"
                        autoFocus
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="Firma / İşletmeci">
                      <input
                        value={form.firma}
                        onChange={e => set("firma", e.target.value)}
                        placeholder="Firma adı"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                  <div className="form-grid-2">
                    <Alan label="Lokasyon (İl / İlçe)" zorunlu>
                      <input
                        value={form.location}
                        onChange={e => set("location", e.target.value)}
                        placeholder="Örn: Aydın / Söke"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="İşletmeye Alma Yılı">
                      <input
                        type="number"
                        min="2015"
                        max="2040"
                        value={form.isletmeYili}
                        onChange={e => set("isletmeYili", e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                </FormBolum>

                <FormBolum baslik="Coğrafi Konum (Opsiyonel)" ikon="📍">
                  <div className="form-grid-2">
                    <Alan label="Enlem (°N)" ipucu="Örn: 37.8542">
                      <input
                        type="number"
                        step="0.0001"
                        min="36"
                        max="42"
                        value={form.koordinatLat}
                        onChange={e => set("koordinatLat", e.target.value)}
                        placeholder="37.8542"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="Boylam (°E)" ipucu="Örn: 27.8456">
                      <input
                        type="number"
                        step="0.0001"
                        min="26"
                        max="45"
                        value={form.koordinatLon}
                        onChange={e => set("koordinatLon", e.target.value)}
                        placeholder="27.8456"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                </FormBolum>

                <FormBolum baslik="Notlar" ikon="📝">
                  <Alan label="Proje Hakkında Kısa Açıklama">
                    <textarea
                      value={form.description}
                      onChange={e => set("description", e.target.value)}
                      placeholder="Proje hakkında ek bilgi..."
                      rows={3}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical" }}
                    />
                  </Alan>
                </FormBolum>
              </>
            )}

            {/* Adım 1 — GES Teknik */}
            {aktifAdim === 1 && (
              <>
                <FormBolum baslik="Güç Parametreleri" ikon="⚡">
                  <div className="form-grid-2">
                    <Alan label="Kurulu DC Güç (kWp)" zorunlu ipucu="Toplam panel DC gücü">
                      <input
                        type="number" min="1" step="0.1"
                        value={form.installedPowerKw}
                        onChange={e => set("installedPowerKw", e.target.value)}
                        placeholder="Örn: 10000"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="AC İnverter Gücü (kW)" zorunlu ipucu="Toplam inverter AC çıkış gücü">
                      <input
                        type="number" min="1" step="0.1"
                        value={form.acInverterGucuKw}
                        onChange={e => set("acInverterGucuKw", e.target.value)}
                        placeholder="Örn: 8000"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>

                  {ozeloran && (
                    <div style={{
                      background: Number(ozeloran) > 1.1 ? "var(--primary-light)" : "var(--bg)",
                      border: `1px solid ${Number(ozeloran) > 1.1 ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                      display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem"
                    }}>
                      <span style={{ fontSize: "1.1rem" }}>{Number(ozeloran) > 1.1 ? "🎯" : "ℹ️"}</span>
                      <div>
                        <strong>DC/AC Oranı: {ozeloran}</strong>
                        {Number(ozeloran) > 1.1 &&
                          <span style={{ color: "var(--primary)", marginLeft: 8 }}>
                            Clipping oluşacak → batarya depolaması için uygun!
                          </span>
                        }
                      </div>
                    </div>
                  )}
                </FormBolum>

                <FormBolum baslik="Panel Bilgileri" ikon="☀️">
                  <div className="form-grid-2">
                    <Alan label="Panel Teknolojisi">
                      <select
                        value={form.panelTekn}
                        onChange={e => set("panelTekn", e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit", background: "#fff" }}
                      >
                        {PANEL_TEKNOLOJILERI.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Alan>
                    <Alan label="Panel Gücü (Wp)" ipucu="Tek panel nominal gücü">
                      <input
                        type="number" min="100" max="800" step="5"
                        value={form.panelGucuWp}
                        onChange={e => set("panelGucuWp", e.target.value)}
                        placeholder="700"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan
                      label="Panel Sayısı (adet)"
                      ipucu={form.installedPowerKw && form.panelGucuWp
                        ? `Hesaplanan: ~${Math.round(Number(form.installedPowerKw) * 1000 / Number(form.panelGucuWp))} adet`
                        : undefined}
                    >
                      <input
                        type="number" min="1"
                        value={form.panelSayisi}
                        onChange={e => set("panelSayisi", e.target.value)}
                        placeholder={form.installedPowerKw && form.panelGucuWp
                          ? String(Math.round(Number(form.installedPowerKw) * 1000 / Number(form.panelGucuWp)))
                          : "Adet"}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="İnverter Sayısı">
                      <input
                        type="number" min="1"
                        value={form.inverterSayisi}
                        onChange={e => set("inverterSayisi", e.target.value)}
                        placeholder="Adet"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                </FormBolum>

                <FormBolum baslik="Üretim Tahminleri" ikon="📊">
                  <div className="form-grid-2">
                    <Alan label="Tahmini Yıllık Üretim (MWh)" ipucu="PVSyst veya benzeri simülasyon çıktısı">
                      <input
                        type="number" min="1"
                        value={form.yillikUretimTahminiMwh}
                        onChange={e => set("yillikUretimTahminiMwh", e.target.value)}
                        placeholder="Örn: 16000"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="Performans Oranı - PR (%)" ipucu="Tipik değer: %75-85">
                      <input
                        type="number" min="50" max="100" step="0.1"
                        value={form.performansOrani}
                        onChange={e => set("performansOrani", e.target.value)}
                        placeholder="80"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                </FormBolum>
              </>
            )}

            {/* Adım 2 — Bağlantı & Alan */}
            {aktifAdim === 2 && (
              <>
                <FormBolum baslik="Şebeke Bağlantısı" ikon="🔌">
                  <div className="form-grid-2">
                    <Alan label="Bağlantı Gerilimi">
                      <select
                        value={form.baglantiGerilimi}
                        onChange={e => set("baglantiGerilimi", e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit", background: "#fff" }}
                      >
                        {BAGLANTI_GERILIMLERI.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </Alan>
                    <Alan label="Bağlantı Tipi">
                      <select
                        value={form.baglantiTipi}
                        onChange={e => set("baglantiTipi", e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit", background: "#fff" }}
                      >
                        {BAGLANTI_TIPLERI.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Alan>
                    <Alan label="Şebeke Bağlantı Kapasitesi (kW)" ipucu="Bağlantı noktasındaki maksimum kapasite (Lisans/ön lisans kapasitesi)">
                      <input
                        type="number" min="1"
                        value={form.sebekeBaglantiKapasitesiKw}
                        onChange={e => set("sebekeBaglantiKapasitesiKw", e.target.value)}
                        placeholder={form.acInverterGucuKw || "Örn: 8000"}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                    <Alan label="Dağıtım / İletim Şirketi">
                      <input
                        value={form.dagitimSirketi}
                        onChange={e => set("dagitimSirketi", e.target.value)}
                        placeholder="Örn: AYEDAŞ, BEDAŞ, TEİAŞ..."
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                </FormBolum>

                <FormBolum baslik="Arazi Bilgileri" ikon="🌱">
                  <div className="form-grid-2">
                    <Alan label="Arazi Tipi">
                      <select
                        value={form.araziTipi}
                        onChange={e => set("araziTipi", e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit", background: "#fff" }}
                      >
                        {ARAZI_TIPLERI.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Alan>
                    <Alan label="Arazi Alanı (Hektar)" ipucu={dcKw ? `Tahmini: ~${(dcKw / 1000 * 1.5).toFixed(1)} ha (1 MW ≈ 1.5 ha)` : undefined}>
                      <input
                        type="number" min="0.1" step="0.1"
                        value={form.araziAlanHektar}
                        onChange={e => set("araziAlanHektar", e.target.value)}
                        placeholder="Hektar"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: "0.9rem", fontFamily: "inherit" }}
                      />
                    </Alan>
                  </div>
                </FormBolum>

                {/* Özet Kutusu */}
                {(form.installedPowerKw || form.acInverterGucuKw) && (
                  <div style={{
                    background: "linear-gradient(135deg, var(--secondary) 0%, #2D3F7A 100%)",
                    borderRadius: 12, padding: "18px 20px", color: "#fff"
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
                      PROJE ÖZETİ
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                      {[
                        { etiket: "DC Güç", deger: form.installedPowerKw ? `${Number(form.installedPowerKw).toLocaleString("tr-TR")} kWp` : "-" },
                        { etiket: "AC Güç", deger: form.acInverterGucuKw ? `${Number(form.acInverterGucuKw).toLocaleString("tr-TR")} kW` : "-" },
                        { etiket: "DC/AC Oran", deger: ozeloran || "-" },
                        { etiket: "Yıllık Üretim", deger: form.yillikUretimTahminiMwh ? `${form.yillikUretimTahminiMwh} MWh` : "-" },
                        { etiket: "Bağlantı", deger: form.baglantiGerilimi },
                        { etiket: "Arazi", deger: form.araziAlanHektar ? `${form.araziAlanHektar} ha` : "-" }
                      ].map(k => (
                        <div key={k.etiket}>
                          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.etiket}</div>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem", marginTop: 2 }}>{k.deger}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Alt Bar */}
          <div style={{
            padding: "16px 28px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            gap: 12
          }}>
            <div>
              {hata && (
                <span style={{ color: "var(--danger)", fontSize: "0.84rem", fontWeight: 600 }}>
                  ⚠ {hata}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {aktifAdim > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setAktifAdim(p => p - 1); setHata(""); }}
                  disabled={yukleniyor}
                >
                  ← Geri
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onKapat}
                disabled={yukleniyor}
              >
                İptal
              </button>
              {aktifAdim < ADIMLAR.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={handleIleri}>
                  İleri →
                </button>
              ) : (
                <button type="submit" className="btn btn-primary" disabled={yukleniyor}>
                  {yukleniyor ? (
                    <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Oluşturuluyor...</>
                  ) : "✓ Projeyi Oluştur"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const KART_GRADYANLAR = [
  "linear-gradient(135deg, #1B2B5E 0%, #2D4A8A 100%)",
  "linear-gradient(135deg, #7C3AED 0%, #1B2B5E 100%)",
  "linear-gradient(135deg, #0369A1 0%, #1B2B5E 100%)",
  "linear-gradient(135deg, #C43E06 0%, #1B2B5E 100%)",
];

function detayParse(description) {
  if (!description) return {};
  const parcalar = {};
  description.split("|").forEach(s => {
    const [k, ...vs] = s.trim().split(":");
    if (k && vs.length) parcalar[k.trim()] = vs.join(":").trim();
  });
  return parcalar;
}

function ProjeKarti({ proje, index, onSec, onSil }) {
  const [silOnay, setSilOnay] = useState(false);
  const detay = detayParse(proje.description);

  const dcKw = proje.installedPowerKw ? Number(proje.installedPowerKw) : null;
  const acKw = detay["AC Güç"] ? parseFloat(detay["AC Güç"]) : null;
  const ozeloran = dcKw && acKw ? (dcKw / acKw).toFixed(2) : null;

  return (
    <div className="proje-kart" style={{ cursor: "default" }}>
      {/* Üst Banner */}
      <div
        style={{
          background: KART_GRADYANLAR[index % KART_GRADYANLAR.length],
          padding: "18px 20px",
          position: "relative",
          overflow: "hidden",
          cursor: "pointer"
        }}
        onClick={() => onSec(proje)}
      >
        <div style={{
          position: "absolute", right: -20, top: -20,
          width: 100, height: 100, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)"
        }} />
        <div style={{
          position: "absolute", right: 10, bottom: -30,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)"
        }} />
        <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>☀️</div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
          {proje.projectName}
        </div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
          📍 {proje.location}
          {detay["İşletme Yılı"] && (
            <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "1px 8px", fontSize: "0.75rem" }}>
              {detay["İşletme Yılı"]}
            </span>
          )}
        </div>
      </div>

      {/* Teknik Bilgiler */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { etiket: "DC Güç", deger: dcKw ? `${Number(dcKw).toLocaleString("tr-TR")} kWp` : "-" },
            { etiket: "AC Güç", deger: acKw ? `${acKw.toLocaleString("tr-TR")} kW` : "-" },
            { etiket: "DC/AC", deger: ozeloran ? ozeloran : "-" }
          ].map(k => (
            <div key={k.etiket} style={{
              background: "var(--bg)", borderRadius: 8, padding: "8px 10px", textAlign: "center"
            }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{k.etiket}</div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--secondary)", marginTop: 2 }}>{k.deger}</div>
            </div>
          ))}
        </div>

        {(detay["Yıllık Üretim"] || detay["Panel"] || detay["Gerilim"]) && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {detay["Yıllık Üretim"] && (
              <span style={{ fontSize: "0.74rem", background: "#EFF6FF", color: "var(--secondary)", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
                ⚡ {detay["Yıllık Üretim"]}
              </span>
            )}
            {detay["Panel"] && (
              <span style={{ fontSize: "0.74rem", background: "var(--primary-light)", color: "var(--primary-dark)", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
                ☀️ {detay["Panel"].split("(")[0].trim()}
              </span>
            )}
            {detay["Gerilim"] && (
              <span style={{ fontSize: "0.74rem", background: "#F0FDF4", color: "#15803D", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
                🔌 {detay["Gerilim"]}
              </span>
            )}
            {detay["Arazi"] && (
              <span style={{ fontSize: "0.74rem", background: "#FEF9C3", color: "#854D0E", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
                🌱 {detay["Arazi"]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Alt Bar */}
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {new Date(proje.createdAt).toLocaleDateString("tr-TR")}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {silOnay ? (
            <>
              <span style={{ fontSize: "0.78rem", color: "var(--danger)", fontWeight: 600 }}>Silinsin mi?</span>
              <button type="button" className="btn btn-danger btn-kucuk" onClick={e => { e.stopPropagation(); onSil(proje.id); }}>Evet</button>
              <button type="button" className="btn btn-ghost btn-kucuk" onClick={e => { e.stopPropagation(); setSilOnay(false); }}>Hayır</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-kucuk" onClick={e => { e.stopPropagation(); setSilOnay(true); }}>
                Sil
              </button>
              <button type="button" className="btn btn-primary btn-kucuk" onClick={() => onSec(proje)}>
                Aç →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjeListesiPage() {
  const { projeListesi, totalProjectsCreated, projeOlustur, projeSil, projeYukleniyor, projeAc } =
    useAppWorkspace();
  const navigate = useNavigate();
  const [modalAcik, setModalAcik] = useState(false);
  const [olusturuluyor, setOlusturuluyor] = useState(false);
  const [hata, setHata] = useState("");

  async function handleOlustur(payload) {
    setOlusturuluyor(true);
    try {
      const yeniProje = await projeOlustur(payload);
      setModalAcik(false);
      if (yeniProje) {
        navigate(`/app/pvsyst`);
      }
    } catch (err) {
      throw err;
    } finally {
      setOlusturuluyor(false);
    }
  }

  async function handleSil(projeId) {
    setHata("");
    try {
      await projeSil(projeId);
    } catch (err) {
      setHata(err?.message || "Proje silinemedi.");
    }
  }

  return (
    <div>
      <div className="proje-liste-header">
        <div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--secondary)", marginBottom: 4 }}>Projelerim</h2>
          <p style={{ color: "var(--text-soft)", fontSize: "0.95rem" }}>Her proje icin ayri simulasyon ve analiz yapabilirsiniz.</p>
          <div className="proje-sayac-grup mt-2">
            <span className="proje-sayac-rozet">
              {projeListesi.length} aktif proje
            </span>
            {totalProjectsCreated > 0 && (
              <span className="proje-sayac-rozet proje-sayac-toplam">
                Toplam olusturulan: {totalProjectsCreated}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalAcik(true)}
        >
          + Yeni Proje
        </button>
      </div>

      {hata && <div className="alert alert-danger">{hata}</div>}

      {projeYukleniyor ? (
        <div className="yukleniyor-kutu">
          <div className="spinner" />
        </div>
      ) : projeListesi.length === 0 ? (
        <div className="card"><div className="bos-proje-alani">
          <div className="bos-proje-ikon">P</div>
          <h3>Henüz proje yok</h3>
          <p>Ilk projenizi olusturun ve simülasyon yapmaya baslayın.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalAcik(true)}
          >
            + Ilk Projeyi Olustur
          </button>
        </div></div>
      ) : (
        <div className="proje-kart-grid">
          {projeListesi.map((proje, index) => (
            <ProjeKarti
              key={proje.id}
              proje={proje}
              index={index}
              onSec={(p) => {
                projeAc(p);
                navigate("/app/pvsyst");
              }}
              onSil={handleSil}
            />
          ))}
        </div>
      )}

      {modalAcik && (
        <YeniProjeModal
          onKapat={() => setModalAcik(false)}
          onOlustur={handleOlustur}
          yukleniyor={olusturuluyor}
        />
      )}
    </div>
  );
}

export default ProjeListesiPage;
