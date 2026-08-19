import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginLender, registerLender } from "../api/authApi";
import { setUnauthorizedHandler } from "../api/client";

const TOKEN_KEY = "hisabkitab_token";
const LENDER_KEY = "hisabkitab_lender";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [lender, setLender] = useState(() => {
    const stored = localStorage.getItem(LENDER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  // Tracks whether we've finished restoring auth state on first load,
  // so ProtectedRoute doesn't flash a redirect before we're ready.
  const [ready, setReady] = useState(true);

  const persistSession = (newToken, newLender) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(LENDER_KEY, JSON.stringify(newLender));
    setToken(newToken);
    setLender(newLender);
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LENDER_KEY);
    setToken(null);
    setLender(null);
  };

  const login = async (email, password) => {
    const data = await loginLender({ email, password });
    persistSession(data.token, data.lender);
    return data.lender;
  };

  const register = async (payload) => {
    const data = await registerLender(payload);
    persistSession(data.token, data.lender);
    return data.lender;
  };

  const logout = () => {
    clearSession();
  };

  useEffect(() => {
    // If any API call comes back 401 (expired/invalid token), drop the
    // session so ProtectedRoute sends the lender back to /login.
    setUnauthorizedHandler(() => {
      clearSession();
    });
    setReady(true);
  }, []);

  const value = useMemo(
    () => ({
      token,
      lender,
      isAuthenticated: Boolean(token),
      ready,
      login,
      register,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, lender, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
