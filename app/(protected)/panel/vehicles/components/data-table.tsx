"use client";

import { useMemo, useState } from "react";
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
      { accessorKey: "image", header: "Image" },
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
            {vehicleQuery.isFetching ? (
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
                  No Results Found
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
