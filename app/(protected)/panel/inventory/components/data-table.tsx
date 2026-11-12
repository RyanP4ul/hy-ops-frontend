"use client";

import { LifecycleActions } from "@/components/lifecycle-actions";

import { StockHistory } from "./stock-history";
import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementTableState } from "@/components/management-list";
import { useModal } from "@/components/providers/modal-provider";
import { InventoryTableSchemaType } from "@/schema/inventory";
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Edit, Plus } from "lucide-react";
import { useInventory } from "../provider";
import { useMemo, useState } from "react";
import { useEffect } from "react";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import { DialogMode } from "@/types/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Filter from "./filter";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

type InventoryQueryData = {
  rows: InventoryTableSchemaType[];
  total: number;
};

export function DataTable() {
  const { openModal } = useModal();
  const {
    inventoryQuery,
    pageIndex,
    pageSize,
    setPagination,
    setInventoryDetail,
    searchQuery,
    stockStatus,
    warehouseId,
    dateRange,
  } = useInventory();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();

  const columns: ColumnDef<InventoryTableSchemaType>[] = [
    { id: "history", header: "History", cell: ({ row }) => <StockHistory id={row.original.id} /> },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
    },
    {
      accessorKey: "description",
      header: "Product",
      cell: ({ row }) => <p className="min-w-36 max-w-xs whitespace-normal font-medium">{row.original.description || row.original.product_name}</p>,
    },
    {
      accessorKey: "warehouse_name",
      header: "Warehouse",
      cell: ({ row }) => {
        const warehouseName = row.original.warehouse_name;
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href="/panel/warehouses"
                >
                  {warehouseName}
                </a>
              }
            />
            <TooltipContent side="right">
              <p>View warehouses</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "On Hand",
      cell: ({ row }) => {
        const quantity = row.original.quantity;
        let className = "";

        if (quantity <= 0) {
          className = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
        } else if (quantity <= 10) {
          className =
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
        } else {
          className =
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
        }
        return (
          <Badge variant="outline" className={cn(className)}>
            {quantity}
          </Badge>
        );
      },
    },
    {
      id: "available",
      header: "Available",
      cell: ({ row }) => <span title={row.original.is_operational === false ? "Unavailable while this stock, product or warehouse is inactive." : "On hand minus reserved"}>{row.original.is_operational === false ? 0 : row.original.quantity - row.original.reserved}</span>,
    },
    {
      accessorKey: "reserved",
      header: "Reserved",
      cell: ({ row }) => {
        const reserved = row.original.reserved;
        let className = "";

        if (reserved <= 0) {
          className =
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
        } else if (reserved <= 10) {
          className =
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
        } else {
          className = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
        }

        return (
          <Badge variant="outline" className={cn(className)}>
            {reserved}
          </Badge>
        );
      },
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-2">
            <LifecycleActions resource="inventory" record={row.original} archive />
          <Button
            aria-label="Edit inventory"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              openModal(DialogMode.EDIT, {
                title: "Edit Inventory",
                description: "Edit the inventory details below.",
                action: "Save Changes",
              });

              setInventoryDetail({
                id: row.original.id,
                version: row.original.version,
              });
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>

        </div>
      ),
    },
  ];

  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  );

  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data: inventoryQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((inventoryQuery.data?.total ?? 0) / pageSize),
    state: {
      pagination,
      expanded,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
  });

  useEffect(() => {
    const queryKey = [
      "inventory",
      pageIndex,
      pageSize,
      searchQuery,
      stockStatus,
      warehouseId,
      dateRange,
    ];

    return subscribe(
      [
        REQUESTS.INVENTORY_ADDED,
        REQUESTS.INVENTORY_UPDATED,
        REQUESTS.INVENTORY_DELETED,
      ],
      (message) => {
        queryClient.setQueryData(
          queryKey,
          (oldData: InventoryQueryData | undefined) => {
            if (message.type === REQUESTS.INVENTORY_DELETED) {
              if (!oldData) return { rows: [], total: 0 };

              return {
                rows: oldData.rows.filter(
                  (row) => row.id !== message.payload.id,
                ),
                total: Math.max(oldData.total - 1, 0),
              };
            }

            if (!oldData) {
              return { rows: [message.payload], total: 1 };
            }

            if (message.type === REQUESTS.INVENTORY_UPDATED) {
              return {
                rows: oldData.rows.map((row) =>
                  row.id === message.payload.id ? message.payload : row,
                ),
                total: oldData.total,
              };
            }

            return {
              rows: [message.payload, ...oldData.rows].slice(0, pageSize),
              total: oldData.total + 1,
            };
          },
        );
      },
    );
  }, [
    dateRange,
    pageIndex,
    pageSize,
    queryClient,
    searchQuery,
    stockStatus,
    subscribe,
    warehouseId,
  ]);

  const filtered = Boolean(searchQuery || stockStatus !== "All" || warehouseId || dateRange?.from || dateRange?.to);

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Stock records" description="Review warehouse availability, reserved stock, and each item's movement history."
        total={inventoryQuery.data?.total} isFetching={inventoryQuery.isFetching} onRefresh={() => void inventoryQuery.refetch()}
        actions={<Button size="sm" onClick={() => openModal(DialogMode.INSERT, { title: "Add Inventory Item", description: "Create a new inventory record below.", action: "Add Inventory Item" })}><Plus className="size-4" aria-hidden="true" />Add inventory item</Button>}
      />
      <Filter />
      <QueryFeedback query={inventoryQuery} label="inventory" />
      <div aria-busy={inventoryQuery.isFetching}>
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-5">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}
          </TableHeader>
          <TableBody>
            {inventoryQuery.isPending ? <TableRow><TableCell colSpan={columns.length}><ManagementTableState loading label="inventory records" /></TableCell></TableRow> : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-5 py-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length}><ManagementTableState error={inventoryQuery.isError} filtered={filtered} label="inventory records" /></TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <ManagementListFooter table={table} total={inventoryQuery.data?.total ?? 0} isFetching={inventoryQuery.isFetching} label="Inventory" />
    </section>
  );
}
