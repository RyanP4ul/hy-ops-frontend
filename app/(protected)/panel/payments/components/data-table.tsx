"use client";

import { TableActions, type TableAction } from "@/components/table-actions";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp, Eye, ListCollapse, ListOrdered, Plus, RotateCcw } from "lucide-react";
import { ManagementListFooter, ManagementListHeader, ManagementSearch, ManagementTableView } from "@/components/management-list";
import { useModal } from "@/components/providers/modal-provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { QueryFeedback } from "@/components/query-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REQUESTS } from "@/constant/request";
import type { GroupedPayment, PaymentListEntry, PaymentRowType } from "@/schema/payment";
import { DialogMode } from "@/types/dialog";
import { formatCurrency } from "@/utils/date-util";
import { debounce } from "@/utils/debounce";
import { usePayments } from "../provider";
import { canCollect, orderLabel, OrderPaymentStatus, paymentMethods } from "./payment-summary";
import { RefundControl } from "./refund-control";

const receiptDate = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatReceivedAt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? receiptDate.format(date) : "Date unavailable";
}

function GroupPaymentStatus({ orders }: { orders: PaymentRowType[] }) {
  const active = orders.filter(order => order.order_status !== "CANCELLED");
  const outstanding = active.filter(canCollect).length;
  const unverified = active.filter(order => order.payment_status === "UNVERIFIED" || order.remaining_amount == null).length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {outstanding > 0 && (
        <Badge variant="secondary">{outstanding} {outstanding === 1 ? "order has" : "orders have"} a balance</Badge>
      )}
      {unverified > 0 && <Badge variant="outline">{unverified} unverified</Badge>}
      {outstanding === 0 && unverified === 0 && (
        <Badge variant={active.length ? "default" : "secondary"}>
          {active.length ? "No balance due" : "All orders cancelled"}
        </Badge>
      )}
    </div>
  );
}

function GroupPaymentActions({ payment, onDetails, onAddPayment }: {
  payment: PaymentRowType;
  onDetails: (payment: PaymentRowType) => void;
  onAddPayment: (payment: PaymentRowType) => void;
}) {
  const [refundOpen, setRefundOpen] = useState(false);
  const refundAnchor = useRef<HTMLButtonElement>(null);
  const refundable = Number(payment.gross_received) > 0;
  const collect = canCollect(payment);
  const details: TableAction = {
    label: "View payment",
    ariaLabel: `View payment for ${orderLabel(payment)}`,
    icon: Eye,
    onClick: () => onDetails(payment),
  };

  return (
    <>
      <TableActions
        rowLabel={payment.payment_number}
        primary={collect ? { label: "Add payment", icon: Plus, onClick: () => onAddPayment(payment) } : details}
        secondary={[collect && details]}
        additional={[refundable && {
          label: "Refund / history",
          icon: RotateCcw,
          destructive: true,
          onClick: () => setRefundOpen(true),
        }]}
        menuTriggerRef={refundAnchor}
      />
      {refundable && <RefundControl payment={payment} popover={{ open: refundOpen, onOpenChange: setRefundOpen, anchor: refundAnchor }} />}
    </>
  );
}

