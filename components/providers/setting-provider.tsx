"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import React, { createContext, useContext } from "react";
import { SettingSchema } from "@/schema/setting";

type Result = Record<
  | "low_stock_threshold"
  | "high_stock_threshold"
  | "refresh_interval_ms"
  | "is_form_validation_debug_enabled",
  {
    id: number;
    name: string;
    value: string;
    version: number;
  }
>;

type SettingContextType = {
  settingQuery: UseQueryResult<Result, unknown>;
  isModified: boolean;
  setIsModified: React.Dispatch<React.SetStateAction<boolean>>;
  completeCallback?: () => void;
};

export const SettingContext = createContext<SettingContextType | null>(null);

export function useSetting() {
  const context = useContext(SettingContext);

  if (!context) {
    throw new Error("useSetting must be used inside SettingProvider");
  }

  return context;
}

export function SettingProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["setting"],

    queryFn: async () => {
      const response = await fetch(`/api/settings`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return (await response.json()) as Result;
    },
  });

  const [isModified, setIsModified] = React.useState(false);

  return (
    <SettingContext.Provider
      value={{ settingQuery: query, isModified, setIsModified }}
    >
      {children}
    </SettingContext.Provider>
  );
}
