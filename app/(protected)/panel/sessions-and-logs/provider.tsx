"use client";

import {
  SessionsAndLogsTableSchemaType,
  WsLogsTableSchemaType,
} from "@/schema/s&l";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

export type Tab = "sessions" | "logs";

type SessionAndLogContextType = {
  sessionsAndLogsQuery: ReturnType<
    typeof useQuery<{
      rows: SessionsAndLogsTableSchemaType[];
      total: number;
    }>
  >;
  logsQuery: ReturnType<
    typeof useQuery<{
      rows: WsLogsTableSchemaType[];
      total: number;
    }>
  >;

  page: { pageIndex: number; pageSize: number };
  setPage: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>;

  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;

  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;
};

export const SessionsAndLogsContext =
  createContext<SessionAndLogContextType | null>(null);

export function useSessionsAndLogs() {
  const context = useContext(SessionsAndLogsContext);

  if (!context) {
    throw new Error(
      "useSessionsAndLogs must be used inside SessionsAndLogsProvider",
    );
  }

  return context;
}

export function SessionsAndLogsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tab, setTab] = useState<Tab>("sessions");

  const sessionsAndLogsQuery = useQuery({
    queryKey: [
      "sessionsAndLogsQuery",
      page.pageIndex,
      page.pageSize,
      searchQuery,
    ],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", page.pageIndex.toString());
      url_params.append("limit", page.pageSize.toString());

      if (searchQuery && searchQuery.trim().length > 0) {
        url_params.append("search", searchQuery);
      }

      const response = await fetch(`/api/sessions?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as SessionsAndLogsTableSchemaType[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },

    enabled: tab === "sessions",
  });

  const logsQuery = useQuery({
    queryKey: ["logsQuery", page.pageIndex, page.pageSize, searchQuery],
    queryFn: async () => {
      const url_params = new URLSearchParams();
      url_params.append("page", page.pageIndex.toString());
      url_params.append("limit", page.pageSize.toString());
      if (searchQuery && searchQuery.trim().length > 0) {
        url_params.append("search", searchQuery);
      }
      const response = await fetch(
        `/api/sessions/logs?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }
      return {
        rows: (await response.json()) as WsLogsTableSchemaType[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
    enabled: tab === "logs",
  });

  return (
    <SessionsAndLogsContext.Provider
      value={{
        sessionsAndLogsQuery,
        logsQuery,
        page,
        setPage,
        searchQuery,
        setSearchQuery,
        tab,
        setTab,
      }}
    >
      {children}
    </SessionsAndLogsContext.Provider>
  );
}
