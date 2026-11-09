"use client";

import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableState } from "@/components/management-list";
import { Badge } from "@/components/ui/badge";


import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
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
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowDownUp,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { WarehouseRow } from "@/schema/warehouse";
import { useWarehouses } from "../provider";
import { REQUESTS } from "@/constant/request";
import { useWebSocket } from "@/components/providers/websocket-provider";

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const {
    warehouseQuery,
    page,
    setPage,
    search,
    setSearch,
    setSelected,
    setSortBy,
  } = useWarehouses();
  const { openModal } = useModal();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setSearch, setPage]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const sortableHeader = (id: string, label: string) => (
    <button
      type="button"
      className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
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
      <ArrowDownUp className="size-3 text-muted-foreground" aria-hidden="true" />
    </button>
  );

  const columns = useMemo<ColumnDef<WarehouseRow & { version: number }>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => sortableHeader("id", "ID"),
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.original.id}</span>,
      },
      {
        accessorKey: "name",
        header: () => sortableHeader("name", "Warehouse"),
        cell: ({ row }) => <div className="space-y-1"><p className="font-medium">{row.original.name}</p><p className="text-xs text-muted-foreground">{row.original.phone_number || "No phone number saved"}</p><Badge variant="outline">#{row.original.id}</Badge></div>,
      },
      {
        accessorKey: "street_address",
        header: "Location",
        cell: ({ row }) => <div className="min-w-44 max-w-md space-y-1 whitespace-normal">
          <p>{row.original.street_address}</p>
          <p className="text-xs text-muted-foreground">{[row.original.city, row.original.state, row.original.zip_code].filter(Boolean).join(", ")}</p>
        </div>,
      },
      {
        accessorKey: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
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
              variant="ghost"
              size="icon-sm"
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
              variant="ghost"
              size="icon-sm"
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


  useEffect(() => subscribe([REQUESTS.WAREHOUSE_ADDED, REQUESTS.WAREHOUSE_ARCHIVED, REQUESTS.WAREHOUSE_DELETED, REQUESTS.WAREHOUSE_UPDATED, REQUESTS.WAREHOUSE_RESTORED], () => { void warehouseQuery.refetch(); }), [subscribe, warehouseQuery.refetch]);

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Warehouse directory" description="Find a location, review its address, or manage its details."
        total={warehouseQuery.data?.total} isFetching={warehouseQuery.isFetching} onRefresh={() => void warehouseQuery.refetch()}
        actions={<Button size="sm" onClick={() => openModal(DialogMode.INSERT, { title: "Add Warehouse", description: "Create a warehouse location.", action: "Save Warehouse" })}><Plus className="size-4" aria-hidden="true" />Add warehouse</Button>}
      />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="warehouse-search" value={searchInput} placeholder="Search warehouses…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
        {(search || searchInput) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
      </div>
      <QueryFeedback query={warehouseQuery} label="warehouses" />
      <div aria-busy={warehouseQuery.isFetching}>
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-5">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}
          </TableHeader>
          <TableBody>
            {warehouseQuery.isPending ? <TableRow><TableCell colSpan={columns.length}><ManagementTableState loading label="warehouses" /></TableCell></TableRow> : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-5 py-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length}><ManagementTableState error={warehouseQuery.isError} filtered={Boolean(search)} label="warehouses" /></TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <ManagementListFooter table={table} total={warehouseQuery.data?.total ?? 0} isFetching={warehouseQuery.isFetching} label="Warehouses" />
    </section>
  );
}
