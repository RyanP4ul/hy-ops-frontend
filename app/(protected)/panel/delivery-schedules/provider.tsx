"use client";

import { DeliveryScheduleRow } from "@/schema/delivery-schedule";
import {
  SessionsAndLogsTableSchemaType,
  WsLogsTableSchemaType,
} from "@/schema/s&l";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

type DeliveryScheduleType = {
  deliveryScheduleQuery: ReturnType<
    typeof useQuery<{
      rows: DeliveryScheduleRow[];
      total: number;
    }>
  >;
  page: { pageIndex: number; pageSize: number };
  setPage: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
};

export const DeliveryScheduleContext =
  createContext<DeliveryScheduleType | null>(null);

export function useDeliverySchedule() {
  const context = useContext(DeliveryScheduleContext);

  if (!context) {
    throw new Error(
      "useDeliverySchedule must be used inside DeliveryScheduleProvider",
    );
  }

  return context;
}

export function DeliveryScheduleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [step, setStep] = useState(0);

  const deliveryScheduleQuery = useQuery({
    queryKey: ["deliveryScheduleQuery", page.pageIndex, page.pageSize, search],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", page.pageIndex.toString());
      url_params.append("limit", page.pageSize.toString());

      if (search && search.trim().length > 0) {
        url_params.append("search", search.trim());
      }

      const response = await fetch(
        `/api/delivery-schedules?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as DeliveryScheduleRow[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
  });

  return (
    <DeliveryScheduleContext.Provider
      value={{
        deliveryScheduleQuery,
        page,
        setPage,
        search,
        setSearch,
        step,
        setStep,
      }}
    >
      {children}
    </DeliveryScheduleContext.Provider>
  );
}
