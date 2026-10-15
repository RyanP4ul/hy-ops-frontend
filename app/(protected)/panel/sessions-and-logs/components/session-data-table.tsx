import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import { SessionsAndLogsTableSchemaType } from "@/schema/s&l";
import { flexRender, useReactTable } from "@tanstack/react-table";
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
import PaginationSessions from "./session-pagination";
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
    tab,
    setTab,
  } = useSessionsAndLogs();
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [sessionToDisconnect, setSessionToDisconnect] =
    useState<SessionsAndLogsTableSchemaType | null>(null);
  const queryClient = useQueryClient();

  const disconnectSession = async (sessionId: number): Promise<boolean> => {
    setDisconnectingId(sessionId);

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
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center">
          <span>{row.original.user.name}</span>
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
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive cursor-pointer"
            disabled={disconnectingId === row.original.id}
            aria-label="Disconnect session"
            onClick={() => setSessionToDisconnect(row.original)}
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

  const pagination = useMemo(
    () => ({
      page: page.pageIndex,
      pageSize: page.pageSize,
    }),
    [page],
  );

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
      (message) => {
        switch (message.type) {
          case REQUESTS.SESSION_OUT:
            sessionsAndLogsQuery.refetch();
            break;
          case REQUESTS.CHANGE_PAGE:
            queryClient.setQueryData(
              [
                "sessionsAndLogsQuery",
                page.pageIndex,
                page.pageSize,
                searchQuery,
              ],
              (oldData: any) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  rows: oldData.rows.map(
                    (row: SessionsAndLogsTableSchemaType) =>
                      row.id === message.payload.id
                        ? {
                            ...row,
                            page: message.payload.page,
                          }
                        : row,
                  ),
                };
              },
            );
            break;
          case REQUESTS.NEW_SESSION:
            queryClient.setQueryData(
              [
                "sessionsAndLogsQuery",
                page.pageIndex,
                page.pageSize,
                searchQuery,
              ],
              (oldData: any) => {
                if (!oldData) {
                  return {
                    rows: [message.payload],
                    total: 1,
                  };
                }

                return {
                  rows: [message.payload, ...oldData.rows],
                  total: oldData.total + 1,
                };
              },
            );
            break;
        }
      },
    );
  }, [subscribe]);

  // useEffect(() => {
  //   if (received === null) return;

  //   switch (received?.type) {
  //     case REQUESTS.SESSION_OUT:
  //       console.log("Session out received:", received);
  //       sessionsAndLogsQuery.refetch();
  //       break;
  //   }
  // }, [received]);

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
      <div className="px-4">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {sessionsAndLogsQuery.isFetching ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-40 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2Icon className="mr-2 animate-spin h-4 w-4" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {cell.column.columnDef.cell
                              ? (cell.column.columnDef.cell as any)(
                                  cell.getContext(),
                                )
                              : cell.getValue()}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center">
                        No Results Found
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex w-full items-center px-4">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          <Field orientation="horizontal" className="w-fit">
            <FieldLabel htmlFor="select-rows-per-page">
              Rows per page
            </FieldLabel>

            <Select
              defaultValue="10"
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-20" id="select-rows-per-page">
                <SelectValue />
              </SelectTrigger>

              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-center justify-end">
          <PaginationSessions table={table} />
        </div>
      </div>
    </>
  );
}
