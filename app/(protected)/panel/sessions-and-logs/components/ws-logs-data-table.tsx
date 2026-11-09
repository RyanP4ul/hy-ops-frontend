"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WsLogsTableSchemaType } from "@/schema/s&l";
import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryFeedback } from "@/components/query-feedback";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { debounce } from "@/utils/debounce";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";
import { useEffect, useMemo, useState } from "react";
import { useSessionsAndLogs } from "../provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

function formatPayload(payload: string) {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export default function WsLogsDataTable() {
  const { subscribe } = useWebSocket();
  const { logsQuery, page, setPage, searchQuery, setSearchQuery } =
    useSessionsAndLogs();
  const queryClient = useQueryClient();
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState(searchQuery);
  const [selectedLog, setSelectedLog] = useState<WsLogsTableSchemaType | null>(null);
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearchQuery(value);
  }, 350), [setPage, setSearchQuery]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const columns: ColumnDef<WsLogsTableSchemaType>[] = [
    { accessorKey: "ws_id", header: "Log ID", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.original.ws_id}</span> },
    { accessorKey: "session_id", header: "Session", cell: ({ row }) => <span className="font-mono text-xs">{row.original.session_id}</span> },
    { accessorKey: "user_id", header: "User", cell: ({ row }) => <span>User #{row.original.user_id}</span> },
    { accessorKey: "action", header: "Action", cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge> },
    { accessorKey: "payload", header: "Payload", cell: ({ row }) => <div className="flex items-center gap-3">
      <span className="block max-w-48 truncate font-mono text-xs text-muted-foreground">{row.original.payload || "No payload"}</span>
      <Button variant="ghost" size="sm" aria-label={`View payload for log ${row.original.ws_id}`} onClick={() => setSelectedLog(row.original)}>Details<ArrowUpRight className="size-4" aria-hidden="true" /></Button>
    </div> },
  ];

  useEffect(() => {
    return subscribe(REQUESTS.WS_LOG_CREATED, (message) => {
      const log = message.payload as WsLogsTableSchemaType;

      if (
        searchQuery &&
        !log.session_id
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      queryClient.setQueryData(
        ["logsQuery", page.pageIndex, page.pageSize, searchQuery],
        (
          oldData:
            | { rows: WsLogsTableSchemaType[]; total: number }
            | undefined,
        ) => {
          if (!oldData) return oldData;

          return {
            rows:
              page.pageIndex === 0
                ? [log, ...oldData.rows].slice(0, page.pageSize)
                : oldData.rows,
            total: oldData.total + 1,
          };
        },
      );
    });
  }, [page.pageIndex, page.pageSize, queryClient, searchQuery, subscribe]);

  const actions = useMemo(
    () =>
      Array.from(
        new Set((logsQuery.data?.rows ?? []).map((log) => log.action)),
      ),
    [logsQuery.data?.rows],
  );
  const filteredRows = useMemo(
    () =>
      (logsQuery.data?.rows ?? []).filter(
        (log) => action === "all" || log.action === action,
      ),
    [action, logsQuery.data?.rows],
  );
  const table = useReactTable({
    data: filteredRows,
    columns,
    pageCount: Math.ceil((logsQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  function clearSearch() {
    debouncedSearch.cancel();
    setSearch("");
    setSearchQuery("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  function resetFilters() {
    clearSearch();
    setAction("all");
  }

  const actionOptions = [
    { value: "all", label: "All actions on this page" },
    ...Array.from(new Set([...actions, ...(action !== "all" ? [action] : [])])).filter((value) => value !== "all").map((value) => ({ value, label: value })),
  ];

  return (
    <>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ManagementListHeader title="WebSocket activity" description="Search session activity and open a log to inspect its full message payload."
          total={logsQuery.data?.total} isFetching={logsQuery.isFetching} onRefresh={() => void logsQuery.refetch()} />
        <div className="space-y-3 border-b bg-muted/20 p-4 md:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <ManagementSearch id="websocket-search" value={search} placeholder="Search by session ID…" onChange={(value) => { setSearch(value); debouncedSearch(value); }} onClear={clearSearch} />
            <Select items={actionOptions} value={action} onValueChange={(value) => setAction(value ?? "all")}>
              <SelectTrigger className="h-10 w-full bg-background sm:w-56" aria-label="Filter actions on the current page"><SelectValue /></SelectTrigger>
              <SelectContent>{actionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            {(search || searchQuery || action !== "all") && <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Session search covers all logs. The action filter applies only to the current page.</p>
        </div>
        <QueryFeedback query={logsQuery} label="WebSocket logs" />
        <ManagementTableView table={table} loading={logsQuery.isPending} isFetching={logsQuery.isFetching} error={logsQuery.isError} filtered={Boolean(searchQuery || action !== "all")} label="WebSocket logs" />
        <ManagementListFooter table={table} total={logsQuery.data?.total ?? 0} isFetching={logsQuery.isFetching} label="WebSocket logs" pageFiltered={action !== "all"} />
      </section>
      <Dialog open={selectedLog !== null} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>WebSocket log details</DialogTitle>
            <DialogDescription>Log #{selectedLog?.ws_id}. Review the action and full recorded payload.</DialogDescription>
          </DialogHeader>
          {selectedLog && <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Session</dt><dd className="mt-1 break-all font-mono">{selectedLog.session_id}</dd></div>
              <div><dt className="text-xs text-muted-foreground">User</dt><dd className="mt-1">User #{selectedLog.user_id}</dd></div>
              <div className="col-span-2"><dt className="mb-1 text-xs text-muted-foreground">Action</dt><dd><Badge variant="outline">{selectedLog.action}</Badge></dd></div>
            </dl>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Payload</h3>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 text-xs">{selectedLog.payload ? formatPayload(selectedLog.payload) : "No payload recorded."}</pre>
            </section>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
