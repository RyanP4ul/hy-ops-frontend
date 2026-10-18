"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import {
  OrderDetail,
  OrderForm,
  OrderItemDetail,
  OrderRow,
  orderSchema,
} from "@/schema/order";
import { request } from "@/components/http";
import { useForm, UseFormReturn } from "react-hook-form";
import { useModal } from "@/components/providers/modal-provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetting } from "@/components/providers/setting-provider";
import { useComboBoxPagination } from "@/components/base-pagination";
import { DialogMode } from "@/types/dialog";

type FormSelected = {
  id: number;
  version: number;
};

type SubType = {
  id?: number;
  is_open: boolean;
  mode: DialogMode;
};

type InventoryItem = { inventory_id: number; quantity: number };

type OrdersContext = {
  send: (data: unknown) => void;
  form: UseFormReturn<OrderForm, any>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  ordersQuery: ReturnType<
    typeof useQuery<{
      rows: (OrderRow & { version: number })[];
      total: number;
    }>
  >;
  orderDetailQuery: ReturnType<typeof useQuery<OrderDetail | null>>;
  inventoryQuery: ReturnType<
    typeof useQuery<{
      rows: { id: number; sku: string; name: string; quantity: number }[];
      total: number;
    }>
  >;
  orderViewQuery: ReturnType<typeof useQuery<OrderRow | null>>;
  productVariantsQuery: ReturnType<
    typeof useQuery<{
      rows: {
        id: number;
        name: string;
        sku: string;
        price: string;
        product_id: number;
      }[];
      total: number;
    }>
  >;
  selected: FormSelected;
  setSelected: (order: FormSelected) => void;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  sortBy: { id: string; type: string };
  setSortBy: React.Dispatch<React.SetStateAction<{ id: string; type: string }>>;
  deliveryType: string;
  setDeliveryType: React.Dispatch<React.SetStateAction<string>>;
  viewOrder: (orderId: number) => void;
  viewOrderId: number;

  customerCB: ReturnType<typeof useComboBoxPagination>;
  inventoryCB: ReturnType<typeof useComboBoxPagination>;
  customerQuery: ReturnType<
    typeof useQuery<{
      rows: {
        id: number;
        name: string;
        address: string;
        company_name: string;
      }[];
      total: number;
    }>
  >;
  sub: SubType;
  setSub: React.Dispatch<React.SetStateAction<SubType>>;
  orderItemDetailQuery: ReturnType<
    typeof useQuery<(OrderItemDetail & { inventory_id: number })[] | null>
  >;
  inventoryItem: InventoryItem[];
  setInventoryItem: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
};

const OrdersContext = createContext<OrdersContext | null>(null);

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used inside OrdersProvider");
  return context;
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { settingQuery } = useSetting();
  const { send } = useWebSocket();
  const [step, setStep] = useState<number>(0);
  const [selected, setSelected] = useState<FormSelected>({
    id: -1,
    version: 0,
  });
  const [viewOrderId, setViewOrderId] = useState<number>(-1);
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [deliveryType, setDeliveryType] = useState("ALL");
  const [sortBy, setSortBy] = useState<{ id: string; type: string }>({
    id: "id",
    type: "desc",
  });

  const [sub, setSub] = useState<SubType>({
    id: -1,
    is_open: false,
    mode: DialogMode.DEFAULT,
  });

  const customerCB = useComboBoxPagination();
  const inventoryCB = useComboBoxPagination();

  const [inventoryItem, setInventoryItem] = useState<InventoryItem[]>([]);

  const form = useForm<
    OrderForm & {
      items: OrderItemDetail[];
    }
  >({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: 0,
      delivery_type: "INTERNAL",
      payment_arrangement: "NET_30",
      payment_method: "BANK_TRANSFER",
      notes: "",
      is_custom_shipping: false,
      items: [],
      amount_paid: 0,
    },
  });

  const ordersQuery = useQuery({
    queryKey: [
      "orders",
      page.pageIndex,
      page.pageSize,
      search,
      deliveryType,
      sortBy,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
      });

      if (search.trim()) params.set("search", search);
      if (deliveryType && deliveryType !== "ALL")
        params.set("delivery_type", deliveryType);
      if (sortBy) params.set("sort_by", `${sortBy.id}:${sortBy.type}`);

      const response = await fetch(`/api/orders?${params}`);

      if (!response.ok) throw new Error("Failed to fetch orders");

      return {
        rows: (await response.json()) as (OrderRow & { version: number })[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    refetchInterval: () =>
      Number(settingQuery.data?.refresh_interval_ms.value) ?? 5000,
    refetchIntervalInBackground: false,
  });

  const orderDetailQuery = useQuery({
    queryKey: ["order_detail", selected.id],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request("GET", `/api/orders/${selected.id}`);

      if (!response.ok) return null;

      return (await response.json()) as OrderDetail;
    },
    enabled: selected.id !== -1,
  });

  const orderItemDetailQuery = useQuery({
    queryKey: ["order_item_detail", inventoryItem],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request(
        "GET",
        `/api/inventory/details?ids=${inventoryItem.map((item) => item.inventory_id).join(",")}`,
      );

      if (!response.ok) return null;

      return (await response.json()) as (OrderItemDetail & {
        inventory_id: number;
      })[];
    },
    enabled: inventoryItem.length > 0,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory_query"],
    queryFn: async () => {
      const response = await fetch("/api/inventory/names");
      return await response.json();
    },
  });

  const orderViewQuery = useQuery({
    queryKey: ["order_view", viewOrderId],
    queryFn: async () => {
      if (viewOrderId < 0) return null;

      const response = await request("GET", `/api/orders/${viewOrderId}`);

      if (!response.ok) return null;

      return (await response.json()) as OrderRow;
    },
    enabled: viewOrderId > 0,
  });

  const productVariantsQuery = useQuery({
    queryKey: ["product_variants", viewOrderId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "0",
        limit: "50",
      });

      const response = await fetch(`/api/product_variants?${params}`);

      if (!response.ok) throw new Error("Failed to fetch product variants");

      return (await response.json()) as {
        rows: {
          id: number;
          name: string;
          sku: string;
          price: string;
          product_id: number;
        }[];
        total: number;
      };
    },
    enabled: viewOrderId > 0,
  });

  const customerQuery = useQuery({
    queryKey: ["customer_query", customerCB.page],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", customerCB.page.toString());
      url_params.append("limit", "10");

      // MAYBE IN THE FUTURE KAPAG HINDI AKO TINAMAD
      // if (customerCB.searchQuery.trim().length > 0) {
      //   url_params.append("search", customerCB.searchQuery);
      // }

      const response = await fetch(
        `/api/users/customers?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch product variants");
      }

      const result = await response.json();

      customerCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },
  });

  const viewOrder = (orderId: number) => {
    setViewOrderId(orderId);
  };

  return (
    <OrdersContext.Provider
      value={{
        send,
        form,
        step,
        setStep,
        ordersQuery,
        orderDetailQuery,
        inventoryQuery,
        orderViewQuery,
        productVariantsQuery,
        selected,
        setSelected,
        viewOrder,
        viewOrderId,
        page,
        setPage,
        search,
        setSearch,
        sortBy,
        setSortBy,
        deliveryType,
        setDeliveryType,
        customerCB,
        inventoryCB,
        customerQuery,
        sub,
        setSub,
        orderItemDetailQuery,
        inventoryItem,
        setInventoryItem,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}
