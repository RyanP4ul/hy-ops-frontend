"use client";

import { LifecycleActions } from "@/components/lifecycle-actions";

import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";


import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDownUp, Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useVehicles } from "../provider";
import { VehicleRow } from "@/schema/vehicle";
import { debounce } from "@/utils/debounce";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

type VehicleQueryData = {
  rows: VehicleRow[];
  total: number;
};

export default function DataTable() {
  const {
    vehicleQuery,
    page,
    setPage,
    search,
    setSearch,
    setSelected,
    sortBy,
    setSortBy,
  } = useVehicles();
  const { openModal } = useModal();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(search);
  const updateSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setSearch, setPage]);

  useEffect(() => () => updateSearch.cancel(), [updateSearch]);
  const sortableHeader = (id: string, label: string) => (
    <button
      type="button"
      className="flex items-center gap-2"
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
  const columns = useMemo<ColumnDef<VehicleRow>[]>(
    () => [
      { accessorKey: "id", header: () => sortableHeader("id", "ID") },
      {
        accessorKey: "plate_number",
        header: () => sortableHeader("plate_number", "Plate number"),
        cell: ({ row }) => <span className="font-medium">{row.original.plate_number}</span>,
      },
      { accessorKey: "type", header: () => sortableHeader("type", "Type") },
      {
        accessorKey: "status",
        header: () => sortableHeader("status", "Status"),
        cell: ({ row }) => <Badge variant="outline" className={row.original.status === "available" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : row.original.status === "maintenance" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" : "bg-muted text-muted-foreground"}>{row.original.status.replace(/_/g, " ")}</Badge>,
      },
      { accessorKey: "warehouse_name", header: "Assigned Warehouse" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <LifecycleActions resource="vehicles" record={row.original} archive />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit vehicle"
              onClick={() => {
                setSelected({
                  id: row.original.id,
                  version: row.original.version,
                });
                openModal(DialogMode.EDIT, {
                  title: "Edit Vehicle",
                  description: "Update this vehicle.",
                  action: "Save changes",
                });
              }}
            >
              <Edit className="size-4" />
            </Button>

          </div>
        ),
      },
    ],
    [openModal, setSelected, setSortBy],
  );
  const table = useReactTable({
    data: vehicleQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((vehicleQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  useEffect(() => {
    const queryKey = [
      "vehicles",
      page.pageIndex,
      page.pageSize,
      search,
      sortBy,
    ];

    return subscribe(
      [
        REQUESTS.VEHICLE_ADDED,
        REQUESTS.VEHICLE_UPDATED,
        REQUESTS.VEHICLE_DELETED,
      ],
      (message) => {
        const payload = message.payload as VehicleRow | { id: number };
        const vehicle = payload as VehicleRow;

        queryClient.setQueryData(
          queryKey,
          (oldData: VehicleQueryData | undefined) => {
            if (message.type === REQUESTS.VEHICLE_DELETED) {
              if (!oldData) return { rows: [], total: 0 };

              return {
                rows: oldData.rows.filter((row) => row.id !== payload.id),
                total: Math.max(
                  oldData.total -
                    (oldData.rows.some((row) => row.id === payload.id) ? 1 : 0),
                  0,
                ),
              };
            }

            if (!oldData) return { rows: [vehicle], total: 1 };

            const exists = oldData.rows.some((row) => row.id === vehicle.id);

            return {
              rows: exists
                ? oldData.rows.map((row) =>
                    row.id === vehicle.id ? vehicle : row,
                  )
                : [vehicle, ...oldData.rows].slice(0, page.pageSize),
              total: exists ? oldData.total : oldData.total + 1,
            };
          },
        );
      },
    );
  }, [page.pageIndex, page.pageSize, queryClient, search, sortBy, subscribe]);
  function clearSearch() {
    updateSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Fleet directory" description="Review vehicle availability and warehouse assignments before dispatch." total={vehicleQuery.data?.total} isFetching={vehicleQuery.isFetching} onRefresh={() => void vehicleQuery.refetch()} actions={<Button size="sm" onClick={() => openModal(DialogMode.INSERT, { title: "Add Vehicle", description: "Add a new vehicle.", action: "Add Vehicle" })}><Plus className="size-4" aria-hidden="true" />Add vehicle</Button>} />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="vehicles-search" value={searchInput} placeholder="Search vehicles…" onChange={(value) => { setSearchInput(value); updateSearch(value); }} onClear={clearSearch} />
        {(search || searchInput) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
      </div>
      <QueryFeedback query={vehicleQuery} label="vehicles" />
      <ManagementTableView table={table} loading={vehicleQuery.isPending} isFetching={vehicleQuery.isFetching} error={vehicleQuery.isError} filtered={Boolean(search)} label="vehicles" />
      <ManagementListFooter table={table} total={vehicleQuery.data?.total ?? 0} isFetching={vehicleQuery.isFetching} label="vehicles" />
    </section>
  );
}
