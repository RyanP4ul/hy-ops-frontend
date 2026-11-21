import { Crosshair, Eye, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { TableActions } from "@/components/table-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatAgo } from "../lib/format";
import { getWarehouse } from "../lib/geometry";
import {
  getOperationalStatusKey,
  isAvailableVehicle,
} from "../lib/vehicle";
import type {
  FleetCounts,
  ResolvedPosition,
  StopEnrichment,
  Vehicle,
  VehicleFilter,
  VehicleSortKey,
  WarehouseLocation,
} from "../types";
import { getAssignmentLine, type DirectoryTab } from "./directory-rail";
import {
  LalamoveCouriersList,
  type LiveLalamoveCourier,
} from "./lalamove-couriers";
import { ReturnPickupsList, type ReturnPickup } from "./return-pickups";
import { GpsLabel, StatusLabel } from "./status-pill";

const FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivering", label: "On route" },
  { value: "returning", label: "Returning" },
  { value: "available", label: "Available" },
  { value: "blocked", label: "Blocked" },
  { value: "gps_attention", label: "GPS" },
];

type FleetTableProps = {
  tab: DirectoryTab;
  onTabChange: (tab: DirectoryTab) => void;
  vehicles: Vehicle[];
  visibleVehicles: Vehicle[];
  warehouses: WarehouseLocation[];
  returnPickups: ReturnPickup[];
  returnsLoading: boolean;
  returnsError: boolean;
  onRetryReturns: () => void;
  lalamoveCouriers?: LiveLalamoveCourier[];
  lalamoveLoading?: boolean;
  lalamoveError?: boolean;
  selectedLalamoveId?: number | null;
  now?: number;
  onRetryLalamove?: () => void;
  onSelectLalamove?: (courier: LiveLalamoveCourier) => void;
  simulationOn: boolean;
  positions: Map<string, ResolvedPosition>;
  counts: FleetCounts;
  stopEnrichment: Map<string, StopEnrichment>;
  selectedId: string | null;
  focusedWarehouseId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  filter: VehicleFilter;
  onFilterChange: (filter: VehicleFilter) => void;
  sortKey: VehicleSortKey;
  onSortChange: (sortKey: VehicleSortKey) => void;
  onClearFilters: () => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onFocusWarehouse: (warehouse: WarehouseLocation) => void;
  onFocusReturn: (point: [number, number]) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
};

