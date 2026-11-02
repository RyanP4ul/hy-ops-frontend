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
import { DeliveryScheduleRow } from "@/schema/delivery-schedule";
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
    form, setStep, warehouseCB, warehouseQuery,
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

  const columns = useMemo<ColumnDef<DeliveryScheduleRow>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: () => "Order Number",
        cell: ({ row }) => (
          <div className="min-w-36 space-y-1 text-blue-500 cursor-pointer">
            <p className="font-medium ">{row.original.order_number}</p>
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
          <div className="min-w-36 space-y-1">
            <p className="font-medium">{row.original.shipping_address}</p>
            <DestinationEditor order={row.original} />
          </div>
        ),
      },
      {
        accessorKey: "customer_company",
        header: () => "Payment Arrangement",
        cell: ({ row }) => (
          <Badge variant="default">{row.original.payment_arrangement}</Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {/* Schedule the selected order */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Schedule order ${row.original.order_number}`}
                    disabled={row.original.shipping_latitude == null || row.original.shipping_longitude == null || (Number(row.original.shipping_latitude) === 0 && Number(row.original.shipping_longitude) === 0)}
                    onClick={() => {
                      form.reset();
                      form.setValue("warehouse_id", row.original.warehouse_id);
                      form.setValue("order_ids", [row.original.id]);
                      warehouseCB.setInputValue(warehouseQuery.data?.rows.find(w => w.id === row.original.warehouse_id)?.name ?? "");
                      setStep(1);
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
            </Tooltip>
          </div>
        ),
      },
    ],
    [openModal, form, setStep, warehouseCB, warehouseQuery.data],
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
    const queryKey = [
      "deliveryScheduleQuery",
      page.pageIndex,
      page.pageSize,
      search,
    ];

    return subscribe(REQUESTS.DELIVERY_SCHEDULE_CREATED, (message) => {
      const orderIds = new Set<number>(message.payload.order_ids);

      queryClient.setQueryData(
        queryKey,
        (
          oldData: { rows: DeliveryScheduleRow[]; total: number } | undefined,
        ) => {
          if (!oldData) {
            return { rows: [], total: 0 };
          }

          const rows = oldData.rows.filter((row) => !orderIds.has(row.id));

          return {
            rows,
            total: Math.max(
              oldData.total - (oldData.rows.length - rows.length),
              0,
            ),
          };
        },
      );
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
          onClick={() => {
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
                          {cell.column.columnDef.cell
                            ? (cell.column.columnDef.cell as any)(
                                cell.getContext(),
                              )
                            : cell.getValue()}
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
