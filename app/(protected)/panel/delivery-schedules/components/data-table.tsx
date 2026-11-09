"use client";

import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";
import { DestinationEditor } from "./destination-editor";


import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { DialogMode } from "@/types/dialog";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Calendar,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { SchedulingEntry } from "@/schema/delivery-schedule";
import { useDeliverySchedule } from "../provider";
import { REQUESTS } from "@/constant/request";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const {
    form, setStep, warehouseCB, warehouseQuery, startSchedule, addReadyGroup, groupPending,
    deliveryScheduleQuery,
    page,
    setPage,
    search,
    setSearch,
  } = useDeliverySchedule();
  const { openModal } = useModal();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setSearch, setPage]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const columns = useMemo<ColumnDef<SchedulingEntry>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: () => "Order / Group",
        cell: ({ row }) => (
          <div className="min-w-36 space-y-1">
            <p className="font-medium ">{row.original.order_group_number || row.original.order_number}</p>
            <p className="text-xs text-muted-foreground">{row.original.order_group_id ? `${row.original.total_members} orders / ${row.original.ready_count} ready` : "Single order"}</p>
          </div>
        ),
      },
      {
        accessorKey: "customer_name",
        header: () => "Customer",
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
        accessorKey: "shipping_address",
        header: () => "Destination",
        cell: ({ row }) => (
          <div className="min-w-56 max-w-96 space-y-2">
            {row.original.order_group_id ? <details>
              <summary className="cursor-pointer text-sm font-medium">View {row.original.members.length} orders and destinations</summary>
              <div className="mt-3 space-y-3">{row.original.members.map(member => <div key={member.id} className="space-y-1 rounded-lg border p-2">
                <p className="font-medium">{member.order_number}</p><Badge variant="outline">{member.status}</Badge>
                <p className="whitespace-normal text-xs text-muted-foreground">{member.shipping_address}</p><DestinationEditor order={member} />
              </div>)}</div>
            </details> : <><p className="whitespace-normal text-sm">{row.original.shipping_address}</p><DestinationEditor order={row.original} /></>}
          </div>
        ),
      },
      {
        accessorKey: "customer_company",
        header: () => "Payment Arrangement",
        cell: ({ row }) => (
          <span className="text-sm">{[...new Set(row.original.members.map(member => member.payment_arrangement))].join(" / ")}</span>
        ),
      },
      {
        id: "readiness", header: "Status",
        cell: ({ row }) => <div className="space-y-1"><Badge variant={row.original.ready_count === row.original.total_members ? "default" : "outline"}>{row.original.ready_count === row.original.total_members ? "Scheduling" : "Waiting for orders"}</Badge><p className="text-xs text-muted-foreground">{row.original.ready_count} / {row.original.total_members} ready</p></div>,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="space-y-2"><div className="flex gap-2">
            {row.original.order_group_id && <Button variant="outline" size="sm" disabled={groupPending || !row.original.can_schedule}
              aria-label={`Schedule group ${row.original.order_group_number}`}
              onClick={async () => {
                startSchedule(row.original.warehouse_id);
                if (await addReadyGroup(row.original.order_group_id!)) {
                  setStep(0);
                  openModal(DialogMode.INSERT, { title: "Schedule Delivery", description: "Schedule every order in this group together. Each order keeps its own destination.", action: "Schedule Delivery" });
                }
              }}>Schedule group</Button>}
            {/* Schedule the selected order */}
            {!row.original.order_group_id && <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Schedule order ${row.original.order_number}`}
                    disabled={row.original.shipping_latitude == null || row.original.shipping_longitude == null || (Number(row.original.shipping_latitude) === 0 && Number(row.original.shipping_longitude) === 0)}
                    onClick={() => {
                      startSchedule(row.original.warehouse_id, [row.original.id]);
                      openModal(DialogMode.INSERT, { title: "Schedule Delivery", description: `Schedule ${row.original.order_number} for delivery.`, action: "Schedule Delivery" });
                    }}
                  >
                    <Calendar className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <p>Schedule this order. Confirm its location first if unavailable.</p>
              </TooltipContent>
            </Tooltip>}
          </div><p className={`max-w-64 whitespace-normal text-xs ${row.original.can_schedule ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>{row.original.blocked_reason || (row.original.order_group_id ? "All orders are ready to schedule together." : "Ready to schedule.")}</p></div>
        ),
      },
    ],
    [openModal, form, setStep, warehouseCB, warehouseQuery.data, startSchedule, addReadyGroup, groupPending],
  );

  const table = useReactTable({
    data: deliveryScheduleQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil(
      (deliveryScheduleQuery.data?.total ?? 0) / page.pageSize,
    ),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribe(REQUESTS.DELIVERY_SCHEDULE_CREATED, () => {
      void queryClient.invalidateQueries({ queryKey: ["deliveryScheduleQuery"] });
      void queryClient.invalidateQueries({ queryKey: ["order", "scheduling"] });
    });
  }, [page.pageIndex, page.pageSize, queryClient, search, subscribe]);

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Ready for scheduling" description="Check order readiness and destinations before assigning a delivery run." total={deliveryScheduleQuery.data?.total} isFetching={deliveryScheduleQuery.isFetching} onRefresh={() => void deliveryScheduleQuery.refetch()} actions={<Button size="sm" disabled={groupPending} onClick={() => { startSchedule(); openModal(DialogMode.INSERT, { title: "Schedule Delivery", description: "Create a delivery schedule for selected orders.", action: "Schedule Delivery" }); }}><Plus className="size-4" aria-hidden="true" />Schedule delivery</Button>} />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="delivery-schedules-search" value={searchInput} placeholder="Search orders…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
        {(search || searchInput) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
      </div>
      <QueryFeedback query={deliveryScheduleQuery} label="delivery schedules" />
      <ManagementTableView table={table} loading={deliveryScheduleQuery.isPending} isFetching={deliveryScheduleQuery.isFetching} error={deliveryScheduleQuery.isError} filtered={Boolean(search)} label="orders ready for scheduling" />
      <ManagementListFooter table={table} total={deliveryScheduleQuery.data?.total ?? 0} isFetching={deliveryScheduleQuery.isFetching} label="delivery-schedules" />
    </section>
  );
}
