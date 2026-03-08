import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";
import { listBatteries, createCustomBattery, importBtrBattery, deleteBattery } from "../../api/client";

const KIMYA_RENK = {
  LFP: "#16A34A",
  NMC: "#D97706",
  NCA: "#7C3AED",
  LTO: "#0284C7"
};

function BataryaKart({ batarya, secili, onSec }) {
  return (
    <div
      className={`batarya-kart ${secili ? "secili" : ""}`}
      onClick={() => onSec(batarya)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSec(batarya)}
    >
      <div className="batarya-kart-header">
        <div>
          <div className="batarya-kart-marka">{batarya.manufacturer}</div>
          <div className="batarya-kart-model">{batarya.model}</div>
        </div>
        <span
          className="badge"
          style={{ background: KIMYA_RENK[batarya.chemistry] + "20", color: KIMYA_RENK[batarya.chemistry] }}
        >
          {batarya.chemistry}
        </span>
      </div>

      <div className="batarya-kart-specs">
        <div className="batarya-spec">
          <div className="batarya-spec-etiket">Kapasite</div>
          <div className="batarya-spec-deger">{batarya.nominalCapacityKwh} kWh</div>
        </div>
        <div className="batarya-spec">
          <div className="batarya-spec-etiket">Max Guc</div>
          <div className="batarya-spec-deger">{batarya.maxChargePowerKw} kW</div>
        </div>
        <div className="batarya-spec">
          <div className="batarya-spec-etiket">Verimlilik</div>
          <div className="batarya-spec-deger">
            {(Math.sqrt(batarya.chargeEfficiency * batarya.dischargeEfficiency) * 100).toFixed(0)}%
          </div>
        </div>
        <div className="batarya-spec">
          <div className="batarya-spec-etiket">Takvim Deg.</div>
          <div className="batarya-spec-deger">%{batarya.calendarDegradationPctPerYear}/yil</div>
        </div>
      </div>

      {batarya.costPerKwhTry && (
        <div style={{ marginTop: 10, fontSize: "0.78rem", color: "var(--text-muted)" }}>
          ~{(batarya.costPerKwhTry * batarya.nominalCapacityKwh / 1000).toFixed(0)}K ₺ yatirim
        </div>
      )}

      {secili && (
        <div style={{ marginTop: 10, textAlign: "center", color: "var(--primary)", fontWeight: 700, fontSize: "0.85rem" }}>
          Secildi
        </div>
      )}
    </div>
  );
}

