"use client";
import { formatCurrency } from "@/utils/date-util";

import { RefundControl } from "./refund-control";
import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";
import { debounce } from "@/utils/debounce";


import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CreditCard, Info, Plus } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { usePayments } from "../provider";
import { Button } from "@/components/ui/button";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { PaymentRowType } from "@/schema/payment";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

const labels: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  UNVERIFIED: "Unverified",
};

export default function DataTable() {
  const {
    paymentsQuery,
    page,
    setPage,
    search,
    setSearch,
    setSortBy,
    setSelected,
    form,
  } = usePayments();
  const { openModal } = useModal();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setPage, setSearch]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);
  const columns = useMemo<ColumnDef<PaymentRowType>[]>(
    () => [
      { id: "received", header: "Total received", cell: ({ row }) => formatCurrency(row.original.gross_received) },
      { id: "refunded", header: "Refunded", cell: ({ row }) => formatCurrency(row.original.refunded_amount) },
      {
        accessorKey: "payment_number",
        cell: ({ row }) => <span className="font-medium">{row.original.payment_number}</span>,
        header: () => (
          <SortableHeader
            label="Payment number"
            id="payment_number"
            setSortBy={setSortBy}
          />
        ),
      },
      { accessorKey: "order_id", header: "Order" },
      { accessorKey: "combined_payment_number", header: "Combined payment", cell: ({ row }) => row.original.combined_payment_number
        ? <div className="max-w-64 whitespace-normal text-xs"><p>{row.original.combined_payment_number}</p><p>Original allocation: {formatCurrency(Number(row.original.combined_payment_allocation))}</p></div>
        : "Separate payment" },
      {
        accessorKey: "customer_name",
        header: "Customer",
        cell: ({ row }) =>
          row.original.customer_name ?? `Customer #${row.original.customer_id}`,
      },
      {
        accessorKey: "payment_method",
        header: "Method",
        cell: ({ row }) =>
          labels[row.original.payment_method] ?? row.original.payment_method,
      },
      { accessorKey: "payment_type", header: "Payment type", cell: ({ row }) => row.original.payment_type || "—" },
      {
        accessorKey: "payment_status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.payment_status === "PAID" ? "default" : row.original.payment_status === "UNVERIFIED" ? "outline" : "secondary"
            }
          >
            {Number(row.original.refunded_amount) > 0 && Number(row.original.amount) === 0 ? "Fully refunded" : labels[row.original.payment_status] ?? row.original.payment_status}
          </Badge>
        ),
      },
      {
        accessorKey: "amount",
        header: () => (
          <SortableHeader label="Net received" id="amount" setSortBy={setSortBy} />
        ),
        cell: ({ row }) =>
          <span className="font-medium tabular-nums">{formatCurrency(row.original.amount)}</span>,
      },
      {
        accessorKey: "received_at",
        header: () => (
          <SortableHeader
            label="Received at"
            id="received_at"
            setSortBy={setSortBy}
          />
        ),
        cell: ({ row }) => {
          if (
            Number(row.original.gross_received) <= 0 ||
            !row.original.received_at
          ) {
            return "—";
          }

          const receivedAt = new Date(row.original.received_at);
          if (!Number.isFinite(receivedAt.getTime())) return "Date unavailable";

          return new Intl.DateTimeFormat("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          }).format(receivedAt);
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          return (
            <div className="flex flex-wrap gap-2">
              <RefundControl payment={row.original} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected({
                    order_id: row.original.order_id,
                    payment_number: row.original.payment_number,
                    version: row.original.version,
                    payment: row.original,
                  });
                  openModal(DialogMode.VIEW, {
                    title: "Payment details",
                    description:
                      "Review the amounts received, refunds and remaining order balance.",
                    action: "Record Payment",
                  });
                }}
              >
                <Info className="size-4" />
                Details
              </Button>
              {row.original.order_status !== "CANCELLED" && row.original.payment_status !== "UNVERIFIED" && row.original.remaining_amount !== null && Number.isFinite(Number(row.original.remaining_amount)) && Number(row.original.remaining_amount) > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelected({
                      order_id: row.original.order_id,
                      payment_number: row.original.payment_number,
                      version: row.original.version,
                      payment: row.original,
                    });
                    openModal(DialogMode.CUSTOM, {
                      title: "Add payment",
                      description:
                        row.original.payment_status === "UNPAID"
                          ? "Record a partial or full payment for this order."
                          : "Record the remaining balance for this order.",
                      action: "Record Payment",
                    });
                  }}
                >
                  <CreditCard className="size-4" />
                  Add payment
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [openModal, setSelected, setSortBy],
  );

  const table = useReactTable({
    data: paymentsQuery.data?.rows ?? [],
    columns,
    pageCount: Math.max(
      1,
      Math.ceil((paymentsQuery.data?.total ?? 0) / page.pageSize),
    ),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  useEffect(() => subscribe(REQUESTS.PAYMENT_UPDATED, () => {
    // Reload the current filtered page; fully paid records stay in payment history.
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
  }), [queryClient, subscribe]);

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Payment records" description="Review money received, refunded amounts, and remaining order balances."
        total={paymentsQuery.data?.total} isFetching={paymentsQuery.isFetching} onRefresh={() => void paymentsQuery.refetch()}
        actions={<Button size="sm" onClick={() => {
          setSelected({ order_id: -1, payment_number: "", version: -1 });
          form.reset({ order_id: -1, payment_number: "", payment_amount: 0, version: -1 });
          openModal(DialogMode.INSERT, { title: "Add payment", description: "Choose an order and record the money received from the customer.", action: "Record payment" });
        }}><Plus className="size-4" aria-hidden="true" />Add payment</Button>} />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="payment-search" value={searchInput} placeholder="Search payments…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
        {(search || searchInput) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
      </div>
      <QueryFeedback query={paymentsQuery} label="payments" />
      <ManagementTableView table={table} loading={paymentsQuery.isPending} isFetching={paymentsQuery.isFetching} error={paymentsQuery.isError} filtered={Boolean(search)} label="payments" />
      <ManagementListFooter table={table} total={paymentsQuery.data?.total ?? 0} isFetching={paymentsQuery.isFetching} label="Payments" />
    </section>
  );
}

function SortableHeader({
  label,
  id,
  setSortBy,
}: {
  label: string;
  id: string;
  setSortBy: React.Dispatch<React.SetStateAction<{ id: string; type: string }>>;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 font-medium"
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
}
