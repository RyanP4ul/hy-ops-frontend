"use client";

import { OrderDetailsAction } from "./order-details-action";
import { RefundPickupAction } from "./refund-pickup-action";
import { RunActions } from "./run-actions";
import { QueryFeedback } from "@/components/query-feedback";


import { useRouter } from "next/navigation";
import { useModal } from "@/components/providers/modal-provider";
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
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Loader2Icon,
  PencilLine,
  Plus,
  Search,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { debounce } from "@/utils/debounce";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQUESTS } from "@/constant/request";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeliveries } from "../provider";
import { DeliveriesRow } from "@/schema/deliveries";
import { formatDate, formatTime } from "@/utils/time";

type DeliveriesQueryData = {
  rows: DeliveriesRow[];
  total: number;
};

export default function DataTable() {
  const router = useRouter();
  const { subscribe } = useWebSocket();
  const {
    deliveriesQuery,
    event_form,
    assignment_form,
    setAssignmentWarehouseId,
    page,
    setPage,
    search,
    setSearch,
  } = useDeliveries();
  const { openModal } = useModal();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce(setSearch, 500), [setSearch]);

  const columns = useMemo<ColumnDef<DeliveriesRow>[]>(
    () => [
      {
        accessorKey: "driver_name",
        header: () => "Driver Name",
      },
      {
        accessorKey: "vehicle",
        header: () => "Vehicle",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <p className="font-medium">{row.original.vehicle_plate_number}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.vehicle_type}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "delivery_type",
        header: () => "Delivery Type",
      },
      {
        accessorKey: "scheduled_date",
        header: () => "Scheduled Date",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {formatDate(row.original.scheduled_date)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "departure_time",
        header: () => "Departure Time",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {formatTime(row.original.departure_time)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "items",
        header: () => "Items",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            {row.original.pickups?.map(pickup => <p key={`pickup-${pickup.id}`} className="text-sm text-rose-600">Pickup: {pickup.orderNumber} / {pickup.status}</p>)}
            {row.original.orders.map((order) => (
              <div key={order.order_id} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{order.order_number}{order.return_status && <span className="ml-2 text-rose-600">Refunded / {order.return_status}</span>}</p>
                  <Badge variant={"ghost"}>{order.status}</Badge>
                  {order.failure_reason && <span className="max-w-48 text-xs text-destructive">{order.failure_reason}</span>}
                </div>
                <OrderDetailsAction orderId={order.order_id} orderNumber={order.order_number} />
              </div>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => "Status",
        cell: ({ row }) => {
          const status = row.original.status?.toUpperCase?.() ?? "";

          return (
            <div className="flex flex-col gap-1">
              <Badge
                variant={status === "CANCELLED" ? "destructive" : "outline"}
                className="uppercase"
              >
                {row.original.status}
              </Badge>
              {row.original.is_overdue && <span className="text-xs text-destructive">Overdue: Reschedule before dispatch</span>}
            </div>
          );
        },
      },

      // {
      //   accessorKey: "customer_name",
      //   header: () => sortableHeader("customer_name", "Customer"),
      //   cell: ({ row }) => (
      //     <div className="min-w-36 space-y-1">
      //       <p className="font-medium">{row.original.customer_name}</p>
      //       <p className="text-xs text-muted-foreground">
      //         {row.original.customer_company}
      //       </p>
      //     </div>
      //   ),
      // },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const status = row.original.status?.toUpperCase?.() ?? "";

          return (
            <div className="flex flex-wrap gap-2">
              <RefundPickupAction orders={row.original.orders} />
              <RunActions id={row.original.delivery_id} status={row.original.status} overdue={row.original.is_overdue} />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Delivery Event"
                      disabled={status !== "SCHEDULED"}
                      onClick={() => {
                        event_form.setValue(
                          "delivery_id",
                          row.original.delivery_id,
                        );
                        event_form.setValue(
                          "delivery_version",
                          row.original.version,
                        );
                        openModal(DialogMode.CUSTOM, {
                          title: "Delivery Event",
                          description:
                            "Please provide the reason for cancelling or rescheduling the delivery.",
                          action: "Submit",
                        });
                      }}
                    >
                      <PencilLine className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>Delivery Event</p>
                </TooltipContent>
              </Tooltip>
              {status === "SCHEDULED" && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Change Driver and Vehicle"
                        onClick={() => {
                          assignment_form.reset({
                            delivery_id: row.original.delivery_id,
                            driver_id: -1,
                            vehicle_id: -1,
                            delivery_version: row.original.version,
                          });
                          setAssignmentWarehouseId(
                            row.original.warehouse?.id ?? -1,
                          );
                          openModal(DialogMode.CHANGE_ASSIGNMENT, {
                            title: "Change Driver and Vehicle",
                            description:
                              "Select a new driver and vehicle for this scheduled delivery.",
                            action: "Save",
                          });
                        }}
                      >
                        <Truck className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>Change Driver and Vehicle</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [assignment_form, openModal, setAssignmentWarehouseId, event_form],
  );

  const table = useReactTable({
    data: deliveriesQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((deliveriesQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const queryKey = ["deliveries", page.pageIndex, page.pageSize, search];

    return subscribe(
      [REQUESTS.DELIVERY_CREATED, REQUESTS.DELIVERY_UPDATED],
      (message) => {
        const delivery = message.payload as DeliveriesRow;

        queryClient.setQueryData(
          queryKey,
          (oldData: DeliveriesQueryData | undefined) => {
            if (!oldData) return { rows: [delivery], total: 1 };

            const exists = oldData.rows.some(
              (row) => row.delivery_id === delivery.delivery_id,
            );

            return {
              rows: exists
                ? oldData.rows.map((row) =>
                    row.delivery_id === delivery.delivery_id ? delivery : row,
                  )
                : [delivery, ...oldData.rows].slice(0, page.pageSize),
              total: exists ? oldData.total : oldData.total + 1,
            };
          },
        );
      },
    );
  }, [page.pageIndex, page.pageSize, queryClient, search, subscribe]);

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
                placeholder="Search deliveries or customers..."
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setPage((current) => ({ ...current, pageIndex: 0 }));
                  debouncedSearch(event.target.value);
                }}
              />
            </InputGroup>
          </div>
        </div>
        <Button
          type="button"
          variant="default"
          size="lg"
          className="cursor-pointer"
          onClick={() => router.push("/panel/delivery-schedules")}
        >
          <Plus className="h-3 w-3" />
          <span>Schedule Delivery</span>
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <QueryFeedback query={deliveriesQuery} label="deliveries" />
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
            {deliveriesQuery.isPending ? (
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
                      {row.getVisibleCells().map((cell) => {
                        const renderedCell = cell.column.columnDef.cell
                          ? flexRender(cell.column.columnDef.cell, cell.getContext())
                          : cell.getValue();

                        return (
                          <TableCell key={cell.id}>{renderedCell as ReactNode}</TableCell>
                        );
                      })}
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
          {/* <PaginationOrders table={table} /> */}
        </div>
      </div>
    </>
  );
}
