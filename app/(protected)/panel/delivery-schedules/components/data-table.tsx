"use client";

import { QueryFeedback } from "@/components/query-feedback";
import { DestinationEditor } from "./destination-editor";


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
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { SchedulingEntry } from "@/schema/delivery-schedule";
import { useDeliverySchedule } from "../provider";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PaginationScheduleDelivery from "./pagination";
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
    availableDateQuery,
    deliveryScheduleQuery,
    page,
    setPage,
    search,
    setSearch,
  } = useDeliverySchedule();
  const { openModal } = useModal();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce(setSearch, 500), [setSearch]);

  const columns = useMemo<ColumnDef<SchedulingEntry>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: () => "Order / Group",
        cell: ({ row }) => (
          <div className="min-w-36 space-y-1 text-blue-500 cursor-pointer">
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
                    size="icon"
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
        </div>

        <Button
          type="button"
          variant="default"
          size="lg"
          className="cursor-pointer"
          disabled={groupPending}
          onClick={() => {
            startSchedule();
            openModal(DialogMode.INSERT, {
              title: "Schedule Delivery",
              description: "Create a delivery schedule for selected orders.",
              action: "Schedule Delivery",
            });
          }}
        >
          <Plus className="h-3 w-3" />
          <span>Schedule Delivery</span>
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <QueryFeedback query={deliveryScheduleQuery} label="delivery schedules" />
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
            {deliveryScheduleQuery.isPending ? (
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
                          {typeof cell.column.columnDef.cell === "function"
                            ? cell.column.columnDef.cell(cell.getContext())
                            : flexRender(cell.column.columnDef.cell, cell.getContext())}
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
          <PaginationScheduleDelivery table={table} />
        </div>
      </div>
    </>
  );
}
