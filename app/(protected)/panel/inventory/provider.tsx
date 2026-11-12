"use client";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { useSearchParams } from "next/navigation";

import { useComboBoxPagination } from "@/components/base-pagination";
import { InventoryTableSchemaType, InventoryType } from "@/schema/inventory";
import { ProductType } from "@/schema/product";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { PaginationState } from "@tanstack/react-table";
import { addDays } from "date-fns";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";

type StockStatus = "All" | "High" | "Low" | "Out";

type InventoryDetail = {
  id: number;
  version: number;
};

type InventoryContextType = {
  setVariantWarehouseId: Dispatch<SetStateAction<number>>;
  inventoryQuery: UseQueryResult<{
    rows: InventoryTableSchemaType[];
    total: number;
  }>;
  warehouseQuery: UseQueryResult<{
    rows: { id: number; name: string }[];
    total: number;
  }>;
  productVariantQuery: UseQueryResult<{
    rows: { id: number; sku: string; price: number; product_id: number }[];
    total: number;
  }>;
  inventoryDetailQuery: UseQueryResult<
    | (InventoryType & { warehouse_name: string; product_variant_sku: string })
    | undefined
  >;
  setPagination: Dispatch<SetStateAction<PaginationState>>;

  pageIndex: number;
  pageSize: number;

  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;

  inventoryDetail: InventoryDetail;
  setInventoryDetail: Dispatch<SetStateAction<InventoryDetail>>;

  stockStatus: StockStatus;
  setStockStatus: Dispatch<SetStateAction<StockStatus>>;

  warehouseId: number | null;
  setWarehouseId: Dispatch<SetStateAction<number | null>>;

  createInventory: (data: InventoryType) => Promise<void>;

  updateInventory: (inventory_id: number, data: InventoryType & { version: number }) => Promise<void>;

  warehouseCB: ReturnType<typeof useComboBoxPagination>;
  productVariantCB: ReturnType<typeof useComboBoxPagination>;

  dateRange: DateRange | undefined;
  setDateRange: Dispatch<SetStateAction<DateRange | undefined>>;
};

export const InventoryContext = createContext<InventoryContextType | null>(
  null,
);

export function useInventory() {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error("useInventory must be used inside InventoryProvider");
  }

  return context;
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { send } = useWebSocket();
  const queryClient = useQueryClient();
  const [variantWarehouseId, setVariantWarehouseId] = useState(0);
  const { state } = useModal();
  const filters = useSearchParams();
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inventoryDetail, setInventoryDetail] = useState<InventoryDetail>({
    id: -1,
    version: 0,
  });
  const [stockStatus, setStockStatus] = useState<StockStatus>(() => { const value = filters.get("stock_status"); return value === "Low" || value === "Out" || value === "High" ? value : "All"; });
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  // {
  //   from: new Date(new Date().getFullYear(), 0, 12),
  //   to: addDays(new Date(new Date().getFullYear(), 0, 12), 30),
  // }

  const warehouseCB = useComboBoxPagination();
  const productVariantCB = useComboBoxPagination();

  const inventoryQuery = useQuery({
    queryKey: [
      "inventory",
      pageIndex,
      pageSize,
      searchQuery,
      stockStatus,
      warehouseId,
      dateRange,
    ],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", pageIndex.toString());
      url_params.append("limit", pageSize.toString());

      if (searchQuery && searchQuery.trim().length > 0) {
        url_params.append("search", searchQuery);
      }

      if (warehouseId && warehouseId !== null) {
        url_params.append("warehouse_id", warehouseId.toString());
      }

      if (dateRange && dateRange !== undefined) {
        if (dateRange.from) {
          url_params.append("from", dateRange.from.getTime().toString());
        }
        if (dateRange.to) {
          url_params.append("to", dateRange.to.getTime().toString());
        }
      }

      url_params.append("stock_status", stockStatus);

      const response = await fetch(`/api/inventory?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as InventoryTableSchemaType[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
  });

  const inventoryDetailQuery = useQuery({
    queryKey: ["edit_inventory", inventoryDetail.id, inventoryDetail.version],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/${inventoryDetail.id}`);

      if (!response.ok) {
        throw new Error("Unable to load inventory details.");
      }

      const result = await response.json();

      if (!result) {
        toast.error("inventory not found.");
        return;
      }

      return result;
    },
    enabled: state.isOpen && state.mode === DialogMode.EDIT && inventoryDetail.id > 0,
  });

  const warehouseQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const response = await fetch("/api/warehouses/names");
      return await response.json();
    },
  });

  const productVariantQuery = useQuery({
    queryKey: ["inventory-available-variants", variantWarehouseId, productVariantCB.page, productVariantCB.searchQuery],
    queryFn: async ({ signal }) => {
      const url_params = new URLSearchParams();

      url_params.append("page", productVariantCB.page.toString());
      url_params.append("limit", "10");
      url_params.append("exclude_inventory_warehouse_id", String(variantWarehouseId));

      if (productVariantCB.searchQuery.trim().length > 0) {
        url_params.append("search", productVariantCB.searchQuery);
      }

      const response = await fetch(
        `/api/product_variants?${url_params.toString()}`,
        { signal },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch product variants");
      }

      return await response.json();
    },
    enabled: state.isOpen && state.mode === DialogMode.INSERT && variantWarehouseId > 0,
  });

  const createInventory = async (data: InventoryType) => {
    const response = await fetch("/api/inventory", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || "Failed to save inventory");
    } else {
      await queryClient.invalidateQueries({ queryKey: ["inventory-available-variants"] });
      send({
        type: REQUESTS.INVENTORY_ADDED,
        payload: [JSON.stringify(result)],
      });
      toast.success(result?.message || "Inventory updated successfully");
    }
  };

  const updateInventory = async (inventory_id: number, data: InventoryType & { version: number }) => {
    const response = await fetch(`/api/inventory/${inventory_id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || "Failed to save inventory");
    } else {
      send({
        type: REQUESTS.INVENTORY_UPDATED,
        payload: [JSON.stringify(result)],
      });
      setInventoryDetail({
        id: -1,
        version: 0,
      });

      toast.success(result?.message || "Inventory updated successfully");
    }
  };


  return (
    <InventoryContext.Provider
      value={{
        setVariantWarehouseId,
        inventoryQuery,
        warehouseQuery,
        productVariantQuery,
        inventoryDetailQuery,
        setPagination,
        createInventory,
        updateInventory,
        pageIndex,
        pageSize,
        searchQuery,
        setSearchQuery,
        inventoryDetail,
        setInventoryDetail,
        stockStatus,
        setStockStatus: setStockStatus,
        warehouseId,
        setWarehouseId,
        warehouseCB,
        productVariantCB,
        dateRange,
        setDateRange,
      }}
    >
      {(filters.get("status") || filters.get("stock_status") || filters.get("overdue")) && <p className="rounded-lg border p-3 text-sm">Dashboard filter: {filters.get("overdue") === "true" ? "Overdue scheduled deliveries" : filters.get("status") ?? filters.get("stock_status")} ? <a href="/panel/inventory" className="underline">Clear filter</a></p>}
      {children}
    </InventoryContext.Provider>
  );
}
