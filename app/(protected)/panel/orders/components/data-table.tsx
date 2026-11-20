"use client";

import { formatCurrency } from "@/utils/date-util";
import { QueryFeedback } from "@/components/query-feedback";
import {
  ManagementListHeader,
  ManagementListFooter,
  ManagementSearch,
  ManagementTableView,
} from "@/components/management-list";
import {
  formatOrderLabel,
  getOrderStatusBadgeClass,
} from "@/components/order-details";
import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogMode } from "@/types/dialog";
import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type Row,
  type RowSelectionState,
  type Updater,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  CalendarCheck,
  Check,
  CheckCheck,
  ChevronRight,
  CircleX,
  Edit,
  Eye,
  Layers,
  NotepadText,
  Plus,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { debounce } from "@/utils/debounce";
import { formatOrderGroupCode, type OrderTableRow } from "@/schema/order";
import { useOrders } from "../provider";
import { BulkOrderActions, canSelectBulkOrder } from "./bulk-order-actions";
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

const STATUS_DISPLAY_ORDER = [
  "PENDING",
  "PROCESSING",
  "SCHEDULING",
  "SCHEDULED",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED",
] as const;

export default function DataTable() {
  const {
    ordersQuery,
    page,
    setPage,
    search,
    setSearch,
    setSelected,
    setSelectedGroup,
    sortBy,
    setSortBy,
    deliveryType,
    setDeliveryType,
    startOrder,
    setWalkInOpen,
    viewOrder,
  } = useOrders();
  const { openModal } = useModal();
  const statusFilter = useSearchParams().get("status");
  const selectionScope = JSON.stringify([page, search, deliveryType, sortBy, statusFilter]);

  const [searchInput, setSearchInput] = useState(search);
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});
  const [searchCollapsed, setSearchCollapsed] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<{ scope: string; rows: RowSelectionState }>({
    scope: selectionScope,
    rows: {},
  });

  if (selection.scope !== selectionScope) {
    setSelection({ scope: selectionScope, rows: {} });
  }

  const rows = useMemo(() => ordersQuery.data?.rows ?? [], [ordersQuery.data?.rows]);
  const groupRowIds = useMemo(
    () =>
      rows
        .filter((row) => row.entry_type === "GROUP" && row.order_group_id)
        .map((row) => `group:${row.order_group_id}`),
    [rows],
  );
  const hasSearch = Boolean(search.trim());

  const expandedState = useMemo<ExpandedState>(() => {
    if (!hasSearch) return manualExpanded;
    const next: Record<string, boolean> = {};
    for (const id of groupRowIds) {
      if (!searchCollapsed[id]) {
        next[id] = true;
      }
    }
    return next;
  }, [hasSearch, manualExpanded, groupRowIds, searchCollapsed]);

  const handleExpandedChange = useCallback(
    (updater: Updater<ExpandedState>) => {
      const resolved =
        typeof updater === "function" ? updater(expandedState) : updater;
      if (resolved === true) {
        const allOpen = Object.fromEntries(groupRowIds.map((id) => [id, true]));
        if (hasSearch) {
          setSearchCollapsed({});
        } else {
          setManualExpanded(allOpen);
        }
        return;
      }
      if (hasSearch) {
        const nextCollapsed: Record<string, boolean> = {};
        for (const id of groupRowIds) {
          if (!resolved[id]) nextCollapsed[id] = true;
        }
        setSearchCollapsed(nextCollapsed);
      } else {
        setManualExpanded(resolved);
      }
    },
    [expandedState, groupRowIds, hasSearch],
  );

  const allGroupsExpanded =
    groupRowIds.length > 0 &&
    groupRowIds.every(
      (id) =>
        expandedState === true || Boolean((expandedState as Record<string, boolean>)[id]),
    );

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchCollapsed({});
        setPage((current) => ({ ...current, pageIndex: 0 }));
        setSearch(value);
      }, 350),
    [setSearch, setPage],
  );

  const sortableHeader = useCallback(
    (id: string, label: string) => (
      <button
        type="button"
        className="flex min-h-6 items-center gap-2 cursor-pointer text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setPage((current) => ({ ...current, pageIndex: 0 }));
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
    ),
    [setPage, setSortBy],
  );

  const getHeaderAriaSort = useCallback(
    (columnId: string): "ascending" | "descending" | undefined => {
      if (sortBy.id !== columnId) return undefined;
      return sortBy.type === "asc" ? "ascending" : "descending";
    },
    [sortBy.id, sortBy.type],
  );

  const columns = useMemo<ColumnDef<OrderTableRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const visibleOrders = table.getRowModel().rows.filter((row) => row.getCanSelect());
          const selectedCount = visibleOrders.filter((row) => row.getIsSelected()).length;
          const allSelected = visibleOrders.length > 0 && selectedCount === visibleOrders.length;

          return (
            <Checkbox
              aria-label="Select all visible eligible orders"
              checked={allSelected}
              indeterminate={selectedCount > 0 && !allSelected}
              disabled={visibleOrders.length === 0 || ordersQuery.isFetching}
              onCheckedChange={(checked) => {
                table.setRowSelection((current) => {
                  const next = { ...current };
                  for (const row of visibleOrders) {
                    if (checked) next[row.id] = true;
                    else delete next[row.id];
                  }
                  return next;
                });
              }}
            />
          );
        },
        cell: ({ row }) =>
          row.getCanSelect() && (
            <Checkbox
              aria-label={`Select ${row.original.product_number || `order #${row.original.id}`}`}
              checked={row.getIsSelected()}
              disabled={ordersQuery.isFetching}
              onCheckedChange={(checked) => row.toggleSelected(checked)}
            />
          ),
      },
      {
        accessorKey: "product_number",
        header: () => sortableHeader("product_number", "Order Number"),
        cell: ({ row }) => {
          const item = row.original;
          const isGroup = row.depth === 0 && item.entry_type === "GROUP";
          const isChild = row.depth > 0;

          if (isGroup) {
            const fullCode = item.order_group_number || item.product_number || "Order Group";
            const shortCode = formatOrderGroupCode(fullCode);
            const isExpanded = row.getIsExpanded();
            const activeCount = item.active_member_count ?? item.order_group_size ?? 0;
            const readyCount = item.ready_for_scheduling_count ?? 0;
            const showReadiness =
              activeCount > 0 &&
              ((item.pending_action_count ?? 0) > 0 ||
                (item.processing_action_count ?? 0) > 0 ||
                readyCount > 0);

            return (
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={row.getToggleExpandedHandler()}
                  aria-expanded={isExpanded}
                  aria-label={`Orders in group ${fullCode}`}
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight
                    className={`size-4 transition-transform duration-150 motion-reduce:transition-none ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Layers
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {shortCode}
                          </span>
                        }
                      />
                      <TooltipContent>
                        <p className="font-mono text-xs">{fullCode}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      {item.order_group_size ?? item.members?.length ?? 0} orders
                    </Badge>
                  </div>
                  {showReadiness && (
                    <p className="text-xs text-muted-foreground">
                      {readyCount === activeCount
                        ? `All ${activeCount} ready for scheduling`
                        : `${readyCount} of ${activeCount} ready for scheduling`}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          if (isChild) {
            return (
              <div className="ml-3 border-l-2 border-primary/35 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {item.product_number}
                  </p>
                  {item.order_group_position != null && (
                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                      #{item.order_group_position} of {item.order_group_size}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{item.product_number}</p>
                {(item.sales_channel === "WALK_IN" ||
                  item.delivery_type === "WALK_IN") && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Walk-in sale
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "warehouse_name",
        header: () => sortableHeader("warehouse_name", "Warehouse"),
        cell: ({ row }) => {
          const item = row.original;
          if (
            row.depth === 0 &&
            item.entry_type === "GROUP" &&
            item.warehouse_names &&
            item.warehouse_names.length > 1
          ) {
            return (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="text-sm font-medium text-muted-foreground underline decoration-dotted underline-offset-4">
                      {item.warehouse_name}
                    </span>
                  }
                />
                <TooltipContent>
                  <p>{item.warehouse_names.join(", ")}</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          return <span>{item.warehouse_name || "—"}</span>;
        },
      },
      {
        accessorKey: "shipping_address",
        header: "Shipping destination",
        cell: ({ row }) => {
          const item = row.original;
          if (
            row.depth === 0 &&
            item.entry_type === "GROUP" &&
            item.destinations &&
            item.destinations.length > 1
          ) {
            return (
              <div className="min-w-48 max-w-72 space-y-0.5">
                <p className="text-sm font-medium">
                  {item.destinations.length} destinations
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.destinations[0]} +{item.destinations.length - 1} more
                </p>
              </div>
            );
          }
          return (
            <p className="min-w-48 max-w-72 whitespace-normal text-sm">
              {item.shipping_address || "Address unavailable"}
            </p>
          );
        },
      },
      {
        accessorKey: "customer_name",
        header: () => sortableHeader("customer_name", "Customer"),
        cell: ({ row }) => (
          <div className="min-w-36 space-y-1">
            <p className={row.depth > 0 ? "text-sm text-muted-foreground" : "font-medium"}>
              {row.original.customer_name}
            </p>
            {row.original.customer_company && (
              <p className="text-xs text-muted-foreground">
                {row.original.customer_company}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "item_count",
        header: () => sortableHeader("item_count", "Items"),
        cell: ({ row }) => (
          <div>
            <p className="tabular-nums">
              {row.original.item_count}{" "}
              {row.original.item_count === 1 ? "product" : "products"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {row.original.total_quantity}{" "}
              {row.original.total_quantity === 1 ? "unit" : "units"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => "Order Status",
        cell: ({ row }) => {
          const item = row.original;
          const isGroup = row.depth === 0 && item.entry_type === "GROUP";

          if (isGroup && item.status === "MIXED" && item.status_counts) {
            const entries = STATUS_DISPLAY_ORDER.filter(
              (statusKey) => (item.status_counts?.[statusKey] ?? 0) > 0,
            );
            return (
              <div className="flex max-w-52 flex-wrap gap-1">
                {entries.map((statusKey) => (
                  <span
                    key={statusKey}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${getOrderStatusBadgeClass(statusKey)}`}
                  >
                    {item.status_counts![statusKey]} {formatOrderLabel(statusKey)}
                  </span>
                ))}
              </div>
            );
          }

          const status = item.status;
          const label = formatOrderLabel(status);
          const colorClass = getOrderStatusBadgeClass(status);
          const groupCount = item.order_group_size ?? item.members?.length ?? 0;

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
              >
                {label}
              </span>
              {isGroup && groupCount > 1 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.active_member_count === groupCount || status === "CANCELLED"
                    ? `All ${groupCount}`
                    : `${item.active_member_count}/${groupCount}`}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "total",
        header: () => sortableHeader("total", "Total"),
        cell: ({ row }) => {
          const isGroup = row.depth === 0 && row.original.entry_type === "GROUP";
          return (
            <span
              className={`whitespace-nowrap text-right tabular-nums ${
                isGroup ? "font-semibold" : "font-medium"
              }`}
            >
              {row.original.total === null
                ? "Unverified"
                : formatCurrency(row.original.total)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          const isGroup = row.depth === 0 && item.entry_type === "GROUP";

          if (isGroup) {
            const pendingCount = item.pending_action_count ?? 0;
            const processingCount = item.processing_action_count ?? 0;
            const groupLabel = item.order_group_number || "order group";
            const isExpanded = row.getIsExpanded();

            return (
              <div className="flex flex-wrap items-center gap-1.5">
                {pendingCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={ordersQuery.isFetching}
                          aria-label={`Process ${pendingCount} pending ${pendingCount === 1 ? "order" : "orders"} in group ${groupLabel}`}
                          className="h-8 gap-1.5 text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          onClick={() => {
                            setSelectedGroup(item);
                            openModal(DialogMode.CUSTOM, {
                              title: "Process Order Group",
                              description: `Start processing ${pendingCount} pending ${pendingCount === 1 ? "order" : "orders"} in ${groupLabel}.`,
                              action: `Process ${pendingCount} ${pendingCount === 1 ? "Order" : "Orders"}`,
                            });
                          }}
                        >
                          <CheckCheck className="size-3.5" aria-hidden="true" />
                          <span>Process ({pendingCount})</span>
                        </Button>
                      }
                    />
                    <TooltipContent>
                      <p>Process all {pendingCount} pending orders in this group</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {processingCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={ordersQuery.isFetching}
                          aria-label={`Mark ${processingCount} processing ${processingCount === 1 ? "order" : "orders"} ready for scheduling in group ${groupLabel}`}
                          className="h-8 gap-1.5 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                          onClick={() => {
                            setSelectedGroup(item);
                            openModal(DialogMode.CUSTOM, {
                              title: "Ready Group for Scheduling",
                              description: `Mark ${processingCount} processing ${processingCount === 1 ? "order" : "orders"} in ${groupLabel} ready for scheduling.`,
                              action: `Mark ${processingCount} Ready`,
                            });
                          }}
                        >
                          <CalendarCheck className="size-3.5" aria-hidden="true" />
                          <span>Ready ({processingCount})</span>
                        </Button>
                      }
                    />
                    <TooltipContent>
                      <p>Mark all {processingCount} processing orders ready for scheduling</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {pendingCount === 0 && processingCount === 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    aria-expanded={isExpanded}
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {isExpanded ? "Hide orders" : "Show orders"}
                  </Button>
                )}
              </div>
            );
          }

          return (
            <div className="flex gap-2">
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
                          id: item.id,
                          version: item.version,
                        });

                        viewOrder(item.id);

                        openModal(DialogMode.VIEW, {
                          title: item.product_number || `Order #${item.id}`,
                          description: "Order progress, customer details, and items.",
                          action: "Close",
                        });
                      }}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>View Order</p>
                </TooltipContent>
              </Tooltip>

              {/* Edit Order: PENDING or PROCESSING */}
              {(item.status === "PENDING" || item.status === "PROCESSING") && (
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
                            id: item.id,
                            version: item.version,
                          });

                          openModal(DialogMode.EDIT, {
                            title: "Edit Order",
                            description: "Update this order.",
                            action: "Save changes",
                          });
                        }}
                      >
                        <Edit className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>Edit Order</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Process Order: PENDING */}
              {item.status === "PENDING" && (
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
                          setSelected(item);

                          openModal(DialogMode.CUSTOM, {
                            title: "Process Order",
                            description: `Review items and start processing ${item.product_number || `order #${item.id}`}.`,
                            action: "Process Order",
                          });
                        }}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>Process Order</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Ready for Scheduling: PROCESSING */}
              {item.status === "PROCESSING" && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ready for scheduling"
                        disabled={ordersQuery.isFetching}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                        onClick={() => {
                          setSelected(item);

                          openModal(DialogMode.CUSTOM, {
                            title: "Ready for Scheduling",
                            description: `Verify prepared items and move ${item.product_number || `order #${item.id}`} to delivery scheduling.`,
                            action: "Ready for scheduling",
                          });
                        }}
                      >
                        <CalendarCheck className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>Ready for scheduling</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {(item.status === "SCHEDULING" ||
                item.status === "SCHEDULED" ||
                item.status === "IN_TRANSIT" ||
                item.status === "COMPLETED") && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Invoice"
                        onClick={() => {
                          setSelected({
                            id: item.id,
                            version: item.version,
                          });
                          openModal(DialogMode.CUSTOM, {
                            title: `Invoice`,
                            description: `Invoice for order #${item.id}.`,
                            action: "Generate PDF",
                          });
                        }}
                      >
                        <NotepadText className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>Invoice</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Unassigned walk-in deliveries can also be cancelled before dispatch. */}
              {(item.status === "PENDING" ||
                item.status === "PROCESSING" ||
                (item.status === "SCHEDULING" &&
                  item.sales_channel === "WALK_IN" &&
                  item.delivery_type === "INTERNAL")) && (
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
                          setSelected(item);

                          openModal(DialogMode.CANCEL, {
                            title: "Cancel Order",
                            description: `Cancel order #${item.id}? Reserved stock will be released. Any recorded payment must be refunded separately.`,
                            action: "Cancel Order",
                          });
                        }}
                      >
                        <CircleX className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>Cancel Order</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [
      openModal,
      setSelected,
      setSelectedGroup,
      viewOrder,
      sortableHeader,
      ordersQuery.isFetching,
    ],
  );

  const table = useReactTable({
    data: rows,
    columns,
    pageCount: Math.ceil((ordersQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page, expanded: expandedState, rowSelection: selection.rows },
    onPaginationChange: setPage,
    onExpandedChange: handleExpandedChange,
    onRowSelectionChange: (updater) => {
      setSelection((current) => ({
        ...current,
        rows: typeof updater === "function" ? updater(current.rows) : updater,
      }));
    },
    enableRowSelection: (row) => canSelectBulkOrder(row.original),
    enableSubRowSelection: false,
    getRowId: (row) =>
      row.entry_type === "GROUP" && row.order_group_id
        ? `group:${row.order_group_id}`
        : `order:${row.id}`,
    getSubRows: (row) => (row.entry_type === "GROUP" ? row.members : undefined),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
  });

  const selectedOrders = table.getSelectedRowModel().flatRows
    .filter((row) => row.getCanSelect())
    .map((row) => row.original);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchCollapsed({});
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  function resetFilters() {
    clearSearch();
    setDeliveryType("ALL");
    setSortBy({ id: "id", type: "desc" });
  }

  const getRowClassName = useCallback((row: Row<OrderTableRow>) => {
    if (row.getIsSelected() && row.getCanSelect()) {
      return "bg-primary/5 hover:bg-primary/10";
    }
    if (row.depth > 0) {
      return "bg-muted/20 hover:bg-muted/35";
    }
    if (row.original.entry_type === "GROUP" && row.getIsExpanded()) {
      return "bg-muted/10";
    }
    return undefined;
  }, []);

  const deliveryOptions = [
    { value: "ALL", label: "All delivery methods" },
    { value: "WALK_IN", label: "Walk-in sale" },
    { value: "LALAMOVE", label: "Lalamove" },
    { value: "PICKUP", label: "Customer pickup" },
    { value: "INTERNAL", label: "Company delivery" },
  ];
  const filtered = Boolean(search || deliveryType !== "ALL");

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader
        title="Order history"
        description="Review order progress, customer details, and saved checkout totals."
        total={ordersQuery.data?.total}
        isFetching={ordersQuery.isFetching}
        onRefresh={() => void ordersQuery.refetch()}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWalkInOpen(true)}
            >
              <Store
                className="size-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Walk-in sale
            </Button>
            <Button
              size="sm"
              onClick={() => {
                startOrder();
                openModal(DialogMode.INSERT, {
                  title: "Create Order",
                  description: "Add a new order below.",
                  action: "Create Order",
                });
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add order
            </Button>
          </div>
        }
      />

      <div className="space-y-3 border-b bg-muted/20 p-4 md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <ManagementSearch
            id="order-search"
            value={searchInput}
            placeholder="Search orders…"
            onChange={(value) => {
              setSearchInput(value);
              debouncedSearch(value);
            }}
            onClear={clearSearch}
          />
          <Select
            items={deliveryOptions}
            value={deliveryType}
            onValueChange={(value) => {
              if (value) {
                setDeliveryType(value);
                setPage((current) => ({ ...current, pageIndex: 0 }));
              }
            }}
          >
            <SelectTrigger
              className="h-10 w-full bg-background sm:w-52"
              aria-label="Filter by delivery method"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {deliveryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-10 bg-background"
            onClick={() => {
              setSortBy({
                id: "id",
                type:
                  sortBy.id === "id" && sortBy.type === "desc" ? "asc" : "desc",
              });
              setPage((current) => ({ ...current, pageIndex: 0 }));
            }}
          >
            <ArrowDownUp className="size-4" aria-hidden="true" />
            {sortBy.id === "id"
              ? sortBy.type === "asc"
                ? "Oldest first"
                : "Newest first"
              : "Sort by date"}
          </Button>
          {groupRowIds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-background"
              onClick={() => {
                if (allGroupsExpanded) {
                  if (hasSearch) {
                    setSearchCollapsed(
                      Object.fromEntries(groupRowIds.map((id) => [id, true])),
                    );
                  } else {
                    setManualExpanded({});
                  }
                } else {
                  if (hasSearch) {
                    setSearchCollapsed({});
                  } else {
                    setManualExpanded(
                      Object.fromEntries(groupRowIds.map((id) => [id, true])),
                    );
                  }
                }
              }}
            >
              <Layers className="size-4" aria-hidden="true" />
              {allGroupsExpanded ? "Collapse groups" : "Expand groups"}
            </Button>
          )}
          {(filtered ||
            searchInput ||
            sortBy.id !== "id" ||
            sortBy.type !== "desc") && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Grouped orders collapse under one summary row; expand a group to
          inspect or act on individual orders. Totals use saved checkout prices,
          and missing historical prices are marked Unverified.
        </p>
      </div>
      <BulkOrderActions
        orders={selectedOrders}
        disabled={ordersQuery.isFetching || ordersQuery.isError}
        onClear={() => table.resetRowSelection()}
        onUpdated={(ids) => {
          table.setRowSelection((current) => {
            const next = { ...current };
            for (const id of ids) delete next[`order:${id}`];
            return next;
          });
        }}
      />
      <QueryFeedback query={ordersQuery} label="orders" />
      <ManagementTableView
        table={table}
        loading={ordersQuery.isPending}
        isFetching={ordersQuery.isFetching}
        error={ordersQuery.isError}
        filtered={filtered}
        label="orders"
        getRowClassName={getRowClassName}
        getHeaderAriaSort={getHeaderAriaSort}
      />
      <ManagementListFooter
        table={table}
        total={ordersQuery.data?.total ?? 0}
        isFetching={ordersQuery.isFetching}
        label="Orders"
      />
    </section>
  );
}
