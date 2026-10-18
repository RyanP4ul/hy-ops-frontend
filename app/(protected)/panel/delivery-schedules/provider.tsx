"use client";

import { useComboBoxPagination } from "@/components/base-pagination";
import { request } from "@/components/http";
import {
  DeliveryScheduleFormData,
  DeliveryScheduleOrderDetail,
  DeliveryScheduleRow,
  deliveryScheduleSchema,
} from "@/schema/delivery-schedule";
import {
  SessionsAndLogsTableSchemaType,
  WsLogsTableSchemaType,
} from "@/schema/s&l";
import { DialogMode } from "@/types/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { useForm } from "react-hook-form";

type SubType = {
  id?: number;
  is_open: boolean;
  mode: DialogMode;
};

type DeliveryScheduleType = {
  deliveryScheduleQuery: ReturnType<
    typeof useQuery<{
      rows: DeliveryScheduleRow[];
      total: number;
    }>
  >;
  form: ReturnType<typeof useForm<DeliveryScheduleFormData>>;
  page: { pageIndex: number; pageSize: number };
  setPage: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;

  orderCB: ReturnType<typeof useComboBoxPagination>;
  driverCB: ReturnType<typeof useComboBoxPagination>;
  vehicleCB: ReturnType<typeof useComboBoxPagination>;

  orderQuery: ReturnType<
    typeof useQuery<{
      rows: any[];
      total: number;
    }>
  >;

  orderDetailQuery: ReturnType<
    typeof useQuery<DeliveryScheduleOrderDetail[] | null>
  >;

  availableDateQuery: ReturnType<
    typeof useQuery<
      {
        date: string;
        available_slots: number;
      }[]
    >
  >;

  driverQuery: ReturnType<
    typeof useQuery<{
      rows: any[];
      total: number;
    }>
  >;

  vehicleQuery: ReturnType<
    typeof useQuery<{
      rows: any[];
      total: number;
    }>
  >;

  sub: SubType;
  setSub: Dispatch<SetStateAction<SubType>>;
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

  const [sub, setSub] = useState<SubType>({
    id: -1,
    is_open: false,
    mode: DialogMode.DEFAULT,
  });

  const orderCB = useComboBoxPagination();
  const driverCB = useComboBoxPagination();
  const vehicleCB = useComboBoxPagination();

  const form = useForm<DeliveryScheduleFormData>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      order_ids: [],
      scheduled_date: undefined,
      scheduled_time: "",
      delivery_type: "INTERNAL",
      driver_id: -1,
      vehicle_id: -1,
    },
  });

  const order_ids = form.watch("order_ids");

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

  const orderQuery = useQuery({
    queryKey: ["order", orderCB.page],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", orderCB.page.toString());
      url_params.append("limit", "10");

      if (orderCB.searchQuery.trim().length > 0) {
        url_params.append("search", orderCB.searchQuery);
      }

      const response = await fetch(`/api/orders/cb?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch drivers");
      }

      const result = await response.json();

      orderCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },

    enabled: step === 0 && orderCB.open,
  });

  const orderDetailQuery = useQuery({
    queryKey: ["order_detail", order_ids],
    queryFn: async () => {
      if (!order_ids || order_ids.length === 0) return null;

      const response = await request(
        "GET",
        `/api/orders/details?ids=${order_ids.join(",")}`,
      );

      if (!response.ok) return null;

      const rows = (await response.json()) as DeliveryScheduleOrderDetail[];
      const rowsById = new Map(rows.map((row) => [row.id, row]));

      return order_ids
        .map((orderId) => rowsById.get(orderId))
        .filter((row): row is DeliveryScheduleOrderDetail => row !== undefined);
    },
    enabled: order_ids.length > 0,
  });

  const availableDateQuery = useQuery({
    queryKey: ["availableDateQuery"],

    queryFn: async () => {
      const response = await fetch(`/api/delivery-schedules`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return await response.json();
    },
  });

  const driverQuery = useQuery({
    queryKey: ["drivers", driverCB.page],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", driverCB.page.toString());
      url_params.append("limit", "10");

      if (driverCB.searchQuery.trim().length > 0) {
        url_params.append("search", driverCB.searchQuery);
      }

      const response = await fetch(
        `/api/users/drivers?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch drivers");
      }

      const result = await response.json();

      driverCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },

    enabled: step === 2,
  });

  const vehicleQuery = useQuery({
    queryKey: ["vehicles", vehicleCB.page],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", vehicleCB.page.toString());
      url_params.append("limit", "10");

      if (vehicleCB.searchQuery.trim().length > 0) {
        url_params.append("search", vehicleCB.searchQuery);
      }

      const response = await fetch(`/api/vehicles/cb?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch drivers");
      }

      const result = await response.json();

      driverCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },

    enabled: step === 2,
  });

  return (
    <DeliveryScheduleContext.Provider
      value={{
        deliveryScheduleQuery,
        form,
        page,
        setPage,
        search,
        setSearch,
        step,
        setStep,
        orderCB,
        driverCB,
        vehicleCB,
        orderQuery,
        orderDetailQuery,
        availableDateQuery,
        driverQuery,
        vehicleQuery,
        sub,
        setSub,
      }}
    >
      {children}
    </DeliveryScheduleContext.Provider>
  );
}
