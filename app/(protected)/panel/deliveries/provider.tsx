"use client";
import { useSearchParams } from "next/navigation";

import { useSetting } from "@/components/providers/setting-provider";
import { useComboBoxPagination } from "@/components/base-pagination";
import {
  DeliveriesEventForm,
  DeliveriesEventFormType,
  DeliveriesAssignmentForm,
  DeliveriesAssignmentFormType,
  DeliveriesRow,
} from "@/schema/deliveries";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { useForm } from "react-hook-form";

type DeliveriesContext = {
  deliveriesQuery: ReturnType<
    typeof useQuery<{
      rows: DeliveriesRow[];
      total: number;
    }>
  >;
  event_form: ReturnType<typeof useForm<DeliveriesEventFormType>>;
  assignment_form: ReturnType<
    typeof useForm<DeliveriesAssignmentFormType>
  >;
  assignmentWarehouseId: number;
  setAssignmentWarehouseId: React.Dispatch<React.SetStateAction<number>>;
  driversQuery: UseQueryResult<DriverQueryData, Error>;
  vehiclesQuery: UseQueryResult<VehicleQueryData, Error>;
  driverCB: ReturnType<typeof useComboBoxPagination>;
  vehicleCB: ReturnType<typeof useComboBoxPagination>;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
};

type DriverQueryData = {
  rows: { id: number; name: string }[];
  total: number;
};

type VehicleQueryData = {
  rows: { id: number; plate_number: string; type: string }[];
  total: number;
};

const DeliveriesContext = createContext<DeliveriesContext | null>(null);

export function useDeliveries() {
  const context = useContext(DeliveriesContext);
  if (!context)
    throw new Error("useDeliveries must be used inside DeliveriesProvider");
  return context;
}

export function DeliveriesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settingQuery } = useSetting();
  const filters = useSearchParams();
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [assignmentWarehouseId, setAssignmentWarehouseId] = useState(-1);
  const driverCB = useComboBoxPagination();
  const vehicleCB = useComboBoxPagination();

  const event_form = useForm<DeliveriesEventFormType>({
    resolver: zodResolver(DeliveriesEventForm),
    defaultValues: {
      delivery_id: -1,
      event_type: "CANCELLED",
      reason: "",
    },
  });

  const assignment_form = useForm<DeliveriesAssignmentFormType>({
    resolver: zodResolver(DeliveriesAssignmentForm),
    defaultValues: {
      delivery_id: -1,
      driver_id: -1,
      vehicle_id: -1,
      delivery_version: -1,
    },
  });

  const assignmentQueryOptions = {
    enabled: assignmentWarehouseId > 0,
  };

  const driversQuery = useQuery<DriverQueryData>({
    queryKey: ["delivery-assignment-drivers", assignmentWarehouseId, driverCB.page, driverCB.searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(driverCB.page),
        limit: "10",
        warehouse_id: String(assignmentWarehouseId),
        search: driverCB.searchQuery,
      });
      const response = await fetch(
        `/api/users/drivers?${params}`,
      );
      if (!response.ok) throw new Error("Failed to fetch drivers");
      return (await response.json()) as DriverQueryData;
    },
    ...assignmentQueryOptions,
  });

  const vehiclesQuery = useQuery<VehicleQueryData>({
    queryKey: ["delivery-assignment-vehicles", assignmentWarehouseId, vehicleCB.page, vehicleCB.searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(vehicleCB.page),
        limit: "10",
        warehouse_id: String(assignmentWarehouseId),
        search: vehicleCB.searchQuery,
      });
      const response = await fetch(
        `/api/vehicles/cb?${params}`,
      );
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      return (await response.json()) as VehicleQueryData;
    },
    ...assignmentQueryOptions,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", page.pageIndex, page.pageSize, search, filters.get("status"), filters.get("overdue"), filters.get("active")],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
      });

      if (search.trim()) params.set("search", search);
      if (filters.get("status")) params.set("status", filters.get("status")!);
      if (filters.get("active") === "true") params.set("active", "true");
      if (filters.get("overdue") === "true") params.set("overdue", "true");

      const response = await fetch(`/api/deliveries?${params}`);

      if (!response.ok) throw new Error("Failed to fetch deliveries");

      return {
        rows: await response.json(),
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    refetchInterval: () =>
      Number(settingQuery.data?.refresh_interval_ms.value) ?? 5000,
    refetchIntervalInBackground: false,
  });

  return (
    <DeliveriesContext.Provider
      value={{
        deliveriesQuery,
        event_form,
        assignment_form,
        assignmentWarehouseId,
        setAssignmentWarehouseId,
        driversQuery,
        vehiclesQuery,
        driverCB,
        vehicleCB,
        page,
        setPage,
        search,
        setSearch,
      }}
    >
      {(filters.get("status") || filters.get("overdue") || filters.get("active")) && <p className="rounded-lg border p-3 text-sm">Dashboard filter: {filters.get("overdue") === "true" ? "Overdue scheduled deliveries" : filters.get("active") === "true" ? "Active deliveries (scheduled, in transit and returning)" : filters.get("status")} · <a href="/panel/deliveries" className="underline">Clear filter</a></p>}
      {children}
    </DeliveriesContext.Provider>
  );
}
