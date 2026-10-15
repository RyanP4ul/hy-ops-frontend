"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { request } from "@/components/http";
import { useModal } from "@/components/providers/modal-provider";
import { useSetting } from "@/components/providers/setting-provider";
import { VehicleForm, VehicleRow, vehicleSchema } from "@/schema/vehicle";
import { DialogMode } from "@/types/dialog";

type VehicleContext = {
  form: UseFormReturn<VehicleForm>;
  vehicleQuery: ReturnType<
    typeof useQuery<{ rows: VehicleRow[]; total: number }>
  >;
  vehicleDetailQuery: ReturnType<typeof useQuery<VehicleRow | null>>;
  selected: { id: number; version: number };
  setSelected: React.Dispatch<
    React.SetStateAction<{ id: number; version: number }>
  >;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  sortBy: { id: string; type: string };
  setSortBy: React.Dispatch<React.SetStateAction<{ id: string; type: string }>>;
};

const VehiclesContext = createContext<VehicleContext | null>(null);
export function useVehicles() {
  const context = useContext(VehiclesContext);
  if (!context)
    throw new Error("useVehicles must be used inside VehiclesProvider");
  return context;
}

export function VehiclesProvider({ children }: { children: React.ReactNode }) {
  const { settingQuery } = useSetting();
  const { state } = useModal();
  const [selected, setSelected] = useState({ id: -1, version: 0 });
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState({ id: "id", type: "desc" });
  const form = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate_number: "",
      status: "available",
      type: "truck",
      image: "",
    },
  });
  const vehicleQuery = useQuery({
    queryKey: ["vehicles", page.pageIndex, page.pageSize, search, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
        sort_by: `${sortBy.id}:${sortBy.type}`,
      });

      if (search.trim()) params.set("search", search);

      const response = await fetch(`/api/vehicles?${params}`);
      if (!response.ok) throw new Error("Failed to fetch vehicles");

      return {
        rows: (await response.json()) as VehicleRow[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    refetchInterval: () =>
      Number(settingQuery.data?.refresh_interval_ms.value) || 30000,
    refetchIntervalInBackground: false,
  });

  const vehicleDetailQuery = useQuery({
    queryKey: ["vehicle_detail", selected.id],
    queryFn: async () => {
      const response = await request("GET", `/api/vehicles/${selected.id}`);
      return response.ok ? ((await response.json()) as VehicleRow) : null;
    },
    enabled: selected.id !== -1 && state.mode === DialogMode.EDIT,
  });

  return (
    <VehiclesContext.Provider
      value={{
        form,
        vehicleQuery,
        vehicleDetailQuery,
        selected,
        setSelected,
        page,
        setPage,
        search,
        setSearch,
        sortBy,
        setSortBy,
      }}
    >
      {children}
    </VehiclesContext.Provider>
  );
}
