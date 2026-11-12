"use client";

import { OrderDetailsAction } from "./order-details-action";
import { DeliveryExpensesAction } from "./delivery-expenses-action";
import { ProofOfDeliveryAction } from "./proof-of-delivery-action";
import { RefundPickupAction } from "./refund-pickup-action";
import { RunActions } from "./run-actions";
import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";


import { useRouter } from "next/navigation";
import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { DialogMode } from "@/types/dialog";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  PencilLine,
  Plus,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
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
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setSearch, setPage]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

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
              <div key={order.order_id} className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{order.order_number}{order.return_status && <span className="ml-2 text-rose-600">Refunded / {order.return_status}</span>}</p>
                  <Badge variant={"ghost"}>{order.status}</Badge>
                  {order.failure_reason && <span className="max-w-48 text-xs text-destructive">{order.failure_reason}</span>}
                </div>
                <OrderDetailsAction orderId={order.order_id} orderNumber={order.order_number} />
                {order.stop_id != null && <ProofOfDeliveryAction stopId={order.stop_id} orderNumber={order.order_number} />}
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
                className="capitalize"
              >
                {row.original.status.replace(/_/g, " ")}
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
              <DeliveryExpensesAction deliveryId={row.original.delivery_id} />
              <RefundPickupAction orders={row.original.orders} />
              <RunActions
                id={row.original.delivery_id}
                status={row.original.status}
                overdue={row.original.is_overdue}
                warehouseName={row.original.warehouse?.name}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
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
                        variant="ghost"
                        size="icon-sm"
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

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Delivery runs" description="Review assignments, follow progress, and manage delivery events." total={deliveriesQuery.data?.total} isFetching={deliveriesQuery.isFetching} onRefresh={() => void deliveriesQuery.refetch()} actions={<Button size="sm" onClick={() => router.push("/panel/delivery-schedules")}><Plus className="size-4" aria-hidden="true" />Schedule delivery</Button>} />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="deliveries-search" value={searchInput} placeholder="Search deliveries or customers…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
        {(search || searchInput) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
      </div>
      <QueryFeedback query={deliveriesQuery} label="deliveries" />
      <ManagementTableView table={table} loading={deliveriesQuery.isPending} isFetching={deliveriesQuery.isFetching} error={deliveriesQuery.isError} filtered={Boolean(search)} label="deliveries" />
      <ManagementListFooter table={table} total={deliveriesQuery.data?.total ?? 0} isFetching={deliveriesQuery.isFetching} label="deliveries" />
    </section>
  );
}
