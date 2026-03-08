import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { isAuthenticated, girisYap, kayitOl, supabaseHazir } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [hata, setHata] = useState("");
  const [basariMesaji, setBasariMesaji] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "register") setMode("register");
    else if (modeParam === "login") setMode("login");
  }, [searchParams]);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  async function submit(e) {
    e.preventDefault();
    setHata("");
    setBasariMesaji("");
    setLoading(true);
    try {
      if (!supabaseHazir) {
        throw new Error("Supabase ayarlari eksik. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanimlayin.");
      }
      if (mode === "login") {
        await girisYap({ email: form.email, password: form.password });
        navigate("/app", { replace: true });
      } else {
        try {
          await kayitOl({
            fullName: form.fullName,
            email: form.email,
            password: form.password
          });
          navigate("/app", { replace: true });
        } catch (err) {
          const msg = err?.message || "";
          if (msg.includes("dogrulama") || msg.includes("e-posta")) {
            setBasariMesaji("Kayıt oluştu. Lütfen e-posta adresinize gelen doğrulama bağlantısını onaylayın.");
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      setHata(err?.message || err?.response?.data?.error || "İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-page-card">
        <div className="auth-page-header">
          <h1>{mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}</h1>
          <p>
            {mode === "login"
              ? "Simülasyon alanına erişmek için giriş yapın."
              : "Hızlı kayıt ile proje alanı açın."}
          </p>
        </div>

        {!supabaseHazir && (
          <div className="auth-page-alert auth-page-alert-danger">
            Supabase değişkenleri eksik. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.
          </div>
        )}

        <div className="auth-page-tabs">
          <button
            type="button"
            className={`auth-page-tab ${mode === "login" ? "auth-page-tab-active" : ""}`}
            onClick={() => { setMode("login"); setHata(""); setBasariMesaji(""); }}
          >
            Giriş
          </button>
          <button
            type="button"
            className={`auth-page-tab ${mode === "register" ? "auth-page-tab-active" : ""}`}
            onClick={() => { setMode("register"); setHata(""); setBasariMesaji(""); }}
          >
            Kayıt
          </button>
        </div>

        <form className="auth-page-form" onSubmit={submit}>
          {mode === "register" && (
            <div className="auth-page-field">
              <label htmlFor="auth-fullName">Ad Soyad</label>
              <input
                id="auth-fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Adınız Soyadınız"
                required={mode === "register"}
                autoComplete="name"
              />
            </div>
          )}
          <div className="auth-page-field">
            <label htmlFor="auth-email">E-posta</label>
            <input
              id="auth-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="ornek@mail.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-page-field">
            <label htmlFor="auth-password">Şifre</label>
            <input
              id="auth-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="En az 6 karakter"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {hata && (
            <div className="auth-page-alert auth-page-alert-danger" role="alert">
              {hata}
            </div>
          )}
          {basariMesaji && (
            <div className="auth-page-alert auth-page-alert-success" role="status">
              {basariMesaji}
            </div>
          )}

          <button
            type="submit"
            className="auth-page-submit"
            disabled={loading}
          >
            {loading ? "Bekleyin..." : mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </form>

        <div className="auth-page-footer">
          <button
            type="button"
            className="auth-page-footer-link"
            onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
          >
            {mode === "login" ? "Hesabınız yok mu? Kayıt olun" : "Hesabınız var mı? Giriş yapın"}
          </button>
          <Link to="/" className="auth-page-footer-link">
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
