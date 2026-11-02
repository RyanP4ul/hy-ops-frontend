"use client";
import { formatCurrency } from "@/utils/date-util";

import { QueryFeedback } from "@/components/query-feedback";


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
  ArrowDownUp,
  Calendar,
  Check,
  CircleX,
  Edit,
  Eye,
  Loader2Icon,
  NotepadText,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { OrderRow } from "@/schema/order";
import { useOrders } from "../provider";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PaginationOrders from "./pagination";
import { REQUESTS } from "@/constant/request";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type OrdersQueryData = {
  rows: (OrderRow & { version: number })[];
  total: number;
};

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const {
    ordersQuery,
    page,
    setPage,
    search,
    setSearch,
    setSelected,
    sortBy,
    setSortBy,
    deliveryType,
    setDeliveryType,
    startOrder,
  } = useOrders();
  const { openModal } = useModal();
  const { viewOrder } = useOrders();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce(setSearch, 500), [setSearch]);

  const sortableHeader = (id: string, label: string) => (
    <button
      type="button"
      className="flex items-center gap-2 cursor-pointer text-left"
      onClick={() => {
        setPage(current => ({ ...current, pageIndex: 0 }));
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
    </button>
  );

  const columns = useMemo<ColumnDef<OrderRow & { version: number }>[]>(
    () => [
      {
        accessorKey: "product_number",
        header: () => sortableHeader("product_number", "Order Number"),
      },
      {
        accessorKey: "warehouse_name",
        header: () => sortableHeader("warehouse_name", "Warehouse"),
      },
      {
        accessorKey: "customer_name",
        header: () => sortableHeader("customer_name", "Customer"),
        cell: ({ row }) => (
          <div className="min-w-36 space-y-1">
            <p className="font-medium">{row.original.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.customer_company}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "item_count",
        header: () => sortableHeader("item_count", "Items"),
        cell: ({ row }) => (
          <div>
            <p>{row.original.item_count} products</p>
            <p className="text-xs text-muted-foreground">
              {row.original.total_quantity} units
            </p>
          </div>
        ),
      },
      // {
      //   accessorKey: "delivery_type",
      //   header: () => sortableHeader("delivery_type", "Delivery"),
      //   cell: ({ row }) => {
      //     const labels: Record<string, string> = {
      //       LALAMOVE: "Lalamove",
      //       PICKUP: "Customer pickup",
      //       INTERNAL: "Company delivery",
      //     };
      //     return (
      //       <Badge variant="secondary">
      //         {labels[row.original.delivery_type] ?? row.original.delivery_type}
      //       </Badge>
      //     );
      //   },
      // },
      {
        accessorKey: "status",
        header: () => "Order Status",
        cell: ({ row }) => {
          const statusLabels: Record<string, string> = {
            PENDING: "Pending",
            PROCESSING: "Processing",
            SCHEDULING: "Scheduling",
            SCHEDULED: "Scheduled",
            IN_TRANSIT: "In Transit",
            COMPLETED: "Completed",
            CANCELLED: "Cancelled",
          };

          const statusColors: Record<string, string> = {
            PENDING: "bg-yellow-100 text-yellow-800",
            PROCESSING: "bg-blue-100 text-blue-800",
            IN_TRANSIT: "bg-purple-100 text-purple-800",
            COMPLETED: "bg-green-100 text-green-800",
            CANCELLED: "bg-red-100 text-red-800",
          };

          const status = row.original.status;
          const label = statusLabels[status] ?? status;
          const colorClass =
            statusColors[status] ?? "bg-gray-100 text-gray-800";

          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
            >
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: "total",
        header: () => sortableHeader("total", "Total"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-right font-medium">
            {row.original.total === null
              ? "Unverified"
              : formatCurrency(row.original.total)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {/* View Order */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="View order"
                    onClick={() => {
                      setSelected({
                        id: row.original.id,
                        version: row.original.version,
                      });

                      viewOrder(row.original.id);

                      openModal(DialogMode.VIEW, {
                        title: `Order #${row.original.id}`,
                        description: "View order details and items.",
                        action: "Close",
                      });
                    }}
                  >
                    <Eye className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <p>View Order</p>
              </TooltipContent>
            </Tooltip>

            {/* Edit Order: PENDING or PROCESSING */}
            {(row.original.status === "PENDING" ||
              row.original.status === "PROCESSING") && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Edit order"
                      disabled={ordersQuery.isFetching}
                      onClick={() => {
                        setSelected({
                          id: row.original.id,
                          version: row.original.version,
                        });

                        openModal(DialogMode.EDIT, {
                          title: "Edit Order",
                          description: "Update this order.",
                          action: "Save changes",
                        });
                      }}
                    >
                      <Edit className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>Edit Order</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Process Order: PENDING */}
            {row.original.status === "PENDING" && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Process order"
                      disabled={ordersQuery.isFetching}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={() => {
                        setSelected(row.original);

                        openModal(DialogMode.CUSTOM, {
                          title: "Process Order",
                          description: `Are you sure you want to start processing order #${row.original.id}?`,
                          action: "Process Order",
                        });
                      }}
                    >
                      <Check className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>Process Order</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Ready for Delivery: PROCESSING */}
            {row.original.status === "PROCESSING" && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Mark ready for delivery"
                      disabled={ordersQuery.isFetching}
                      className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      onClick={() => {
                        setSelected(row.original);

                        openModal(DialogMode.CUSTOM, {
                          title: "Ready for Delivery",
                          description: `Mark order #${row.original.id} ready for scheduling? A delivery run is assigned from Delivery Schedules.`,
                          action: "Mark ready for delivery",
                        });
                      }}
                    >
                      <Truck className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>Mark ready for delivery</p>
                </TooltipContent>
              </Tooltip>
            )}

            {(row.original.status === "SCHEDULING" ||
              row.original.status === "SCHEDULED" ||
              row.original.status === "IN_TRANSIT" ||
              row.original.status === "COMPLETED") && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Invoice"
                      onClick={() => {
                        setSelected({
                          id: row.original.id,
                          version: row.original.version,
                        });
                        openModal(DialogMode.CUSTOM, {
                          title: `Invoice`,
                          description: `Invoice for order #${row.original.id}.`,
                          action: "Generate PDF",
                        });
                      }}
                    >
                      <NotepadText className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>Invoice</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Cancel Order: PENDING or PROCESSING */}
            {(row.original.status === "PENDING" ||
              row.original.status === "PROCESSING") && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Cancel order"
                      disabled={ordersQuery.isFetching}
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelected(row.original);

                        openModal(DialogMode.CANCEL, {
                          title: "Cancel Order",
                          description: `Are you sure you want to cancel order #${row.original.id}? This action may not be reversible.`,
                          action: "Cancel Order",
                        });
                      }}
                    >
                      <CircleX className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>Cancel Order</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [openModal, setSelected, viewOrder, sortBy, setSortBy, setPage, ordersQuery.isFetching],
  );

  const table = useReactTable({
    data: ordersQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((ordersQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative sm:w-64">
            <InputGroup className="max-w-md">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search orders..."
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setPage((current) => ({ ...current, pageIndex: 0 }));
                  debouncedSearch(event.target.value);
                }}
              />
            </InputGroup>
          </div>

          <Select
            value={deliveryType}
            onValueChange={(value) => {
              if (value) {
                setDeliveryType(value);
                setPage((current) => ({ ...current, pageIndex: 0 }));
              }
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filter by delivery method">
              <SelectValue placeholder="Delivery method" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectItem value="ALL">All delivery methods</SelectItem>
                <SelectItem value="LALAMOVE">Lalamove</SelectItem>
                <SelectItem value="PICKUP">Customer pickup</SelectItem>
                <SelectItem value="INTERNAL">Company delivery</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => { setSortBy({ id: "id", type: sortBy.id === "id" && sortBy.type === "desc" ? "asc" : "desc" }); setPage(current => ({ ...current, pageIndex: 0 })); }}>
            <ArrowDownUp className="mr-2 size-4" />
            {sortBy.id === "id" && sortBy.type === "asc" ? "Oldest first" : "Newest first"}
            {/* {sortOrder === "newest" ? "Newest first" : "Oldest first"} */}
          </Button>
        </div>
        <Button
          type="button"
          variant="default"
          size="lg"
          className="cursor-pointer"
          onClick={() => {
            startOrder();
            openModal(DialogMode.INSERT, {
              title: "Create Order",
              description: "Add a new order below.",
              action: "Create Order",
            });
          }}
        >
          <Plus className="h-3 w-3" />
          <span>Add Order</span>
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <QueryFeedback query={ordersQuery} label="orders" />
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
            {ordersQuery.isPending ? (
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
          <PaginationOrders table={table} />
        </div>
      </div>
    </>
  );
}
