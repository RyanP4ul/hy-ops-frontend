"use client";

import { useEffect } from "react";
import { loadUser } from "@/lib/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    loadUser();
  }, []);

  return <>{children}</>;
}
