// AuthContext.tsx — app-wide login state. Mount <AuthProvider> once
// near the app root (SongPoolProvider is the existing sibling for
// this pattern); everywhere else, call useAuth() (see useAuth.ts).
import React, { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  type CurrentUser,
} from "./authApi";
import { AuthContext } from "./useAuth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    if (result.ok) setUser(await getCurrentUser());
    return result;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    return apiRegister(email, password);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
