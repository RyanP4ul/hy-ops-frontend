"use client";
import { useSearchParams } from "next/navigation";

import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import {
  OrderDetail,
  OrderForm,
  OrderItemDetail,
  OrderRow,
  orderSchema,
} from "@/schema/order";
import { request } from "@/components/http";
import { useForm, useWatch, UseFormReturn } from "react-hook-form";
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
type CustomerAddress = {
  id: number;
  customer_id: number;
  address_line: string;
  barangay: string;
  city_municipality: string;
  province: string;
  postal_code: string | null;
};
type CustomerOption = {
  id: number;
  name: string;
  company_name: string;
  phone_number: string;
  addresses: CustomerAddress[];
};

export type CustomerOrderEligibility = {
  eligible: boolean;
  reasonCode: "CUSTOMER_ORDER_LIMIT_REACHED" | null;
  activeOrderCount: number;
  maxActiveOrders: number;
  checkedAt: string;
  message: string | null;
};

type OrdersContext = {
  startOrder: () => void;
  send: (data: unknown) => void;
  form: UseFormReturn<OrderForm>;
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
  orderViewQuery: ReturnType<typeof useQuery<OrderDetail | null>>;
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

  warehouseCB: ReturnType<typeof useComboBoxPagination>;
  customerCB: ReturnType<typeof useComboBoxPagination>;
  inventoryCB: ReturnType<typeof useComboBoxPagination>;

  warehouseQuery: UseQueryResult<{
    rows: { id: number; name: string }[];
    total: number;
  }>;

  customerQuery: ReturnType<
    typeof useQuery<{
      rows: CustomerOption[];
      total: number;
    }>
  >;
  customerOrderEligibility: UseQueryResult<CustomerOrderEligibility>;
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
  const { state } = useModal();
  const { settingQuery } = useSetting();
  const filters = useSearchParams();
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

  const warehouseCB = useComboBoxPagination();
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
      warehouse_id: -1,
      customer_id: -1,
      delivery_type: "INTERNAL",
      payment_arrangement: "NET_30",
      payment_method: "BANK_TRANSFER",
      notes: "",
      is_custom_shipping: false,
      customer_address_id: undefined,
      items: [],
      amount_paid: 0,
    },
  });

  const selectedWarehouseId = useWatch({ control: form.control, name: "warehouse_id" });

  const ordersQuery = useQuery({
    queryKey: [
      "orders",
      page.pageIndex,
      page.pageSize,
      search,
      deliveryType,
      filters.get("status"),
      sortBy,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
      });

      if (search.trim()) params.set("search", search);
      if (filters.get("status")) params.set("status", filters.get("status")!);
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
      Number(settingQuery.data?.refresh_interval_ms.value) || 5000,
    refetchIntervalInBackground: false,
  });

  const orderDetailQuery = useQuery({
    queryKey: ["order_detail", selected.id],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request("GET", `/api/orders/${selected.id}`);

      if (!response.ok) throw new Error("Unable to load this order. Close the dialog and try again.");

      return (await response.json()) as OrderDetail;
    },
    enabled: state.isOpen && state.mode !== DialogMode.INSERT && selected.id > 0,
  });

  const orderItemDetailQuery = useQuery({
    queryKey: ["order_item_detail", inventoryItem],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request(
        "GET",
        `/api/inventory/details?ids=${inventoryItem.map((item) => item.inventory_id).join(",")}`,
      );

      if (!response.ok) throw new Error("Unable to load available item details.");

      return (await response.json()) as (OrderItemDetail & {
        inventory_id: number;
      })[];
    },
    enabled: inventoryItem.length > 0,
  });

  const warehouseQuery = useQuery({
    queryKey: ["warehouses", "order-options", warehouseCB.page],
    queryFn: async () => {
      const response = await request("GET", `/api/warehouses/names?page=${warehouseCB.page}&limit=10`);
      if (!response.ok) throw new Error("Unable to load warehouses.");
      const result = await response.json(); warehouseCB.setTotalPages(Math.max(1, Math.ceil(result.total / 10)));
      return result;
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory_query", selectedWarehouseId, inventoryCB.page],
    queryFn: async () => {
      const response = await request("GET", `/api/inventory/names?warehouse_id=${selectedWarehouseId}&page=${inventoryCB.page}&limit=10`);
      if (!response.ok) throw new Error("Unable to load available stock.");
      const result = await response.json(); inventoryCB.setTotalPages(Math.max(1, Math.ceil(result.total / 10)));
      return result;
    },
    enabled: selectedWarehouseId > 0,
  });

  const orderViewQuery = useQuery({
    queryKey: ["order_view", viewOrderId],
    queryFn: async () => {
      if (viewOrderId < 0) return null;

      const response = await request("GET", `/api/orders/${viewOrderId}`);

      if (!response.ok) throw new Error("Unable to load this order. Close the dialog and try again.");

      return (await response.json()) as OrderDetail;
    },
    enabled: state.isOpen && state.mode === DialogMode.VIEW && viewOrderId > 0,
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

      return result as { rows: CustomerOption[]; total: number };
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const customerOrderEligibility = useQuery({
    queryKey: ["customer-order-eligibility", selectedCustomerId],
    queryFn: async () => {
      const response = await request(
        "GET",
        `/api/orders/eligibility/${selectedCustomerId}`,
      );
      const result =
        (await response.json()) as CustomerOrderEligibility & {
          message?: string;
        };

      if (!response.ok) {
        throw new Error(result.message || "Unable to check customer eligibility.");
      }

      return result;
    },
    enabled: Number.isSafeInteger(selectedCustomerId) && selectedCustomerId > 0,
    staleTime: 15_000,
  });

  const viewOrder = (orderId: number) => {
    setViewOrderId(orderId);
  };

  const startOrder = () => {
    form.reset({ warehouse_id: -1, customer_id: -1, delivery_type: "INTERNAL", payment_arrangement: "NET_30", payment_method: "BANK_TRANSFER", notes: "", is_custom_shipping: false, customer_address_id: undefined, shipping_recipient: undefined, shipping_phone: undefined, shipping_address: undefined, shipping_latitude: undefined, shipping_longitude: undefined, items: [], amount_paid: 0 });
    setStep(0); setSelected({ id: -1, version: 0 }); setInventoryItem([]); setSub({ is_open: false, mode: DialogMode.DEFAULT });
    for (const combo of [warehouseCB, customerCB, inventoryCB]) { combo.setInputValue(""); combo.setPage(0); combo.setOpen(false); }
  };

  return (
    <OrdersContext.Provider
      value={{
        startOrder,
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
        warehouseCB,
        customerCB,
        inventoryCB,
        warehouseQuery,
        customerQuery,
        customerOrderEligibility,
        sub,
        setSub,
        orderItemDetailQuery,
        inventoryItem,
        setInventoryItem,
      }}
    >
      {(filters.get("status") || filters.get("stock_status") || filters.get("overdue")) && <p className="rounded-lg border p-3 text-sm">Dashboard filter: {filters.get("overdue") === "true" ? "Overdue scheduled deliveries" : filters.get("status") ?? filters.get("stock_status")} ? <a href="/panel/orders" className="underline">Clear filter</a></p>}
      {children}
    </OrdersContext.Provider>
  );
}
