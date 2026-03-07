import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, supabaseHazir } from "../lib/supabase";

const AuthContext = createContext(null);
const STORAGE_KEY = "solarbatarya_token";
const LEGACY_TOKEN_KEY = "authToken";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function mapSupabaseUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    fullName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Kullanici",
    email: user.email || "",
    role: user.user_metadata?.role || "user"
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function syncSession(session) {
    const oturumToken = session?.access_token || "";
    if (oturumToken) {
      localStorage.setItem(STORAGE_KEY, oturumToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, oturumToken);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    setToken(oturumToken);
    setUser(mapSupabaseUser(session?.user || null));
  }

  useEffect(() => {
    async function init() {
      if (!supabaseHazir || !supabase) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        setToken("");
        setUser(null);
        setLoading(false);
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      syncSession(session);
      setLoading(false);
    }

    init();

    if (!supabaseHazir || !supabase) {
      return () => {};
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function girisYap({ email, password }) {
    if (!supabaseHazir || !supabase) {
      throw new Error("Supabase ayarlari eksik. VITE_SUPABASE_ANON_KEY tanimlayin.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: String(password || "")
    });
    if (error) {
      throw new Error(error.message || "Giris basarisiz.");
    }
    syncSession(data.session);
    return mapSupabaseUser(data.user);
  }

  async function kayitOl({ fullName, email, password }) {
    if (!supabaseHazir || !supabase) {
      throw new Error("Supabase ayarlari eksik. VITE_SUPABASE_ANON_KEY tanimlayin.");
    }
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password: String(password || ""),
      options: {
        data: {
          full_name: String(fullName || "").trim()
        }
      }
    });
    if (error) {
      throw new Error(error.message || "Kayit basarisiz.");
    }
    if (!data.session) {
      throw new Error("Kayit olustu. Lutfen e-posta adresinize gelen dogrulama baglantisini onaylayin.");
    }
    syncSession(data.session);
    return mapSupabaseUser(data.user);
  }

  async function cikisYap() {
    if (supabaseHazir && supabase) {
      await supabase.auth.signOut();
    }
    syncSession(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      supabaseHazir,
      isAuthenticated: Boolean(token && user),
      girisYap,
      kayitOl,
      cikisYap
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth sadece AuthProvider altinda kullanilabilir.");
  }
  return context;
}
