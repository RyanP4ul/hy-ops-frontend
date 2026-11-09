"use client";
import Link from "next/link";
import { formatCurrency } from "@/utils/date-util";

import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";


import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { DialogMode } from "@/types/dialog";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  Check,
  CircleX,
  Edit,
  Eye,
  NotepadText,
  Plus,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { OrderRow } from "@/schema/order";
import { useOrders } from "../provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


export default function DataTable() {
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
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setSearch, setPage]);

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
        cell: ({ row }) => <div><p className="font-medium">{row.original.product_number}</p>{row.original.order_group_number && <p className="mt-1 text-xs text-muted-foreground">{row.original.order_group_number} / {row.original.order_group_position} of {row.original.order_group_size}</p>}</div>,
      },
      {
        accessorKey: "warehouse_name",
        header: () => sortableHeader("warehouse_name", "Warehouse"),
      },
      {
        accessorKey: "shipping_address",
        header: "Shipping destination",
        cell: ({ row }) => <p className="min-w-48 max-w-72 whitespace-normal text-sm">{row.original.shipping_address || "Address unavailable"}</p>,
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
            PENDING: "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
            PROCESSING: "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
            IN_TRANSIT: "border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
            COMPLETED: "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
            CANCELLED: "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
          };

          const status = row.original.status;
          const label = statusLabels[status] ?? status;
          const colorClass =
            statusColors[status] ?? "border border-border bg-muted text-muted-foreground";

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
            {(["SCHEDULING", "SCHEDULED", "IN_TRANSIT", "COMPLETED"].includes(row.original.status) || row.original.delivery_type === "LALAMOVE") && <Link className="self-center whitespace-nowrap text-xs underline" href={`/panel/lalamove?orderId=${row.original.id}`}>{row.original.delivery_type === "LALAMOVE" ? "Lalamove delivery" : "Delivery method"}</Link>}
            {/* View Order */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
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
                      variant="ghost"
                      size="icon-sm"
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
                      variant="ghost"
                      size="icon-sm"
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
                      variant="ghost"
                      size="icon-sm"
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
                      variant="ghost"
                      size="icon-sm"
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
                      variant="ghost"
                      size="icon-sm"
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

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  function resetFilters() {
    clearSearch();
    setDeliveryType("ALL");
    setSortBy({ id: "id", type: "desc" });
  }

  const deliveryOptions = [
    { value: "ALL", label: "All delivery methods" },
    { value: "LALAMOVE", label: "Lalamove" },
    { value: "PICKUP", label: "Customer pickup" },
    { value: "INTERNAL", label: "Company delivery" },
  ];
  const filtered = Boolean(search || deliveryType !== "ALL");

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Order history" description="Review order progress, customer details, and saved checkout totals."
        total={ordersQuery.data?.total} isFetching={ordersQuery.isFetching} onRefresh={() => void ordersQuery.refetch()}
        actions={<Button size="sm" onClick={() => { startOrder(); openModal(DialogMode.INSERT, { title: "Create Order", description: "Add a new order below.", action: "Create Order" }); }}><Plus className="size-4" aria-hidden="true" />Add order</Button>} />
      <div className="space-y-3 border-b bg-muted/20 p-4 md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <ManagementSearch id="order-search" value={searchInput} placeholder="Search orders…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
          <Select items={deliveryOptions} value={deliveryType} onValueChange={(value) => { if (value) { setDeliveryType(value); setPage((current) => ({ ...current, pageIndex: 0 })); } }}>
            <SelectTrigger className="h-10 w-full bg-background sm:w-52" aria-label="Filter by delivery method"><SelectValue /></SelectTrigger>
            <SelectContent>{deliveryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="h-10 bg-background" onClick={() => { setSortBy({ id: "id", type: sortBy.id === "id" && sortBy.type === "desc" ? "asc" : "desc" }); setPage((current) => ({ ...current, pageIndex: 0 })); }}>
            <ArrowDownUp className="size-4" aria-hidden="true" />{sortBy.id === "id" ? (sortBy.type === "asc" ? "Oldest first" : "Newest first") : "Sort by date"}
          </Button>
          {(filtered || searchInput || sortBy.id !== "id" || sortBy.type !== "desc") && <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Totals use saved checkout prices. Missing historical prices are marked Unverified. Cancelled orders retain their recorded value.</p>
      </div>
      <QueryFeedback query={ordersQuery} label="orders" />
      <ManagementTableView table={table} loading={ordersQuery.isPending} isFetching={ordersQuery.isFetching} error={ordersQuery.isError} filtered={filtered} label="orders" />
      <ManagementListFooter table={table} total={ordersQuery.data?.total ?? 0} isFetching={ordersQuery.isFetching} label="Orders" />
    </section>
  );
}
