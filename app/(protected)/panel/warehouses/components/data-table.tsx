"use client";

import { ModalProvider, useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DialogMode } from "@/types/dialog";
import {
  flexRender,
  getCoreRowModel,
  SortingState,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowDownUp,
  Edit,
  Filter,
  Loader2Icon,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { WarehouseRow } from "@/schema/warehouse";
import { useWarehouses } from "../provider";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PaginationWarehouse from "./pagination";
import { REQUESTS } from "@/constant/request";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useSetting } from "@/components/providers/setting-provider";

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const {
    warehouseQuery,
    page,
    setPage,
    search,
    setSearch,
    setSelected,
    sortBy,
    setSortBy,
  } = useWarehouses();
  const { openModal } = useModal();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce(setSearch, 500), [setSearch]);

  const sortableHeader = (id: string, label: string) => (
    <div
      className="flex items-center gap-2 cursor-pointer"
      onClick={() => {
        setSortBy((current) => {
          if (current.id === id) {
            return {
              id,
              type: current.type === "asc" ? "desc" : "asc",
            };
          }

          return {
            id,
            type: "asc",
          };
        });
      }}
    >
      {label}
      <ArrowDownUp className="size-3 text-muted-foreground" />
    </div>
  );

  const columns = useMemo<ColumnDef<WarehouseRow & { version: number }>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => sortableHeader("id", "ID"),
      },
      {
        accessorKey: "name",
        header: () => sortableHeader("name", "Name"),
      },
      { accessorKey: "street_address", header: "Address" },
      { accessorKey: "city", header: "City" },
      { accessorKey: "state", header: "State" },
      { accessorKey: "zip_code", header: "ZIP Code" },
      {
        accessorKey: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Edit warehouse"
              onClick={() => {
                setSelected({
                  id: row.original.id,
                  version: row.original.version,
                });
                openModal(DialogMode.EDIT, {
                  title: "Edit Warehouse",
                  description: "Update this warehouse.",
                  action: "Save changes",
                });
              }}
            >
              <Edit className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete warehouse"
              className="text-destructive"
              onClick={() => {
                setSelected(row.original);
                openModal(DialogMode.DELETE, {
                  title: "Delete Warehouse",
                  description: `Are you sure you want to delete the warehouse "${row.original.name}"? This action cannot be undone.`,
                  action: "Delete",
                });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Archive warehouse"
              onClick={() => {
                setSelected(row.original);

                openModal(DialogMode.ARCHIVE, {
                  title: "Archive Warehouse",
                  description: `Are you sure you want to archive the warehouse "${row.original.name}"? This action cannot be undone.`,
                  action: "Archive",
                });
              }}
            >
              <Archive className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [openModal, setSelected],
  );
  const table = useReactTable({
    data: warehouseQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((warehouseQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    console.log("Setting up WebSocket subscriptions for warehouse updates");
    return subscribe(
      [
        REQUESTS.WAREHOUSE_ADDED,
        REQUESTS.WAREHOUSE_ARCHIVED,
        REQUESTS.WAREHOUSE_DELETED,
        REQUESTS.WAREHOUSE_UPDATED,
        REQUESTS.WAREHOUSE_RESTORED,
      ],
      (message) => {
        const query_key = [
          "warehouses",
          table.getState().pagination.pageIndex,
          table.getState().pagination.pageSize,
          search,
          sortBy,
        ];
        switch (message.type) {
          case REQUESTS.WAREHOUSE_ADDED:
            queryClient.setQueryData(query_key, (oldData: any) => {
              if (!oldData) {
                return {
                  rows: [message.payload],
                  total: 1,
                };
              }

              return {
                rows: [message.payload, ...oldData.rows].slice(
                  0,
                  page.pageSize,
                ),
                total: oldData.total + 1,
              };
            });
            break;
          case REQUESTS.WAREHOUSE_ARCHIVED:
          case REQUESTS.WAREHOUSE_DELETED:
            console.log(
              "Received WAREHOUSE_ARCHIVED or WAREHOUSE_DELETED message:",
              message,
            );
            queryClient.setQueryData(query_key, (oldData: any) => {
              if (!oldData) {
                return {
                  rows: [],
                  total: 0,
                };
              }
              return {
                rows: oldData.rows.filter(
                  (row: any) => row.id !== message.payload.id,
                ),
                total: oldData.total - 1,
              };
            });
            break;
          case REQUESTS.WAREHOUSE_UPDATED:
            queryClient.setQueryData(query_key, (oldData: any) => {
              console.log("oldData", oldData);
              if (!oldData) {
                console.log("oldData is null");
                return {
                  rows: [message.payload],
                  total: 1,
                };
              }
              console.log("oldData is not null");
              return {
                rows: oldData.rows
                  .map((row: any) =>
                    row.id === message.payload.id ? message.payload : row,
                  )
                  .slice(0, page.pageSize),
                total: oldData.total,
              };
            });
            break;
          case REQUESTS.WAREHOUSE_RESTORED:
            console.log("Received WAREHOUSE_RESTORED message:", message);
            queryClient.setQueryData(query_key, (oldData: any) => {
              if (!oldData) {
                return {
                  rows: [message.payload],
                  total: 1,
                };
              }
              return {
                rows: [message.payload, ...oldData.rows].slice(
                  0,
                  page.pageSize,
                ),
                total: oldData.total + 1,
              };
            });
            break;
        }
      },
    );
  }, [subscribe]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-6 mb-3">
        <div className="flex flex-col gap-2">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search warehouses..."
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage((current) => ({ ...current, pageIndex: 0 }));
                debouncedSearch(event.target.value);
              }}
            />
          </InputGroup>
        </div>
      </div>

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
            {warehouseQuery.isFetching ? (
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
          <PaginationWarehouse table={table} />
        </div>
      </div>
    </>
  );
}
