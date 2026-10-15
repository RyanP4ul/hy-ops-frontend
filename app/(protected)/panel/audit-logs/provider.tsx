"use client";

import { AuditLogsTableSchemaType } from "@/schema/audit-logs";
import { useQuery } from "@tanstack/react-query";
import { PaginationState } from "@tanstack/react-table";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

type AuditLogContextType = {
  auditLogsQuery: ReturnType<
    typeof useQuery<{
      rows: AuditLogsTableSchemaType[];
      total: number;
    }>
  >;
  setPagination: Dispatch<SetStateAction<PaginationState>>;

  pageIndex: number;
  pageSize: number;

  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
};

export const AuditLogsContext = createContext<AuditLogContextType | null>(null);

export function useAuditLogs() {
  const context = useContext(AuditLogsContext);

  if (!context) {
    throw new Error("useAuditLogs must be used inside AuditLogsProvider");
  }

  return context;
}

export function AuditLogsProvider({ children }: { children: React.ReactNode }) {
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [searchQuery, setSearchQuery] = useState<string>("");

  const auditLogsQuery = useQuery({
    queryKey: ["auditLogsQuery", pageIndex, pageSize, searchQuery],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", pageIndex.toString());
      url_params.append("limit", pageSize.toString());

      if (searchQuery && searchQuery.trim().length > 0) {
        url_params.append("search", searchQuery);
      }

      const response = await fetch(`/api/audit-logs?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as AuditLogsTableSchemaType[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
  });

  return (
    <AuditLogsContext.Provider
      value={{
        auditLogsQuery,
        setPagination,
        pageIndex,
        pageSize,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </AuditLogsContext.Provider>
  );
}
