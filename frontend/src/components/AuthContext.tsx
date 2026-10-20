// AuthContext.tsx — app-wide login state. Mount <AuthProvider> once
// near the app root; everywhere else, call useAuth() (see useAuth.ts).
import React, { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  type CurrentUser,
} from "./authApi";
import { AuthContext } from "./useAuth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { data: user = null, isLoading: loading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  });

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await apiLogin(username, password);
      if (result.ok) {
        queryClient.setQueryData<CurrentUser | null>(["currentUser"], await getCurrentUser());
      }
      return result;
    },
    [queryClient],
  );

  const register = useCallback(async (username: string, password: string) => {
    return apiRegister(username, password);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    queryClient.setQueryData<CurrentUser | null>(["currentUser"], null);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