export function FleetTable({
  tab,
  onTabChange,
  vehicles,
  visibleVehicles,
  warehouses,
  returnPickups,
  returnsLoading,
  returnsError,
  onRetryReturns,
  lalamoveCouriers = [],
  lalamoveLoading = false,
  lalamoveError = false,
  selectedLalamoveId = null,
  now = 0,
  onRetryLalamove,
  onSelectLalamove,
  simulationOn,
  positions,
  counts,
  stopEnrichment,
  selectedId,
  focusedWarehouseId,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sortKey,
  onSortChange,
  onClearFilters,
  onSelectVehicle,
  onFocusWarehouse,
  onFocusReturn,
  searchInputRef,
}: FleetTableProps) {
  const filterCounts: Record<VehicleFilter, number> = {
    all: counts.total,
    delivering: counts.delivering,
    returning: counts.returning,
    available: counts.available,
    blocked: counts.blocked,
    gps_attention: counts.gpsAttention,
  };

  const hasActiveFilters = query.trim().length > 0 || filter !== "all";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2">
        <div
          role="tablist"
          aria-label="Table sections"
          className="flex items-center gap-1"
        >
          {(
            [
              { id: "vehicles", label: "Vehicles", count: vehicles.length },
              { id: "warehouses", label: "Bases", count: warehouses.length },
              { id: "returns", label: "Returns", count: returnPickups.length },
              { id: "lalamove", label: "Lalamove", count: lalamoveCouriers.length },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
                <span className="tabular-nums text-[11px] opacity-75">
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {tab === "vehicles" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56 max-w-full">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search plate, driver, order…"
                aria-label="Search vehicles"
                className="h-7 pl-8 pr-7 text-xs"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <select
              aria-label="Sort vehicles"
              value={sortKey}
              onChange={(event) =>
                onSortChange(event.target.value as VehicleSortKey)
              }
              className="h-7 rounded-md border bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="priority">Priority</option>
              <option value="plate">Plate</option>
              <option value="gps">GPS</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        ) : null}
      </div>

      {tab === "vehicles" ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b px-3.5 py-1.5">
            {FILTERS.map(({ value, label }) => {
              const active = filter === value;
              const count = filterCounts[value];
              if (value !== "all" && count === 0 && !active) return null;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFilterChange(value)}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span>{label}</span>
                  <span className="tabular-nums opacity-75">{count}</span>
                </button>
              );
            })}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="ml-auto text-[11px] font-medium text-primary hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>

          {visibleVehicles.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm font-medium">
                {vehicles.length === 0
                  ? "No vehicles in fleet"
                  : "No vehicles match your filters"}
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onClearFilters}
                >
                  Reset filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="fleet-vehicles-caption"
              className="fm-table-region min-h-0 flex-1"
            >
              <table className="fm-table text-left text-xs">
                <caption id="fleet-vehicles-caption" className="sr-only">
                  Fleet vehicles status table
                </caption>
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground backdrop-blur-sm">
                    <th className="border-b px-3.5 py-2.5 font-medium">
                      Vehicle
                    </th>
                    <th className="border-b px-3 py-2.5 font-medium">Driver</th>
                    <th className="border-b px-3 py-2.5 font-medium">Status</th>
                    <th className="border-b px-3 py-2.5 font-medium">GPS</th>
                    <th className="border-b px-3 py-2.5 font-medium">
                      Assignment
                    </th>
                    <th className="border-b px-3 py-2.5 font-medium">Stops</th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">
                      Updated
                    </th>
                    <th className="w-px border-b px-3.5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVehicles.map((vehicle) => {
                    const warehouse = getWarehouse(vehicle, warehouses);
                    const position = positions.get(vehicle.id);
                    const selected = vehicle.id === selectedId;
                    const total = vehicle.stops.length;
                    const failedCount = vehicle.stops.filter(
                      (s) =>
                        stopEnrichment.get(s.id)?.actualStatus === "failed",
                    ).length;

                    return (
                      <tr
                        key={vehicle.id}
                        data-selected={selected}
                        onClick={(event) => {
                          if (event.target instanceof Element && !event.target.closest("button")) onSelectVehicle(vehicle);
                        }}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-accent/40",
                          selected && "bg-primary/6",
                        )}
                      >
                        <th
                          scope="row"
                          className="border-b border-border/60 px-3.5 py-2.5 text-left font-normal"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: vehicle.color }}
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {vehicle.plate}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {warehouse.name}
                              </p>
                            </div>
                          </div>
                        </th>
                        <td className="border-b border-border/60 px-3 py-2.5 text-foreground/90">
                          {vehicle.driver}
                        </td>
                        <td className="border-b border-border/60 px-3 py-2.5">
                          <StatusLabel
                            status={getOperationalStatusKey(vehicle)}
                          />
                        </td>
                        <td className="border-b border-border/60 px-3 py-2.5">
                          {position ? (
                            <GpsLabel position={position} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="max-w-[260px] border-b border-border/60 px-3 py-2.5">
                          <p className="truncate text-foreground">
                            {getAssignmentLine(vehicle, warehouse)}
                          </p>
                          {vehicle.trip ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {vehicle.trip.label}
                            </p>
                          ) : null}
                        </td>
                        <td className="border-b border-border/60 px-3 py-2.5 tabular-nums">
                          {total > 0 ? (
                            <span>
                              {vehicle.completedStops}/{total}
                              {failedCount > 0 ? (
                                <span className="ml-1 font-medium text-destructive">
                                  ({failedCount} failed)
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="border-b border-border/60 px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {position?.ageMs != null
                            ? formatAgo(position.ageMs)
                            : position?.health === "simulated"
                              ? "Sim"
                              : "—"}
                        </td>
                        <td className="border-b border-border/60 px-3.5 py-2.5">
                          <TableActions
                            rowLabel={vehicle.plate}
                            primary={{
                              label: "View vehicle",
                              ariaLabel: `View vehicle ${vehicle.plate}`,
                              icon: Eye,
                              onClick: () => onSelectVehicle(vehicle),
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === "warehouses" ? (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="fleet-warehouses-caption"
          className="fm-table-region min-h-0 flex-1"
        >
          {warehouses.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              No warehouses configured.
            </p>
          ) : (
            <table className="fm-table fm-table--warehouses text-left text-xs">
              <caption id="fleet-warehouses-caption" className="sr-only">
                Warehouses table
              </caption>
              <thead>
                <tr className="bg-muted/60 text-muted-foreground">
                  <th className="border-b px-3.5 py-2.5 font-medium">Base</th>
                  <th className="border-b px-3 py-2.5 font-medium">Address</th>
                  <th className="border-b px-3 py-2.5 font-medium">Units</th>
                  <th className="border-b px-3 py-2.5 font-medium">Active</th>
                  <th className="border-b px-3 py-2.5 font-medium">Ready</th>
                  <th className="border-b px-3.5 py-2.5 text-right font-medium">
                    Map
                  </th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((warehouse) => {
                  const homed = vehicles.filter(
                    (v) => v.warehouseId === warehouse.id,
                  );
                  const activeCount = homed.filter(
                    (v) => v.status !== "available",
                  ).length;
                  const readyCount = homed.filter(isAvailableVehicle).length;
                  const focused = focusedWarehouseId === warehouse.id;

                  return (
                    <tr
                      key={warehouse.id}
                      data-selected={focused}
                      className="transition-colors hover:bg-accent/40"
                    >
                      <th
                        scope="row"
                        className="border-b border-border/60 px-3.5 py-2.5 text-left font-semibold text-foreground"
                      >
                        {warehouse.name}
                      </th>
                      <td className="max-w-sm border-b border-border/60 px-3 py-2.5 text-muted-foreground">
                        <span className="line-clamp-1">{warehouse.address}</span>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2.5 tabular-nums">
                        {homed.length}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2.5 tabular-nums">
                        {activeCount}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2.5 tabular-nums">
                        {readyCount}
                      </td>
                      <td className="border-b border-border/60 px-3.5 py-2.5 text-right">
                        <TableActions
                          rowLabel={warehouse.name}
                          primary={{
                            label: "Show on map",
                            ariaLabel: `Show on map: ${warehouse.name}`,
                            icon: Crosshair,
                            onClick: () => onFocusWarehouse(warehouse),
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === "lalamove" ? (
        <div className="fm-scroller min-h-0 flex-1">
          {simulationOn ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Exit simulation to track live Lalamove couriers.
            </p>
          ) : lalamoveError ? (
            <div role="alert" className="space-y-2 p-8 text-center text-xs">
              <p className="text-muted-foreground">
                Couldn&apos;t load Lalamove couriers.
              </p>
              {onRetryLalamove && (
                <Button size="sm" variant="outline" onClick={onRetryLalamove}>
                  Retry
                </Button>
              )}
            </div>
          ) : lalamoveLoading ? (
            <p
              role="status"
              className="p-8 text-center text-xs text-muted-foreground"
            >
              Loading…
            </p>
          ) : (
            <div className="mx-auto max-w-2xl border-x">
              <LalamoveCouriersList
                couriers={lalamoveCouriers}
                selectedId={selectedLalamoveId}
                now={now}
                onSelect={(courier) => onSelectLalamove?.(courier)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="fm-scroller min-h-0 flex-1">
          {simulationOn ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Exit simulation to manage return pickups.
            </p>
          ) : returnsError ? (
            <div role="alert" className="space-y-2 p-8 text-center text-xs">
              <p className="text-muted-foreground">
                Couldn&apos;t load return pickups.
              </p>
              <Button size="sm" variant="outline" onClick={onRetryReturns}>
                Retry
              </Button>
            </div>
          ) : returnsLoading ? (
            <p
              role="status"
              className="p-8 text-center text-xs text-muted-foreground"
            >
              Loading…
            </p>
          ) : (
            <div className="mx-auto max-w-2xl border-x">
              <ReturnPickupsList
                tasks={returnPickups}
                onFocus={onFocusReturn}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
