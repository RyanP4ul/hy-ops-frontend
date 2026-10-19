"use client";

import { useMemo, useState } from "react";
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

const labels: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
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
  const [searchInput, setSearchInput] = useState(search);
  const columns = useMemo<ColumnDef<PaymentRowType>[]>(
    () => [
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
      {
        accessorKey: "payment_status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.payment_status === "PAID" ? "default" : "secondary"
            }
          >
            {labels[row.original.payment_status] ?? row.original.payment_status}
          </Badge>
        ),
      },
      {
        accessorKey: "amount",
        header: () => (
          <SortableHeader label="Amount" id="amount" setSortBy={setSortBy} />
        ),
        cell: ({ row }) =>
          new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
          }).format(Number(row.original.amount)),
      },
      {
        accessorKey: "received_at",
        header: () => (
          <SortableHeader
            label="Received"
            id="received_at"
            setSortBy={setSortBy}
          />
        ),
        cell: ({ row }) =>
          new Intl.DateTimeFormat("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(row.original.received_at)),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          return (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected({
                    order_id: row.original.order_id,
                    payment_number: row.original.payment_number,
                    version: row.original.version,
                  });
                  openModal(DialogMode.CUSTOM, {
                    title: "Record Payment",
                    description:
                      row.original.payment_status === "UNPAID"
                        ? "Record a partial or full payment for this order."
                        : "Record the remaining balance for this order.",
                    action: "Record Payment",
                  });
                }}
              >
                <Info className="size-4" />
                Details
              </Button>
              {row.original.payment_status === "UNPAID" ||
              row.original.payment_status === "PARTIALLY_PAID" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelected({
                      order_id: row.original.order_id,
                      payment_number: row.original.payment_number,
                      version: row.original.version,
                    });
                    openModal(DialogMode.CUSTOM, {
                      title: "Record Payment",
                      description:
                        row.original.payment_status === "UNPAID"
                          ? "Record a partial or full payment for this order."
                          : "Record the remaining balance for this order.",
                      action: "Record Payment",
                    });
                  }}
                >
                  <CreditCard className="size-4" />
                  Pay
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
