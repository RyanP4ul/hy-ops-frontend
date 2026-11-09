"use client";

import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";
import { debounce } from "@/utils/debounce";
import { Button } from "@/components/ui/button";
import { SessionsAndLogsTableSchemaType } from "@/schema/s&l";
import { useReactTable } from "@tanstack/react-table";
import {
  ColumnDef,
  ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
} from "@tanstack/table-core";
import { Laptop, Loader2Icon, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSessionsAndLogs } from "../provider";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DataTable() {
  const { subscribe } = useWebSocket();

  const {
    sessionsAndLogsQuery,
    page,
    setPage,
    searchQuery,
    setSearchQuery,
  } = useSessionsAndLogs();
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [disconnectError, setDisconnectError] = useState("");
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearchQuery(value);
  }, 350), [setPage, setSearchQuery]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [sessionToDisconnect, setSessionToDisconnect] =
    useState<SessionsAndLogsTableSchemaType | null>(null);
  const queryClient = useQueryClient();

  const disconnectSession = async (sessionId: number): Promise<boolean> => {
    setDisconnectingId(sessionId);
    setDisconnectError("");

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect session");
      }

      queryClient.setQueryData(
        ["sessionsAndLogsQuery", page.pageIndex, page.pageSize, searchQuery],
        (
          oldData:
            | {
                rows: SessionsAndLogsTableSchemaType[];
                total: number;
              }
            | undefined,
        ) => {
          if (!oldData) return oldData;

          return {
            rows: oldData.rows.filter(
              (row) => String(row.id) !== String(sessionId),
            ),
            total: Math.max(oldData.total - 1, 0),
          };
        },
      );
      return true;
    } catch (error) {
      console.error("Failed to disconnect session:", error);
      setDisconnectError("Unable to disconnect this session. Please try again.");
      return false;
    } finally {
      setDisconnectingId(null);
    }
  };

  const columns: ColumnDef<SessionsAndLogsTableSchemaType>[] = [
    {
      accessorKey: "id",
      header: "Session ID",
    },
    {
      accessorKey: "page",
      header: "Current Page",
      cell: ({ row }) => (
        <div className="flex items-center">
          <span>/panel/{row.original.page}</span>
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div className="flex items-center">
          <div><p className="font-medium">{row.original.user.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.original.user.email}</p></div>
        </div>
      ),
    },
    {
      accessorKey: "ip_address",
      header: "IP Address",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <div className="flex items-center">
          <Badge variant="secondary" className="text-xs capitalize">
            {row.original.user.role}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "device",
      header: "Device",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.user.user_agent.device.type === "desktop" ? (
            <Laptop className="size-4 text-muted-foreground" />
          ) : row.original.user.user_agent.device.type === "mobile" ? (
            <Smartphone className="size-4 text-muted-foreground" />
          ) : (
            <span className="text-sm">Unknown</span>
          )}
          <div>
            <p className="text-sm">
              {row.original.user.user_agent.browser.name}
            </p>

            <p className="text-xs text-muted-foreground">
              {row.original.user.user_agent.os.name}{" "}
              {row.original.user.user_agent.os.version}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive cursor-pointer"
            disabled={disconnectingId === row.original.id}
            aria-label="Disconnect session"
            onClick={() => { setDisconnectError(""); setSessionToDisconnect(row.original); }}
          >
            {disconnectingId === row.original.id ? (
              <Loader2Icon className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data: sessionsAndLogsQuery.data?.rows || [],
    columns,
    pageCount: Math.ceil(
      (sessionsAndLogsQuery.data?.total ?? 0) / page.pageSize,
    ),
    state: {
      pagination: page,
      expanded,
    },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
  });

  useEffect(() => {
    return subscribe(
      [REQUESTS.CHANGE_PAGE, REQUESTS.SESSION_OUT, REQUESTS.NEW_SESSION],
      () => { void queryClient.invalidateQueries({ queryKey: ["sessionsAndLogsQuery"] }); },
    );
  }, [queryClient, subscribe]);

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearchQuery("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <>
      <Dialog
        open={sessionToDisconnect !== null}
        onOpenChange={(open) => {
          if (!open && disconnectingId === null) {
            setSessionToDisconnect(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect session?</DialogTitle>
            <DialogDescription>
              This will close the WebSocket connection for{" "}
              <span className="font-medium text-foreground">
                {sessionToDisconnect?.user.name}
              </span>{" "}
              and remove it from the active sessions list.
            </DialogDescription>
          </DialogHeader>
          {disconnectError && <p role="alert" className="text-sm text-destructive">{disconnectError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={disconnectingId !== null}
              onClick={() => setSessionToDisconnect(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                disconnectingId !== null || sessionToDisconnect === null
              }
              onClick={async () => {
                if (!sessionToDisconnect) return;

                const disconnected = await disconnectSession(
                  sessionToDisconnect.id,
                );

                if (disconnected) {
                  setSessionToDisconnect(null);
                }
              }}
            >
              {disconnectingId !== null ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ManagementListHeader title="Active sessions" description="See who is connected, review their device, or disconnect a session."
          total={sessionsAndLogsQuery.data?.total} isFetching={sessionsAndLogsQuery.isFetching} onRefresh={() => void sessionsAndLogsQuery.refetch()} />
        <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
          <ManagementSearch id="session-search" value={searchInput} placeholder="Search by name or email…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
          {(searchInput || searchQuery) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
        </div>
        <QueryFeedback query={sessionsAndLogsQuery} label="active sessions" />
        <ManagementTableView table={table} loading={sessionsAndLogsQuery.isPending} isFetching={sessionsAndLogsQuery.isFetching} error={sessionsAndLogsQuery.isError} filtered={Boolean(searchQuery)} label="active sessions" />
        <ManagementListFooter table={table} total={sessionsAndLogsQuery.data?.total ?? 0} isFetching={sessionsAndLogsQuery.isFetching} label="Sessions" />
      </section>
    </>
  );
}
