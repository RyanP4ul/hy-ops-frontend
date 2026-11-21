"use client";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useSetting } from "@/components/providers/setting-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { emptyCustomerProfile, userSchema, type UserForm, type UserRow } from "@/schema/user";
import { useComboBoxPagination } from "@/components/base-pagination";

type UserContext = {
  form: UseFormReturn<UserForm>;
  userQuery: ReturnType<
    typeof useQuery<{
      rows: (UserRow & { version: number })[];
      total: number;
    }>
  >;
  userDetailQuery: ReturnType<
    typeof useQuery<(UserRow & { version: number }) | null>
  >;
  selected: FormSelected;
  setSelected: (warehouse: FormSelected) => void;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  warehouseCB: ReturnType<typeof useComboBoxPagination>;
  warehouseQuery: UseQueryResult<{
    rows: { id: number; name: string }[];
    total: number;
  }>;
};

const UserContext = createContext<UserContext | null>(null);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used inside UserProvider");
  return context;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { settingQuery } = useSetting();

  const [selected, setSelected] = useState<FormSelected>({
    id: -1,
    version: 0,
  });
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const { state } = useModal();
  const warehouseCB = useComboBoxPagination();

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "customer",
      profile: emptyCustomerProfile,
    },
  });

  const userQuery = useQuery({
    queryKey: ["users", page.pageIndex, page.pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page.pageIndex),
        limit: String(page.pageSize),
      });

      if (search.trim()) params.set("search", search);

      const response = await fetch(`/api/users?${params}`);

      if (!response.ok) throw new Error("Failed to fetch users");

      return {
        rows: (await response.json()) as (UserRow & { version: number })[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    refetchInterval: () =>
      Number(settingQuery.data?.refresh_interval_ms.value) ?? 5000,
    refetchIntervalInBackground: false,
  });

  const userDetailQuery = useQuery({
    queryKey: ["userDetail", selected.id, selected.version],
    queryFn: async () => {
      if (selected.id <= 0) return null;
      const response = await fetch(`/api/users/${selected.id}`);

      if (!response.ok) throw new Error("Unable to load user details.");

      return (await response.json()) as UserRow & { version: number };
    },
    enabled: state.isOpen && state.mode === DialogMode.EDIT && selected.id > 0,
  });

  const warehouseQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const response = await fetch("/api/warehouses/names");
      return await response.json();
    },
  });

  return (
    <UserContext.Provider
      value={{
        form,
        userQuery,
        userDetailQuery,
        selected,
        setSelected,
        page,
        setPage,
        search,
        setSearch,
        warehouseCB,
        warehouseQuery,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
