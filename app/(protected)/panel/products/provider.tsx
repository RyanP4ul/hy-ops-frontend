"use client";

import { request } from "@/components/http";
import {
  productSchema,
  ProductType,
  ProductVariantType,
} from "@/schema/product";
import { DialogMode } from "@/types/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { PaginationState } from "@tanstack/react-table";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useReducer,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type ProductDetails = {
  id: number;
  version: number;
};

type VariantType = {
  id?: number;
  is_open: boolean;
  mode: DialogMode;
};

type ProductContextType = {
  form: ReturnType<typeof useForm<ProductType>>;
  query: UseQueryResult<{
    rows: ProductType[];
    total: number;
  }>;

  productDetailQuery: UseQueryResult<ProductType | null>;
  variantDetailQuery: UseQueryResult<ProductVariantType | null>;

  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;

  variant: VariantType;
  setVariant: React.Dispatch<React.SetStateAction<VariantType>>;

  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;

  selected: ProductDetails;
  setSelected: React.Dispatch<React.SetStateAction<ProductDetails>>;

  createProduct: ReturnType<
    typeof useMutation<ProductType, Error, ProductType>
  >;
  updateProduct: ReturnType<
    typeof useMutation<ProductType, Error, ProductType>
  >;
  deleteProduct: ReturnType<
    typeof useMutation<ProductType, Error, ProductType>
  >;
};

export const ProductContext = createContext<ProductContextType | null>(null);

export function useProducts() {
  const context = useContext(ProductContext);

  if (!context) {
    throw new Error("useProducts must be used inside ProductProvider");
  }

  return context;
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [variant, setVariant] = useState<VariantType>({
    id: -1,
    is_open: false,
    mode: DialogMode.DEFAULT,
  });
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selected, setSelected] = useState<ProductDetails>({
    id: -1,
    version: 0,
  });

  const form = useForm<ProductType>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      variants: [],
      version: 0,
    },
  });

  const query = useQuery({
    queryKey: ["products", page.pageIndex, page.pageSize, searchQuery],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", page.pageIndex.toString());
      url_params.append("limit", page.pageSize.toString());

      if (searchQuery.trim().length > 0) {
        url_params.append("search", searchQuery);
      }

      const response = await fetch(`/api/products?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as ProductType[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
  });

  const productDetailQuery = useQuery({
    queryKey: ["edit_product", selected.id],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request("GET", `/api/products/${selected.id}`);

      if (!response.ok) return null;

      return await response.json();
    },
    enabled: selected.id != -1,
  });

  // http://localhost:3000/api/products/variant/1?product_id=1
  const variantDetailQuery = useQuery({
    queryKey: ["edit_variant", variant.id],
    queryFn: async () => {
      if (!selected) return null;

      const response = await request(
        "GET",
        `/api/products/variant/${variant.id}?product_id=${selected.id}`,
      );

      if (!response.ok) return null;

      return await response.json();
    },
    enabled: variant.id != -1,
  });

  const createProduct = useMutation({
    mutationFn: async (data: ProductType) => {
      const response = await fetch("/api/products", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          product_id: Number(selected),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result?.errors) {
          throw new Error(JSON.stringify(result));
        }

        throw new Error("Failed to create product");
      }

      return result as ProductType;
    },

    onSuccess: async (_) => {
      await query.refetch();
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (data: ProductType) => {
      const response = await fetch(`/api/products/${data.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result?.errors) {
          throw new Error(JSON.stringify(result));
        }
        throw new Error("Failed to update product");
      }
      return result as ProductType;
    },
    onSuccess: async (_) => {
      await query.refetch();
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (data: ProductType) => {
      const response = await fetch(
        `/api/products/${data.id}?version=${data.version}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const result = await response.json();

      if (!response.ok) {
        if (result?.errors) {
          throw new Error(JSON.stringify(result));
        }
        throw new Error("Failed to delete product");
      }
      return result as ProductType;
    },
    onSuccess: async (_) => {
      await query.refetch();
    },
  });

  return (
    <ProductContext.Provider
      value={{
        form,
        query,
        productDetailQuery,
        variantDetailQuery,
        variant,
        setVariant,
        createProduct,
        page,
        setPage,
        searchQuery,
        setSearchQuery,
        selected,
        setSelected,
        updateProduct,
        deleteProduct,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}
