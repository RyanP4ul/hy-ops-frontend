"use client";

import { request } from "@/components/http";
import { useSetting } from "@/components/providers/setting-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import {
  PaymentFormType,
  PaymentRowType,
  paymentSchema,
} from "@/schema/payment";

type Selected = {
  order_id: number;
  payment_number: string;
  version: number;
};

type PaymentsContext = {
  form: UseFormReturn<PaymentFormType>;
  paymentsQuery: ReturnType<
    typeof useQuery<{ rows: PaymentRowType[]; total: number }>
  >;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  sortBy: { id: string; type: string };
  setSortBy: React.Dispatch<React.SetStateAction<{ id: string; type: string }>>;
  selected: Selected;
  setSelected: React.Dispatch<React.SetStateAction<Selected>>;
};

const PaymentsContext = createContext<PaymentsContext | null>(null);

export function usePayments() {
  const context = useContext(PaymentsContext);
  if (!context)
    throw new Error("usePayments must be used inside PaymentsProvider");
  return context;
}

export function PaymentsProvider({ children }: { children: React.ReactNode }) {
  const { settingQuery } = useSetting();
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState({ id: "id", type: "desc" });
  const [selected, setSelected] = useState<Selected>({
    order_id: -1,
    payment_number: "",
    version: -1,
  });
  const form = useForm<PaymentFormType>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_number: undefined,
      payment_amount: 0,
      version: -1,
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", page.pageIndex, page.pageSize, search, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
        sort_by: `${sortBy.id}:${sortBy.type}`,
      });

      if (search.trim()) params.set("search", search.trim());

      const response = await request("GET", `/api/payments?${params}`);

      if (!response.ok) throw new Error("Failed to fetch payments");

      return {
        rows: (await response.json()) as PaymentRowType[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    refetchInterval: () =>
      Number(settingQuery.data?.refresh_interval_ms.value) || 5000,
    refetchIntervalInBackground: false,
  });

  return (
    <PaymentsContext.Provider
      value={{
        form,
        paymentsQuery,
        page,
        setPage,
        search,
        setSearch,
        sortBy,
        setSortBy,
        selected,
        setSelected,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  );
}
