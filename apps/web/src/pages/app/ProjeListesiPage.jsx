import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

const KONUM_GORSEL = [
  "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=600&q=70"
];

function projeGorseli(index) {
  return KONUM_GORSEL[index % KONUM_GORSEL.length];
}

function YeniProjeModal({ onKapat, onOlustur, yukleniyor }) {
  const [form, setForm] = useState({
    projectName: "",
    location: "",
    installedPowerKw: "",
    description: ""
  });
  const [hata, setHata] = useState("");

  function handleChange(alan, deger) {
    setForm((prev) => ({ ...prev, [alan]: deger }));
    setHata("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.projectName.trim() || form.projectName.trim().length < 2) {
      setHata("Proje adi en az 2 karakter olmalidir.");
      return;
    }
    if (!form.location.trim() || form.location.trim().length < 2) {
      setHata("Lokasyon bilgisi en az 2 karakter olmalidir.");
      return;
    }
    const payload = {
      projectName: form.projectName.trim(),
      location: form.location.trim(),
      installedPowerKw: form.installedPowerKw ? Number(form.installedPowerKw) : null,
      description: form.description.trim() || null
    };
    try {
      await onOlustur(payload);
    } catch (err) {
      setHata(err?.message || "Proje olusturulamadi.");
    }
  }

  return (
    <div className="modal-arkaplan" onClick={onKapat}>
      <div className="modal-kutu" onClick={(e) => e.stopPropagation()}>
        <div className="modal-baslik">
          <h2>Yeni Proje Olustur</h2>
          <button type="button" className="modal-kapat-btn" onClick={onKapat}>x</button>
        </div>

        <form className="simulasyon-form" onSubmit={handleSubmit}>
          <label>
            Proje Adi *
            <input
              value={form.projectName}
              onChange={(e) => handleChange("projectName", e.target.value)}
              placeholder="Ornek: Aydin GES Depolama Projesi"
              autoFocus
            />
          </label>
          <label>
            Lokasyon *
            <input
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Il / Ilce / Bolge"
            />
          </label>
          <label>
            Kurulu Guc (kW)
            <input
              type="number"
              min="0"
              value={form.installedPowerKw}
              onChange={(e) => handleChange("installedPowerKw", e.target.value)}
              placeholder="Ornek: 5000"
            />
          </label>
          <label>
            Aciklama
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Proje hakkinda kisa bilgi (opsiyonel)"
              rows={3}
            />
          </label>

          {hata && <div className="hata-kutu">{hata}</div>}

          <div className="modal-aksiyonlar">
            <button type="button" className="btn btn-secondary" onClick={onKapat} disabled={yukleniyor}>
              Iptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={yukleniyor}>
              {yukleniyor ? "Olusturuluyor..." : "Proje Olustur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjeKarti({ proje, index, onSec, onSil }) {
  const [silOnay, setSilOnay] = useState(false);

  return (
    <div className="proje-kart">
      <div
        className="proje-kart-gorsel"
        style={{ backgroundImage: `url(${projeGorseli(index)})` }}
        onClick={() => onSec(proje)}
      />
      <div className="proje-kart-icerik" onClick={() => onSec(proje)}>
        <h3 className="proje-kart-adi">{proje.projectName}</h3>
        <div className="proje-kart-detaylar">
          <span className="proje-kart-satir">
            <span className="proje-kart-ikon">o</span>
            {proje.location}
          </span>
          {proje.installedPowerKw && (
            <span className="proje-kart-satir">
              <span className="proje-kart-ikon">~</span>
              {Number(proje.installedPowerKw).toLocaleString("tr-TR")} kW
            </span>
          )}
          {proje.description && (
            <span className="proje-kart-satir proje-kart-aciklama">
              {proje.description}
            </span>
          )}
          <span className="proje-kart-satir proje-kart-tarih">
            {new Date(proje.createdAt).toLocaleDateString("tr-TR")}
          </span>
        </div>
      </div>
      <div className="proje-kart-aksiyonlar">
        <button
          type="button"
          className="btn btn-primary btn-kucuk"
          onClick={() => onSec(proje)}
        >
          Ac
        </button>
        {!silOnay ? (
          <button
            type="button"
            className="btn btn-danger btn-kucuk"
            onClick={(e) => { e.stopPropagation(); setSilOnay(true); }}
          >
            Sil
          </button>
        ) : (
          <div className="sil-onay">
            <span>Emin misin?</span>
            <button
              type="button"
              className="btn btn-danger btn-kucuk"
              onClick={(e) => { e.stopPropagation(); onSil(proje.id); }}
            >
              Evet
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-kucuk"
              onClick={(e) => { e.stopPropagation(); setSilOnay(false); }}
            >
              Hayir
            </button>
          </div>
        )}
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
