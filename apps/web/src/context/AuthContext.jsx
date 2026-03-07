import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login, register, setAuthToken } from "../api/client";

const AuthContext = createContext(null);
const STORAGE_KEY = "solarbatarya_token";
const LEGACY_TOKEN_KEY = "authToken";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!token) {
        setAuthToken(null);
        setLoading(false);
        return;
      }
      try {
        setAuthToken(token);
        localStorage.setItem(LEGACY_TOKEN_KEY, token);
        const me = await getMe();
        setUser(me);
      } catch (_err) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        setAuthToken(null);
        setToken("");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token]);

  async function girisYap(payload) {
    const sonuc = await login(payload);
    localStorage.setItem(STORAGE_KEY, sonuc.token);
    localStorage.setItem(LEGACY_TOKEN_KEY, sonuc.token);
    setToken(sonuc.token);
    setAuthToken(sonuc.token);
    setUser(sonuc.user);
    return sonuc.user;
  }

  async function kayitOl(payload) {
    const sonuc = await register(payload);
    localStorage.setItem(STORAGE_KEY, sonuc.token);
    localStorage.setItem(LEGACY_TOKEN_KEY, sonuc.token);
    setToken(sonuc.token);
    setAuthToken(sonuc.token);
    setUser(sonuc.user);
    return sonuc.user;
  }

  function cikisYap() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    setAuthToken(null);
    setToken("");
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
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
