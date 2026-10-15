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

type WarehouseContext = {
  form: UseFormReturn<WarehouseForm, any>;
  warehouseQuery: ReturnType<
    typeof useQuery<{
      rows: (WarehouseRow & { version: number })[];
      total: number;
    }>
  >;
  warehouseDetailQuery: ReturnType<typeof useQuery<WarehouseRow | null>>;
  selected: FormSelected;
  setSelected: (warehouse: FormSelected) => void;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  sortBy: { id: string; type: string };
  setSortBy: React.Dispatch<React.SetStateAction<{ id: string; type: string }>>;

  searchAddress: string;
  setSearchAddress: React.Dispatch<React.SetStateAction<string>>;
  geocodeQuery: UseQueryResult<GeocodeResult[] | null, unknown>;

  mapRef: React.RefObject<MapRef | null>;
  latitude: number;
  setLatitude: React.Dispatch<React.SetStateAction<number>>;
  longitude: number;
  setLongitude: React.Dispatch<React.SetStateAction<number>>;
};

const WarehousesContext = createContext<WarehouseContext | null>(null);

export function useWarehouses() {
  const context = useContext(WarehousesContext);
  if (!context)
    throw new Error("useWarehouses must be used inside WarehousesProvider");
  return context;
}

export function WarehousesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settingQuery } = useSetting();

  const [selected, setSelected] = useState<FormSelected>({
    id: -1,
    version: 0,
  });
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const { state, dispatch } = useModal();
  const [sortBy, setSortBy] = useState<{
    id: string;
    type: string;
  }>({ id: "id", type: "desc" });
  const [searchAddress, setSearchAddress] = useState("");
  const mapRef = useRef<MapRef>(null);
  const [latitude, setLatitude] = useState<number>(14.8230797);
  const [longitude, setLongitude] = useState<number>(120.9011564);

  const form = useForm<WarehouseForm>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: "",
      street_address: "",
      city: "",
      state: "",
      zip_code: "",
      search_address: "",
    },
  });

  const warehouseQuery = useQuery({
    queryKey: ["warehouses", page.pageIndex, page.pageSize, search, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
      });

      if (search.trim()) params.set("search", search);
      if (sortBy) params.set("sort_by", `${sortBy.id}:${sortBy.type}`);

      const response = await fetch(`/api/warehouses?${params}`);

      if (!response.ok) throw new Error("Failed to fetch warehouses");

      return {
        rows: (await response.json()) as (WarehouseRow & { version: number })[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    refetchInterval: () =>
      Number(settingQuery.data?.refresh_interval_ms.value) ?? 5000,
    refetchIntervalInBackground: false,
  });

  const warehouseDetailQuery = useQuery({
    queryKey: ["warehouse_detail", selected.id],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request("GET", `/api/warehouses/${selected.id}`);

      if (!response.ok) return null;

      return (await response.json()) as WarehouseRow;
    },
    enabled: selected.id !== -1,
  });

  const geocodeQuery = useQuery({
    queryKey: ["geocode", searchAddress],
    queryFn: async () => {
      const response = await request(
        "GET",
        `/api/geocode/search?q=${encodeURIComponent(searchAddress)}`,
      );

      if (!response.ok) return null;

      const result = (await response.json()) as GeocodeResult[];

      if (result && result.length > 0) {
        console.log("Geocode result for address:", searchAddress, "is", result);
        const newLatitude = Number(result[0].lat);
        const newLongitude = Number(result[0].lon);

        setLatitude(newLatitude);
        setLongitude(newLongitude);

        mapRef.current?.flyTo({
          center: [newLongitude, newLatitude],
          zoom: 16,
          duration: 1000,
        });
      } else {
        console.log("Geocode result for address:", searchAddress, "is", result);
      }

      return result;
    },
    enabled: searchAddress.trim().length > 0,
  });

  return (
    <WarehousesContext.Provider
      value={{
        form,
        warehouseQuery,
        warehouseDetailQuery,
        selected,
        setSelected,
        page,
        setPage,
        search,
        setSearch,
        sortBy,
        setSortBy,
        searchAddress,
        setSearchAddress,
        geocodeQuery,
        mapRef,
        latitude,
        setLatitude,
        longitude,
        setLongitude,
      }}
    >
      {children}
    </WarehousesContext.Provider>
  );
}
