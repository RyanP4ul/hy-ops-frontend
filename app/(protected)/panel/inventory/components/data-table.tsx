import { StockHistory } from "./stock-history";
import { QueryFeedback } from "@/components/query-feedback";
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
import { Edit, Loader2Icon, Plus, Trash2 } from "lucide-react";
import { useInventory } from "../provider";
import { useMemo, useState } from "react";
import { useEffect } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DialogMode } from "@/types/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import PaginationInventory from "./pagination";
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
    },
    {
      accessorKey: "description",
      header: "Description",
    },
    {
      accessorKey: "warehouse_name",
      header: "Warehouse Name",
      cell: ({ row }) => {
        const warehouseName = row.original.warehouse_name;
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  className="font-medium text-blue-700 border-b border-blue-700 hover:text-blue-900 hover:border-blue-900"
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
          className = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
        } else if (quantity <= 10) {
          className =
            "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
        } else {
          className =
            "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
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
      cell: ({ row }) => <span title="On hand minus reserved">{row.original.quantity - row.original.reserved}</span>,
    },
    {
      accessorKey: "reserved",
      header: "Reserved",
      cell: ({ row }) => {
        const reserved = row.original.reserved;
        let className = "";

        if (reserved <= 0) {
          className =
            "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
        } else if (reserved <= 10) {
          className =
            "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
        } else {
          className = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
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
          <Button
            aria-label="Edit inventory"
            variant="outline"
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
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive cursor-pointer"
            aria-label="Delete inventory"
            onClick={() => {
              // console.log("Delete action for product:", row.original.id);
              openModal(DialogMode.DELETE, {
                title: "Delete Inventory",
                description: "Are you sure you want to delete this inventory?",
                action: "Delete",
              });

              setInventoryDetail({
                id: row.original.id,
                version: row.original.version,
              });
            }}
          >
            <Trash2 className="h-3 w-3" />
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

  return (
    <>
      <div className="px-4">
        <Filter />

        <div className="rounded-md border overflow-hidden">
          <QueryFeedback query={inventoryQuery} label="inventory" />
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
              {inventoryQuery.isPending ? (
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
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center">
                        {inventoryQuery.isError ? "Records unavailable. Use Retry above." : "No matching records. Try adjusting your filters."}
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
          <PaginationInventory table={table} />
        </div>
      </div>
    </>
  );
}
