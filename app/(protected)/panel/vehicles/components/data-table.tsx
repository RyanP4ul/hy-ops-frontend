"use client";

import { QueryFeedback } from "@/components/query-feedback";


import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDownUp, Edit, Loader2Icon, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useVehicles } from "../provider";
import { VehicleRow } from "@/schema/vehicle";
import PaginationVehicle from "./pagination";
import { debounce } from "@/utils/debounce";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

type VehicleQueryData = {
  rows: VehicleRow[];
  total: number;
};

export default function DataTable() {
  const {
    vehicleQuery,
    page,
    setPage,
    search,
    setSearch,
    setSelected,
    sortBy,
    setSortBy,
  } = useVehicles();
  const { openModal } = useModal();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(search);
  const updateSearch = useMemo(() => debounce(setSearch, 400), [setSearch]);
  const sortableHeader = (id: string, label: string) => (
    <button
      type="button"
      className="flex items-center gap-2"
      onClick={() =>
        setSortBy((current) => ({
          id,
          type: current.id === id && current.type === "asc" ? "desc" : "asc",
        }))
      }
    >
      {label}
      <ArrowDownUp className="size-3 text-muted-foreground" />
    </button>
  );
  const columns = useMemo<ColumnDef<VehicleRow>[]>(
    () => [
      { accessorKey: "id", header: () => sortableHeader("id", "ID") },
      {
        accessorKey: "plate_number",
        header: () => sortableHeader("plate_number", "Plate Number"),
      },
      { accessorKey: "type", header: () => sortableHeader("type", "Type") },
      {
        accessorKey: "status",
        header: () => sortableHeader("status", "Status"),
      },
      { accessorKey: "warehouse_name", header: "Assigned Warehouse" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Edit vehicle"
              onClick={() => {
                setSelected({
                  id: row.original.id,
                  version: row.original.version,
                });
                openModal(DialogMode.EDIT, {
                  title: "Edit Vehicle",
                  description: "Update this vehicle.",
                  action: "Save changes",
                });
              }}
            >
              <Edit className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete vehicle"
              className="text-destructive"
              onClick={() => {
                setSelected({
                  id: row.original.id,
                  version: row.original.version,
                });
                openModal(DialogMode.DELETE, {
                  title: "Delete Vehicle",
                  description: `Delete vehicle "${row.original.plate_number}"?`,
                  action: "Delete",
                });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [openModal, setSelected, setSortBy],
  );
  const table = useReactTable({
    data: vehicleQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((vehicleQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  useEffect(() => {
    const queryKey = [
      "vehicles",
      page.pageIndex,
      page.pageSize,
      search,
      sortBy,
    ];

    return subscribe(
      [
        REQUESTS.VEHICLE_ADDED,
        REQUESTS.VEHICLE_UPDATED,
        REQUESTS.VEHICLE_DELETED,
      ],
      (message) => {
        const payload = message.payload as VehicleRow | { id: number };
        const vehicle = payload as VehicleRow;

        queryClient.setQueryData(
          queryKey,
          (oldData: VehicleQueryData | undefined) => {
            if (message.type === REQUESTS.VEHICLE_DELETED) {
              if (!oldData) return { rows: [], total: 0 };

              return {
                rows: oldData.rows.filter((row) => row.id !== payload.id),
                total: Math.max(
                  oldData.total -
                    (oldData.rows.some((row) => row.id === payload.id) ? 1 : 0),
                  0,
                ),
              };
            }

            if (!oldData) return { rows: [vehicle], total: 1 };

            const exists = oldData.rows.some((row) => row.id === vehicle.id);

            return {
              rows: exists
                ? oldData.rows.map((row) =>
                    row.id === vehicle.id ? vehicle : row,
                  )
                : [vehicle, ...oldData.rows].slice(0, page.pageSize),
              total: exists ? oldData.total : oldData.total + 1,
            };
          },
        );
      },
    );
  }, [page.pageIndex, page.pageSize, queryClient, search, sortBy, subscribe]);
  return (
    <>
      <div className="mb-3">
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search vehicles..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage((current) => ({ ...current, pageIndex: 0 }));
              updateSearch(event.target.value);
            }}
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <QueryFeedback query={vehicleQuery} label="vehicles" />
            <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicleQuery.isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <Loader2Icon className="mr-2 inline size-4 animate-spin" />
                  Loading...
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
                <TableCell colSpan={6} className="h-24 text-center">
                  {vehicleQuery.isError ? "Records unavailable. Use Retry above." : "No matching records. Try adjusting your filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end px-4">
        <PaginationVehicle table={table} />
      </div>
    </>
  );
}
