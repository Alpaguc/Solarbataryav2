import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { isAuthenticated, girisYap, kayitOl, supabaseHazir } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [hata, setHata] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "register") {
      setMode("register");
    } else if (modeParam === "login") {
      setMode("login");
    }
  }, [searchParams]);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  async function submit(e) {
    e.preventDefault();
    setHata("");
    setLoading(true);
    try {
      if (!supabaseHazir) {
        throw new Error("Supabase ayarlari eksik. Netlify ortam degiskenlerine SUPABASE bilgilerini ekleyin.");
      }
      if (mode === "login") {
        await girisYap({ email: form.email, password: form.password });
      } else {
        await kayitOl({
          fullName: form.fullName,
          email: form.email,
          password: form.password
        });
      }
      navigate("/app", { replace: true });
    } catch (err) {
      setHata(err?.message || err?.response?.data?.error || "Giris islemi basarisiz.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-wrapper">
      <div className="auth-card glass-card">
        <h2>{mode === "login" ? "Kullanici Girisi" : "Hesap Olustur"}</h2>
        <p>{mode === "login" ? "Simulasyon alanina erismek icin giris yapin." : "Hizli kayit ile proje alani acin."}</p>
        {!supabaseHazir && (
          <div className="hata-kutu">Supabase degiskenleri eksik. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanimlayin.</div>
        )}

        <div className="auth-mode-switch">
          <button
            type="button"
            className={`mode-btn ${mode === "login" ? "aktif" : ""}`}
            onClick={() => setMode("login")}
          >
            Giris
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "register" ? "aktif" : ""}`}
            onClick={() => setMode("register")}
          >
            Kayit
          </button>
        </div>

        <form className="simulasyon-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Ad Soyad
              <input
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Adiniz Soyadiniz"
                required={mode === "register"}
              />
            </label>
          )}
          <label>
            E-posta
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="ornek@mail.com"
              required
            />
          </label>
          <label>
            Sifre
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="En az 6 karakter"
              required
            />
          </label>

          {hata && <div className="hata-kutu">{hata}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Bekleyin..." : mode === "login" ? "Giris Yap" : "Kayit Ol"}
          </button>
        </form>

        <button
          type="button"
          className="metin-buton"
          onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
        >
          {mode === "login" ? "Hesabiniz yok mu? Kayit olun" : "Hesabiniz var mi? Giris yapin"}
        </button>

        <Link to="/" className="metin-link">
          Ana sayfaya don
        </Link>
      </div>
    </section>
  );
}

export default LoginPage;
