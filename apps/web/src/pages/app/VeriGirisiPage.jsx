import { useState } from "react";
import { getEpiasData } from "../../api/client";
import { useAppWorkspace } from "../../context/AppWorkspaceContext";

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csvAyiracBul(metin) {
  const satir = metin.split(/\r?\n/).find((line) => line.trim()) || "";
  if (satir.includes(";")) return ";";
  if (satir.includes("\t")) return "\t";
  return ",";
}

function parsePvsystCsv(metin) {
  const ayirac = csvAyiracBul(metin);
  const satirlar = metin
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!satirlar.length) {
    return { kayitSayisi: 0, toplamUretimMwh: null };
  }

  let headerIndex = satirlar.findIndex((line) => {
    const l = line.toLowerCase();
    return l.includes("date") && (l.includes("e_grid") || l.includes("e-grid") || l.includes("energy"));
  });
  if (headerIndex < 0) {
    headerIndex = 0;
  }

  const headers = satirlar[headerIndex].split(ayirac).map((h) => h.replace(/"/g, "").trim());
  const rows = satirlar
    .slice(headerIndex + 1)
    .map((line) => line.split(ayirac).map((c) => c.replace(/"/g, "").trim()))
    .filter((cells) => cells.length >= headers.length);

  const enerjiKolonIndex = headers.findIndex((h) => ["e_grid", "e-grid", "energy", "egrid"].includes(h.toLowerCase()));
  let toplamUretimMwh = null;
  if (enerjiKolonIndex >= 0) {
    const toplamKwh = rows.reduce((acc, row) => acc + toNumber(row[enerjiKolonIndex], 0), 0);
    toplamUretimMwh = Number((toplamKwh / 1000).toFixed(2));
  }

  return {
    kayitSayisi: rows.length,
    toplamUretimMwh
  };
}

function VeriGirisiPage() {
  const { veriGirisi, veriGirisiTamam, alanGuncelle } = useAppWorkspace();
  const [epiasLoading, setEpiasLoading] = useState(false);
  const [epiasMesaj, setEpiasMesaj] = useState("");
  const [pvsystMesaj, setPvsystMesaj] = useState("");
  const [hata, setHata] = useState("");

  async function epiasYukle() {
    setHata("");
    setEpiasMesaj("");
    setEpiasLoading(true);
    try {
      const sonuc = await getEpiasData({
        startDate: veriGirisi.epiasStartDate,
        endDate: veriGirisi.epiasEndDate
      });
      alanGuncelle("veriGirisi", { epiasKayitSayisi: Number(sonuc?.count || 0) });
      setEpiasMesaj(`${Number(sonuc?.count || 0)} EPİAŞ kaydı alındı.`);
    } catch (err) {
      setHata(err?.response?.data?.error || "EPİAŞ verisi alınamadı.");
    } finally {
      setEpiasLoading(false);
    }
  }

  async function pvsystDosyaSec(event) {
    const dosya = event.target.files?.[0];
    if (!dosya) return;
    setHata("");
    setPvsystMesaj("");
    try {
      const text = await dosya.text();
      const parsed = parsePvsystCsv(text);
      const patch = {
        pvsystKayitSayisi: parsed.kayitSayisi,
        pvsystDosyaAdi: dosya.name
      };
      if (parsed.toplamUretimMwh && parsed.toplamUretimMwh > 0) {
        patch.yillikUretimMwh = parsed.toplamUretimMwh;
      }
      alanGuncelle("veriGirisi", patch);
      setPvsystMesaj(
        parsed.toplamUretimMwh
          ? `${parsed.kayitSayisi} satır okundu. Yıllık üretim ${parsed.toplamUretimMwh} MWh olarak güncellendi.`
          : `${parsed.kayitSayisi} satır okundu.`
      );
    } catch (_err) {
      setHata("PVSyst CSV dosyası okunamadı.");
    }
  }

  return (
    <section className="app-modul">
      <header className="app-modul-baslik glass-card">
        <h1>Veri Girisi</h1>
        <p>Tesis ve enerji verilerini bu alanda ayri sekilde yonet. Bu adim tamamlanmadan analiz acilmaz.</p>
        <span className={`durum-cipi ${veriGirisiTamam ? "hazir" : "eksik"}`}>{veriGirisiTamam ? "Veri Hazir" : "Veri Eksik"}</span>
      </header>

      <div className="modul-iki-kolon">
        <article className="glass-card">
          <h2>Tesis Bilgileri</h2>
          <form className="simulasyon-form">
            <label>
              Proje Adi
              <input
                value={veriGirisi.projeAdi}
                onChange={(e) => alanGuncelle("veriGirisi", { projeAdi: e.target.value })}
                placeholder="Ornek: Aydin GES Depolama"
              />
            </label>
            <label>
              Lokasyon
              <input
                value={veriGirisi.lokasyon}
                onChange={(e) => alanGuncelle("veriGirisi", { lokasyon: e.target.value })}
                placeholder="Il / Ilce"
              />
            </label>
            <label>
              Kurulu Guc (kW)
              <input
                type="number"
                min="1"
                value={veriGirisi.kuruluGucKw}
                onChange={(e) => alanGuncelle("veriGirisi", { kuruluGucKw: e.target.value })}
              />
            </label>
          </form>
        </article>

        <article className="glass-card">
          <h2>Enerji Verileri</h2>
          <form className="simulasyon-form">
            <label>
              Yillik Uretim (MWh)
              <input
                type="number"
                min="1"
                value={veriGirisi.yillikUretimMwh}
                onChange={(e) => alanGuncelle("veriGirisi", { yillikUretimMwh: e.target.value })}
              />
            </label>
            <label>
              Yillik Tuketim (MWh)
              <input
                type="number"
                min="0"
                value={veriGirisi.yillikTuketimMwh}
                onChange={(e) => alanGuncelle("veriGirisi", { yillikTuketimMwh: e.target.value })}
              />
            </label>
            <label>
              Baz Enerji Fiyati (TL/MWh)
              <input
                type="number"
                min="1"
                value={veriGirisi.bazEnerjiFiyatiTryMwh}
                onChange={(e) => alanGuncelle("veriGirisi", { bazEnerjiFiyatiTryMwh: e.target.value })}
              />
            </label>
          </form>
        </article>
      </div>

      <div className="modul-iki-kolon">
        <article className="glass-card">
          <h2>PVSyst Verisi Yukle</h2>
          <p className="alt-bilgi">PVSyst saatlik CSV dosyasını yükle, sistem yıllık üretimi otomatik güncellesin.</p>
          <div className="veri-kaynak-kutu">
            <input type="file" accept=".csv,text/csv" onChange={pvsystDosyaSec} />
            <small>Dosya: {veriGirisi.pvsystDosyaAdi || "Henüz dosya seçilmedi"}</small>
            <small>Kayıt: {veriGirisi.pvsystKayitSayisi || 0}</small>
            {pvsystMesaj && <div className="bilgi-kutu">{pvsystMesaj}</div>}
          </div>
        </article>

        <article className="glass-card">
          <h2>EPİAŞ Fiyat Verisi</h2>
          <p className="alt-bilgi">Tarih aralığı seçip API üzerinden EPİAŞ kayıtlarını yükle.</p>
          <form
            className="simulasyon-form"
            onSubmit={(event) => {
              event.preventDefault();
              epiasYukle();
            }}
          >
            <div className="form-grid">
              <label>
                Başlangıç
                <input
                  type="date"
                  value={veriGirisi.epiasStartDate || ""}
                  onChange={(e) => alanGuncelle("veriGirisi", { epiasStartDate: e.target.value })}
                />
              </label>
              <label>
                Bitiş
                <input
                  type="date"
                  value={veriGirisi.epiasEndDate || ""}
                  onChange={(e) => alanGuncelle("veriGirisi", { epiasEndDate: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className="btn btn-secondary" disabled={epiasLoading}>
              {epiasLoading ? "Yukleniyor..." : "EPİAŞ Verilerini Getir"}
            </button>
          </form>
          <small>Kayıt: {veriGirisi.epiasKayitSayisi || 0}</small>
          {epiasMesaj && <div className="bilgi-kutu">{epiasMesaj}</div>}
        </article>
      </div>

      {hata && <div className="hata-kutu">{hata}</div>}
    </section>
  );
}

export default VeriGirisiPage;
