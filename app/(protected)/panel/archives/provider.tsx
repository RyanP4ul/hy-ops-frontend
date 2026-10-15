"use client";

import { ArchiveRow, ArchiveTable } from "@/schema/archives";
import { SessionsAndLogsTableSchemaType } from "@/schema/s&l";
import { useQuery } from "@tanstack/react-query";
import { PaginationState } from "@tanstack/react-table";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

type SelectedType = {
  archived_id: number;
  entity_id: number;
  entity_table: string;
};

type ArchiveContextType = {
  archivesQuery: ReturnType<
    typeof useQuery<{
      rows: ArchiveTable[];
      total: number;
    }>
  >;
  page: { pageIndex: number; pageSize: number };
  setPage: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number }>
  >;
  selected: SelectedType;
  setSelected: Dispatch<SetStateAction<SelectedType>>;
};

export const ArchiveContext = createContext<ArchiveContextType | null>(null);

export function useArchive() {
  const context = useContext(ArchiveContext);

  if (!context) {
    throw new Error("useArchive must be used inside ArchiveProvider");
  }

  return context;
}

export function ArchiveProvider({ children }: { children: React.ReactNode }) {
  const archivesQuery = useQuery({
    queryKey: ["archives"],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", pageIndex.toString());
      url_params.append("limit", pageSize.toString());

      const response = await fetch(`/api/archives?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as ArchiveTable[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
  });

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [selected, setSelected] = useState<SelectedType>({
    archived_id: -1,
    entity_id: -1,
    entity_table: "",
  });

  return (
    <ArchiveContext.Provider
      value={{
        archivesQuery,
        page: { pageIndex, pageSize },
        setPage: setPagination,
        selected,
        setSelected,
      }}
    >
      {children}
    </ArchiveContext.Provider>
  );
}