function GroupDetails({ group, onDetails, onAddPayment }: {
  group: GroupedPayment;
  onDetails: (payment: PaymentRowType) => void;
  onAddPayment: (payment: PaymentRowType) => void;
}) {
  return (
    <section id={`payment-orders-${group.group_id}`} aria-label={`Orders for ${group.payment_number}`} className="space-y-3">
      {(group.payment_type || group.reference_number) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {group.payment_type && <div><dt className="inline text-muted-foreground">Payment type </dt><dd className="inline break-all">{group.payment_type}</dd></div>}
          {group.reference_number && <div><dt className="inline text-muted-foreground">Reference </dt><dd className="inline break-all">{group.reference_number}</dd></div>}
        </dl>
      )}
      <ul className="grid gap-2">
        {group.orders.map(payment => (
          <li key={payment.id} className="grid gap-x-5 gap-y-3 rounded-lg border bg-card px-4 py-3 lg:grid-cols-[minmax(9rem,1fr)_minmax(12rem,1fr)_auto] lg:items-center">
            <div>
              <p className="font-semibold">{orderLabel(payment)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{payment.payment_number}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
              <div>
                <dt className="text-xs text-muted-foreground">Original allocation</dt>
                <dd>{formatCurrency(payment.combined_payment_allocation)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Remaining balance</dt>
                <dd>{payment.remaining_amount == null ? "Unverified" : formatCurrency(payment.remaining_amount)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <OrderPaymentStatus payment={payment} />
              <GroupPaymentActions payment={payment} onDetails={onDetails} onAddPayment={onAddPayment} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DataTable() {
  const { paymentsQuery, page, setPage, search, setSearch, sortBy, setSortBy, setSelected, form } = usePayments();
  const { openModal } = useModal();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(search);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage(current => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setPage, setSearch]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);
  useEffect(() => subscribe(REQUESTS.PAYMENT_UPDATED, () => {
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
  }), [queryClient, subscribe]);

  const openOrderPayment = useCallback((payment: PaymentRowType, mode: DialogMode.VIEW | DialogMode.CUSTOM) => {
    setSelected({ order_id: payment.order_id, payment_number: payment.payment_number, version: payment.version, payment });
    const viewing = mode === DialogMode.VIEW;
    openModal(mode, {
      title: viewing ? "Payment details" : "Add payment",
      description: viewing ? "Review receipts, refunds, and the remaining balance for this order." : "Record money received for this order.",
      action: "Record payment",
    });
  }, [openModal, setSelected]);

  function toggleGroup(id: string) {
    setExpandedGroups(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage(current => ({ ...current, pageIndex: 0 }));
  }

  const columns = useMemo<ColumnDef<PaymentListEntry>[]>(() => {
    function sortHeader(id: string, label: string, rightAligned = false) {
      const active = sortBy.id === id;
      const SortIcon = active ? (sortBy.type === "asc" ? ArrowUp : ArrowDown) : ArrowDownUp;
      return (
        <button type="button" className={`flex w-full items-center gap-2 rounded-sm font-medium ${rightAligned ? "justify-end" : ""}`} onClick={() => {
          setSortBy(current => ({ id, type: current.id === id && current.type === "asc" ? "desc" : "asc" }));
          setPage(current => ({ ...current, pageIndex: 0 }));
        }}>
          {label}<SortIcon className="size-3 text-muted-foreground" aria-hidden="true" />
        </button>
      );
    }

    return [
      {
        id: "payment_number",
        header: () => sortHeader("payment_number", "Payment"),
        cell: ({ row: { original } }) => {
          if (original.entry_type === "GROUP") {
            return (
              <div className="min-w-36 max-w-60">
                <span className="break-all font-semibold">{original.payment_number}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {original.orders.length} {original.orders.length === 1 ? "order" : "orders"}
                </p>
              </div>
            );
          }
          return (
            <div>
              <span className="font-semibold">{original.payment.payment_number}</span>
              <p className="mt-1 text-xs text-muted-foreground">{orderLabel(original.payment)}</p>
            </div>
          );
        },
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row: { original } }) => {
          const payment = original.entry_type === "GROUP" ? original : original.payment;
          return <span className="block min-w-24 max-w-44 whitespace-normal break-words">{payment.customer_name ?? `Customer #${payment.customer_id}`}</span>;
        },
      },
      {
        id: "payment_method",
        header: "Method",
        cell: ({ row: { original } }) => paymentMethods[original.entry_type === "GROUP" ? original.payment_method : original.payment.payment_method],
      },
      {
        id: "received_amount",
        header: () => sortHeader("received_amount", "Received", true),
        cell: ({ row: { original } }) => (
          <div className="text-right tabular-nums">
            <span className="font-medium">{formatCurrency(original.entry_type === "GROUP" ? original.received_amount : original.payment.gross_received)}</span>
            {original.entry_type === "GROUP" && <p className="mt-1 text-xs text-muted-foreground">Original receipt</p>}
          </div>
        ),
      },
      {
        id: "status",
        header: "Payment status",
        cell: ({ row: { original } }) => original.entry_type === "GROUP"
          ? <GroupPaymentStatus orders={original.orders} />
          : <OrderPaymentStatus payment={original.payment} />,
      },
      {
        id: "received_at",
        header: () => sortHeader("received_at", "Received at"),
        cell: ({ row: { original } }) => formatReceivedAt(original.entry_type === "GROUP" ? original.received_at : original.payment.received_at),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row: { original } }) => {
          if (original.entry_type === "GROUP") {
            const expanded = expandedGroups.has(original.group_id);
            return (
              <TableActions
                rowLabel={original.payment_number}
                primary={{
                  label: expanded ? "Hide orders" : "Show orders",
                  icon: expanded ? ListCollapse : ListOrdered,
                  expanded,
                  controls: expanded ? `payment-orders-${original.group_id}` : undefined,
                  onClick: () => toggleGroup(original.group_id),
                }}
              />
            );
          }
          return (
            <TableActions
              rowLabel={original.payment.payment_number}
              primary={{
                label: "View payment",
                icon: Eye,
                onClick: () => openOrderPayment(original.payment, DialogMode.VIEW),
              }}
            />
          );
        },
      },
    ];
  }, [expandedGroups, openOrderPayment, setPage, setSortBy, sortBy]);

  const total = paymentsQuery.data?.total ?? 0;
  const table = useReactTable({
    data: paymentsQuery.data?.rows ?? [],
    columns,
    getRowId: entry => entry.entry_type === "GROUP" ? entry.group_id : String(entry.payment.id),
    pageCount: Math.max(1, Math.ceil(total / page.pageSize)),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Payment records" description="Review receipts and expand combined payments to see each order."
        total={paymentsQuery.data?.total} isFetching={paymentsQuery.isFetching} onRefresh={() => void paymentsQuery.refetch()}
        actions={<Button size="sm" onClick={() => {
          setSelected({ order_id: -1, payment_number: "", version: -1 });
          form.reset({ order_id: -1, payment_number: "", payment_amount: 0, version: -1 });
          openModal(DialogMode.INSERT, { title: "Add payment", description: "Choose an order and record the money received from the customer.", action: "Record payment" });
        }}><Plus className="size-4" aria-hidden="true" />Add payment</Button>} />
      <div className="border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="payment-search" value={searchInput} placeholder="Search payments by customer, order, or reference" onChange={value => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
      </div>
      <QueryFeedback query={paymentsQuery} label="payments" />
      <ManagementTableView table={table} loading={paymentsQuery.isPending} isFetching={paymentsQuery.isFetching} error={paymentsQuery.isError} filtered={Boolean(search)} label="payments"
        getHeaderAriaSort={id => id === sortBy.id ? (sortBy.type === "asc" ? "ascending" : "descending") : undefined}
        renderRowDetails={({ original }) => original.entry_type === "GROUP" && expandedGroups.has(original.group_id) ? (
          <GroupDetails group={original} onDetails={payment => openOrderPayment(payment, DialogMode.VIEW)} onAddPayment={payment => openOrderPayment(payment, DialogMode.CUSTOM)} />
        ) : null} />
      <ManagementListFooter table={table} total={total} isFetching={paymentsQuery.isFetching} label="Payments" />
    </section>
  );
}
