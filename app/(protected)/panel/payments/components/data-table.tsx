"use client";
import { formatCurrency } from "@/utils/date-util";

import { RefundControl } from "./refund-control";
import { QueryFeedback } from "@/components/query-feedback";


import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CreditCard, Info, Search } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePayments } from "../provider";
import PaymentPagination from "./pagination";
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
  } = usePayments();
  const { openModal } = useModal();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(search);
  const columns = useMemo<ColumnDef<PaymentRowType>[]>(
    () => [
      { id: "received", header: "Total received", cell: ({ row }) => formatCurrency(row.original.gross_received) },
      { id: "refunded", header: "Refunded", cell: ({ row }) => formatCurrency(row.original.refunded_amount) },
      {
        accessorKey: "payment_number",
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
          formatCurrency(row.original.amount),
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

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(event) => {
            const value = event.target.value;
            setSearchInput(value);
            setSearch(value);
            setPage((current) => ({ ...current, pageIndex: 0 }));
          }}
          placeholder="Search payments..."
          className="pl-9"
        />
      </div>
      <div className="rounded-md border">
        <QueryFeedback query={paymentsQuery} label="payments" />
            <Table>
          <TableHeader>
            <TableRow>
              {table.getHeaderGroups()[0].headers.map((header) => (
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
            {paymentsQuery.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading payments...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No payment records found.
                </TableCell>
              </TableRow>
            ) : (
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
            )}
          </TableBody>
        </Table>
      </div>
      <PaymentPagination table={table} />
    </div>
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
