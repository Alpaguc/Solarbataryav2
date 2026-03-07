import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createProject, getMyProject } from "../api/client";
import LoadingBox from "../components/LoadingBox";
import SimulationPage from "./SimulationPage";

function WorkspacePage({ mode = "project" }) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [hata, setHata] = useState("");
  const [olusturuluyor, setOlusturuluyor] = useState(false);
  const [form, setForm] = useState({
    projectName: "",
    location: "",
    installedPowerKw: "",
    description: ""
  });

  useEffect(() => {
    async function yukle() {
      try {
        const proje = await getMyProject();
        setProject(proje || null);
      } catch (err) {
        setHata(err?.response?.data?.error || "Proje bilgisi yuklenemedi.");
      } finally {
        setLoading(false);
      }
    }
    yukle();
  }, []);

  async function projeOlustur(e) {
    e.preventDefault();
    setHata("");
    setOlusturuluyor(true);
    try {
      const proje = await createProject({
        projectName: form.projectName,
        location: form.location,
        installedPowerKw: form.installedPowerKw ? Number(form.installedPowerKw) : null,
        description: form.description
      });
      setProject(proje);
    } catch (err) {
      setHata(err?.response?.data?.error || "Proje olusturulamadi.");
    } finally {
      setOlusturuluyor(false);
    }
  }

  if (loading) {
    return <LoadingBox text="Calisma alani yukleniyor..." />;
  }

  if (!project) {
    return (
      <section className="glass-card proje-olustur-wrapper">
        <h2>Proje Olustur</h2>
        <p>Bu alana devam etmek icin once sana ait tek bir proje olusturman gerekiyor.</p>
        <form className="simulasyon-form" onSubmit={projeOlustur}>
          <label>
            Proje Adi
            <input
              value={form.projectName}
              onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
              placeholder="Ornek: Aydin GES Depolama"
              required
            />
          </label>
          <label>
            Lokasyon
            <input
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="Il / Ilce"
              required
            />
          </label>
          <label>
            Kurulu Guc (kW)
            <input
              type="number"
              value={form.installedPowerKw}
              onChange={(e) => setForm((p) => ({ ...p, installedPowerKw: e.target.value }))}
              placeholder="Opsiyonel"
            />
          </label>
          <label>
            Aciklama
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Opsiyonel not"
            />
          </label>

          {hata && <div className="hata-kutu">{hata}</div>}
          <button className="btn btn-primary btn-block" disabled={olusturuluyor} type="submit">
            {olusturuluyor ? "Olusturuluyor..." : "Proje Olustur"}
          </button>
        </form>
      </section>
    );
  }

  if (mode === "project") {
    return (
      <section className="glass-card proje-olustur-wrapper">
        <h2>Projen Hazir</h2>
        <p>Hesabina bagli proje olusturuldu. Simulasyon alanina gecerek batarya senaryolarini calistirabilirsin.</p>
        <div className="glass-card-white">
          <p>
            <strong>Proje Adi:</strong> {project.projectName}
          </p>
          <p>
            <strong>Lokasyon:</strong> {project.location}
          </p>
          <p>
            <strong>Kurulu Guc:</strong> {project.installedPowerKw ?? "-"} kW
          </p>
        </div>
        <Link to="/app/simulasyon" className="btn btn-primary">
          Simulasyon Alanina Gec
        </Link>
      </section>
    );
  }

  return <SimulationPage project={project} />;
}

export default WorkspacePage;
