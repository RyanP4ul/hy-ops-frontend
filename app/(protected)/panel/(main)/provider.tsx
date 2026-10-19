"use client";

import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useRef, useState } from "react";
import {
  WarehouseForm,
  WarehouseRow,
  warehouseSchema,
} from "@/schema/warehouse";
import { request } from "@/components/http";
import { useForm, UseFormReturn } from "react-hook-form";
import { useModal } from "@/components/providers/modal-provider";
import { toast } from "sonner";
import { useSetting } from "@/components/providers/setting-provider";
import { GeocodeResult } from "@/types/geocode";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogMode } from "@/types/dialog";
import { MapRef } from "@/components/ui/map";

type DashboardContext = {
  dashboardQuery: UseQueryResult<any, unknown>;
};

const DashboardContext = createContext<DashboardContext | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context)
    throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}

export function DashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard_query"],
    queryFn: async () => {
      const response = await request("GET", `/api/dashboard/stats`);

      if (!response.ok) return null;

      const result = await response.json();

      return result;
    },
  });

  return (
    <DashboardContext.Provider
      value={{
        dashboardQuery,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
