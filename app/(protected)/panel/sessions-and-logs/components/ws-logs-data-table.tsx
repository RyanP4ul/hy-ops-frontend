"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WsLogsTableSchemaType } from "@/schema/s&l";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2Icon, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSessionsAndLogs } from "../provider";
import PaginationSessions from "./session-pagination";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

const columns: ColumnDef<WsLogsTableSchemaType>[] = [
  { accessorKey: "ws_id", header: "ID" },
  { accessorKey: "session_id", header: "Session ID" },
  { accessorKey: "user_id", header: "User ID" },
  { accessorKey: "action", header: "Action" },
  {
    accessorKey: "payload",
    header: "Payload",
    cell: ({ row }) => (
      <span
        className="block max-w-[28rem] truncate"
        title={row.original.payload}
      >
        {row.original.payload}
      </span>
    ),
  },
];

export default function WsLogsDataTable() {
  const { subscribe } = useWebSocket();
  const { logsQuery, page, setPage, searchQuery, setSearchQuery } =
    useSessionsAndLogs();
  const queryClient = useQueryClient();
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState(searchQuery);

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

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-4">
        <InputGroup className="max-w-md">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search by session ID..."
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setPage((current) => ({ ...current, pageIndex: 0 }));
              setSearchQuery(value);
            }}
          />
        </InputGroup>
        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value ?? "all");
            setPage((current) => ({ ...current, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="px-4">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {logsQuery.isFetching ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-40 text-center"
                  >
                    <Loader2Icon className="mx-auto animate-spin" />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No WebSocket logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex w-full items-center px-4">
        <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <Select
            value={String(page.pageSize)}
            onValueChange={(value) =>
              setPage({ pageIndex: 0, pageSize: Number(value) })
            }
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PaginationSessions table={table} />
      </div>
    </>
  );
}