function OzelGirForm({ onKaydet }) {
  const [form, setForm] = useState({
    manufacturer: "", model: "", chemistry: "LFP",
    nominalCapacityKwh: 100, maxChargePowerKw: 50, maxDischargePowerKw: 50,
    chargeEfficiency: 0.96, dischargeEfficiency: 0.96,
    minSoc: 0.1, maxSoc: 0.9,
    calendarDegradationPctPerYear: 2.0,
    costPerKwhTry: "", annualMaintenanceTry: "", scrapValuePct: 0.1
  });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.manufacturer || !form.model) { setHata("Uretici ve model adı gerekli."); return; }
    setYukleniyor(true);
    setHata(null);
    try {
      const saved = await createCustomBattery({
        ...form,
        nominalCapacityKwh: Number(form.nominalCapacityKwh),
        maxChargePowerKw: Number(form.maxChargePowerKw),
        maxDischargePowerKw: Number(form.maxDischargePowerKw),
        chargeEfficiency: Number(form.chargeEfficiency),
        dischargeEfficiency: Number(form.dischargeEfficiency),
        minSoc: Number(form.minSoc),
        maxSoc: Number(form.maxSoc),
        calendarDegradationPctPerYear: Number(form.calendarDegradationPctPerYear),
        costPerKwhTry: form.costPerKwhTry ? Number(form.costPerKwhTry) : null,
        annualMaintenanceTry: form.annualMaintenanceTry ? Number(form.annualMaintenanceTry) : null,
        scrapValuePct: Number(form.scrapValuePct)
      });
      onKaydet(saved);
    } catch (e) {
      setHata(e.message);
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {hata && <div className="alert alert-danger">{hata}</div>}
      <div className="form-grid-2">
        <div className="form-grup">
          <label>Uretici Firma</label>
          <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="CATL, BYD..." />
        </div>
        <div className="form-grup">
          <label>Model Adi</label>
          <input value={form.model} onChange={e => set("model", e.target.value)} placeholder="Model adi" />
        </div>
      </div>
      <div className="form-grid-3">
        <div className="form-grup">
          <label>Kimya</label>
          <select value={form.chemistry} onChange={e => set("chemistry", e.target.value)}>
            <option value="LFP">LFP</option>
            <option value="NMC">NMC</option>
            <option value="NCA">NCA</option>
            <option value="LTO">LTO</option>
          </select>
        </div>
        <div className="form-grup">
          <label>Nominal Kapasite (kWh)</label>
          <input type="number" min="1" value={form.nominalCapacityKwh} onChange={e => set("nominalCapacityKwh", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Max Sarj Gucu (kW)</label>
          <input type="number" min="1" value={form.maxChargePowerKw} onChange={e => set("maxChargePowerKw", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Max Desarj Gucu (kW)</label>
          <input type="number" min="1" value={form.maxDischargePowerKw} onChange={e => set("maxDischargePowerKw", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Sarj Verimliligi (0-1)</label>
          <input type="number" step="0.01" min="0.5" max="1" value={form.chargeEfficiency} onChange={e => set("chargeEfficiency", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Desarj Verimliligi (0-1)</label>
          <input type="number" step="0.01" min="0.5" max="1" value={form.dischargeEfficiency} onChange={e => set("dischargeEfficiency", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Min SOC (0-1)</label>
          <input type="number" step="0.01" min="0" max="0.5" value={form.minSoc} onChange={e => set("minSoc", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Max SOC (0-1)</label>
          <input type="number" step="0.01" min="0.5" max="1" value={form.maxSoc} onChange={e => set("maxSoc", e.target.value)} />
        </div>
        <div className="form-grup">
          <label>Takvim Degradasyon (%/yil)</label>
          <input type="number" step="0.1" min="0" max="10" value={form.calendarDegradationPctPerYear} onChange={e => set("calendarDegradationPctPerYear", e.target.value)} />
        </div>
      </div>
      <div className="card-baslik mt-3" style={{ fontSize: "0.85rem" }}>Finansal Parametreler (opsiyonel)</div>
      <div className="form-grid-3">
        <div className="form-grup">
          <label>Maliyet (₺/kWh)</label>
          <input type="number" value={form.costPerKwhTry} onChange={e => set("costPerKwhTry", e.target.value)} placeholder="25000" />
        </div>
        <div className="form-grup">
          <label>Yillik Bakim (₺)</label>
          <input type="number" value={form.annualMaintenanceTry} onChange={e => set("annualMaintenanceTry", e.target.value)} placeholder="10000" />
        </div>
        <div className="form-grup">
          <label>Hurda Degeri (0-1)</label>
          <input type="number" step="0.01" min="0" max="0.5" value={form.scrapValuePct} onChange={e => set("scrapValuePct", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button type="submit" className="btn btn-primary" disabled={yukleniyor}>
          {yukleniyor ? "Kaydediliyor..." : "Bataryayi Kaydet ve Sec"}
        </button>
      </div>
    </form>
  );
}

function BtrImportForm({ onKaydet }) {
  const [btrText, setBtrText] = useState("");
  const [preview, setPreview] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    const text = await file.text();
    setBtrText(text);
    setPreview({ name: file.name, size: (file.size / 1024).toFixed(0) });
  }

  async function handleImport() {
    if (!btrText) { setHata("BTR dosyası gerekli."); return; }
    setYukleniyor(true);
    setHata(null);
    try {
      const saved = await importBtrBattery(btrText);
      onKaydet(saved);
    } catch (e) {
      setHata(e.message);
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div>
      {hata && <div className="alert alert-danger">{hata}</div>}
      <div
        className={`drop-zone ${preview ? "drop-zone-yuklu" : ""}`}
        onClick={() => inputRef.current?.click()}
      >
        <div className="drop-zone-ikon">{preview ? "✅" : "🔋"}</div>
        <h4>{preview ? preview.name : "PVSyst .BTR Dosyasini Secin"}</h4>
        <p>{preview ? `${preview.size} KB - yuklu` : "PVSyst battery definition file (.btr, .txt)"}</p>
        <input ref={inputRef} type="file" accept=".btr,.txt" hidden onChange={e => handleFile(e.target.files[0])} />
      </div>

      {btrText && (
        <div style={{ marginTop: 16 }}>
          <div className="card-baslik" style={{ fontSize: "0.85rem" }}>BTR Icerik Onizleme</div>
          <pre style={{ fontSize: "0.72rem", background: "var(--bg)", padding: 12, borderRadius: "var(--radius-sm)", maxHeight: 150, overflow: "auto", color: "var(--text-soft)" }}>
            {btrText.slice(0, 800)}...
          </pre>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={handleImport} disabled={yukleniyor}>
              {yukleniyor ? "Import ediliyor..." : "BTR Import Et ve Sec"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BataryaSayfasi() {
  const navigate = useNavigate();
  const { secilenBatarya, setSecilenBatarya } = useAppWorkspace();
  const [aktifSekme, setAktifSekme] = useState("katalog");
  const [bataryalar, setBataryalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    setYukleniyor(true);
    listBatteries()
      .then(setBataryalar)
      .catch(e => setHata(e.message))
      .finally(() => setYukleniyor(false));
  }, []);

  function handleNewBattery(bat) {
    setBataryalar(prev => [bat, ...prev]);
    setSecilenBatarya(bat);
    setAktifSekme("katalog");
  }

  async function handleDelete(id) {
    if (!confirm("Bu bataryayi silmek istediginizden emin misiniz?")) return;
    await deleteBattery(id);
    setBataryalar(prev => prev.filter(b => b.id !== id));
    if (secilenBatarya?.id === id) setSecilenBatarya(null);
  }

  const katalogBataryalar = bataryalar.filter(b => b.source === "catalog");
  const kullaniciBataryalar = bataryalar.filter(b => b.source !== "catalog");

  return (
    <div>
      <div className="sayfa-baslik">
        <h2>2 — Batarya Secimi</h2>
        <p>Simülasyon icin kullanilacak bataryayi seciniz veya yeni bir tanim ekleyin.</p>
      </div>

      {secilenBatarya && (
        <div className="alert alert-success mb-3">
          <strong>Secili Batarya:</strong> {secilenBatarya.manufacturer} {secilenBatarya.model} — {secilenBatarya.nominalCapacityKwh} kWh
        </div>
      )}

      <div className="card">
        <div className="tab-bar">
          {[
            { key: "katalog", label: "Sistem Katalogu" },
            { key: "ozel", label: "Ozel Giris" },
            { key: "btr", label: "BTR Import" }
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

        {aktifSekme === "katalog" && (
          <div>
            {yukleniyor ? (
              <div className="yukleniyor-kutu"><div className="spinner" /></div>
            ) : hata ? (
              <div className="alert alert-danger">{hata}</div>
            ) : (
              <>
                {katalogBataryalar.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="card-baslik">Sistem Bataryalari</div>
                    <div className="batarya-kart-grid">
                      {katalogBataryalar.map(b => (
                        <BataryaKart key={b.id} batarya={b} secili={secilenBatarya?.id === b.id} onSec={setSecilenBatarya} />
                      ))}
                    </div>
                  </div>
                )}
                {kullaniciBataryalar.length > 0 && (
                  <div>
                    <div className="card-baslik">Kendi Bataryalarim</div>
                    <div className="batarya-kart-grid">
                      {kullaniciBataryalar.map(b => (
                        <div key={b.id} style={{ position: "relative" }}>
                          <BataryaKart batarya={b} secili={secilenBatarya?.id === b.id} onSec={setSecilenBatarya} />
                          <button
                            type="button"
                            className="btn btn-danger btn-kucuk"
                            style={{ position: "absolute", top: 8, right: 8 }}
                            onClick={e => { e.stopPropagation(); handleDelete(b.id); }}
                          >
                            Sil
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {bataryalar.length === 0 && (
                  <div className="bos-proje-alani">
                    <div className="bos-proje-ikon">🔋</div>
                    <p>Katalogda batarya bulunamadi. Ozel giris veya BTR import yapiniz.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {aktifSekme === "ozel" && (
          <OzelGirForm onKaydet={handleNewBattery} />
        )}

        {aktifSekme === "btr" && (
          <BtrImportForm onKaydet={handleNewBattery} />
        )}
      </div>

      {secilenBatarya && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-primary btn-buyuk"
            onClick={() => navigate("/app/strateji")}
          >
            Strateji Secimi &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

export default BataryaSayfasi;
