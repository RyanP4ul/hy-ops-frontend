import { AuthUser } from "@/types/auth-user";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { request } from "../http";

type ContextType = {
  userQuery: ReturnType<typeof useQuery<AuthUser | null>>;
};

export const AuthContext = createContext<ContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const userQuery = useQuery({
    queryKey: ["user_query"],
    queryFn: async () => {
      const response = await request("GET", `/api/auth/me`);

      if (!response.ok) return null;

      return (await response.json()) as AuthUser;
    },
  });

  return (
    <AuthContext.Provider value={{ userQuery }}>
      {children}
    </AuthContext.Provider>
  );
}
