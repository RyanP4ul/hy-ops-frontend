"use client";

import { useSetting } from "@/components/providers/setting-provider";
import {
  DeliveriesEventForm,
  DeliveriesEventFormType,
} from "@/schema/deliveries";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { useForm } from "react-hook-form";

type SelectedType = {
  id: number;
  version: number;
};

type DeliveriesContext = {
  deliveriesQuery: ReturnType<
    typeof useQuery<{
      rows: any[];
      total: number;
    }>
  >;
  event_form: ReturnType<typeof useForm<DeliveriesEventFormType>>;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
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
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");

  const event_form = useForm<DeliveriesEventFormType>({
    resolver: zodResolver(DeliveriesEventForm),
    defaultValues: {
      delivery_id: -1,
      event_type: "CANCELLED",
      reason: "",
    },
  });

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", page.pageIndex, page.pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
      });

      if (search.trim()) params.set("search", search);

      const response = await fetch(`/api/deliveries?${params}`);

      if (!response.ok) throw new Error("Failed to fetch orders");

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
        page,
        setPage,
        search,
        setSearch,
      }}
    >
      {children}
    </DeliveriesContext.Provider>
  );
}
