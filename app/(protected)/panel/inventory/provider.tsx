"use client";

import { useComboBoxPagination } from "@/components/base-pagination";
import { InventoryTableSchemaType, InventoryType } from "@/schema/inventory";
import { ProductType } from "@/schema/product";
import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
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

type StockStatus = "All" | "High" | "Low" | "Out";

type InventoryDetail = {
  id: number;
  version: number;
};

type InventoryContextType = {
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

  updateInventory: (inventory_id: number, data: InventoryType) => Promise<void>;
  deleteInventory: () => Promise<void>;

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
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inventoryDetail, setInventoryDetail] = useState<InventoryDetail>({
    id: -1,
    version: 0,
  });
  const [stockStatus, setStockStatus] = useState<StockStatus>("All");
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
    queryKey: ["edit_inventory", inventoryDetail.id],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/${inventoryDetail.id}`);

      if (!response.ok) {
        toast.error("Failed to fetch inventory details.");
        return;
      }

      const result = await response.json();

      if (!result) {
        toast.error("inventory not found.");
        return;
      }

      return result;
    },
    enabled: inventoryDetail.id > 0,
  });

  const warehouseQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const response = await fetch("/api/warehouses/names");
      return await response.json();
    },
  });

  const productVariantQuery = useQuery({
    queryKey: ["product_variants", productVariantCB.page],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", productVariantCB.page.toString());
      url_params.append("limit", "10");

      if (productVariantCB.searchQuery.trim().length > 0) {
        url_params.append("search", productVariantCB.searchQuery);
      }

      const response = await fetch(
        `/api/product_variants?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch product variants");
      }

      const result = await response.json();

      productVariantCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },
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
      toast.error(result?.message || "Failed to update inventory");
    } else {
      toast.success(result?.message || "Inventory updated successfully");
    }
  };

  const updateInventory = async (inventory_id: number, data: InventoryType) => {
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
      toast.error(result?.message || "Failed to update inventory");
    } else {
      setInventoryDetail({
        id: -1,
        version: 0,
      });

      toast.success(result?.message || "Inventory updated successfully");
    }
  };

  const deleteInventory = async (): Promise<void> => {
    const response = await fetch(
      `/api/inventory/${inventoryDetail.id}?version=${inventoryDetail.version}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      toast.error(result?.message || "Failed to delete inventory");
    } else {
      toast.success(result?.message || "Inventory deleted successfully");
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        inventoryQuery,
        warehouseQuery,
        productVariantQuery,
        inventoryDetailQuery,
        setPagination,
        createInventory,
        updateInventory,
        deleteInventory,
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
      {children}
    </InventoryContext.Provider>
  );
}
