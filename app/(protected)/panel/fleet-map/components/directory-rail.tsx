import { PanelLeftClose, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatSchedule, pluralize } from "../lib/format";
import { getWarehouse } from "../lib/geometry";
import {
  getNextPendingStop,
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
import { ReturnPickupsList, type ReturnPickup } from "./return-pickups";
import { GpsLabel, StatusLabel } from "./status-pill";

export type DirectoryTab = "vehicles" | "warehouses" | "returns";

const FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivering", label: "On route" },
  { value: "returning", label: "Returning" },
  { value: "available", label: "Available" },
  { value: "blocked", label: "Blocked" },
  { value: "gps_attention", label: "GPS" },
];

export function getAssignmentLine(
  vehicle: Vehicle,
  warehouse: WarehouseLocation,
): string {
  const nextStop = getNextPendingStop(vehicle);
  const nextTrip = vehicle.scheduledTrips[0];
  const pickup = vehicle.pickups?.find((task) => task.status === "assigned");

  if (vehicle.status === "delivering" && pickup) {
    return `Pickup · ${pickup.customer}`;
  }
  if (vehicle.status === "delivering" && nextStop) {
    return `Next · ${nextStop.name}`;
  }
  if (vehicle.status === "delivering") {
    return "Pending stops skipped";
  }
  if (vehicle.status === "returning") {
    return `Returning · ${warehouse.name}`;
  }
  if (vehicle.blockedReason) {
    return warehouse.name;
  }
  if (nextTrip) {
    return `${nextTrip.phase === "overdue" ? "Overdue" : "Next"} · ${formatSchedule(nextTrip.scheduledAt)}`;
  }
  return warehouse.name;
}

type DirectoryRailProps = {
  tab: DirectoryTab;
  onTabChange: (tab: DirectoryTab) => void;
  vehicles: Vehicle[];
  visibleVehicles: Vehicle[];
  warehouses: WarehouseLocation[];
  returnPickups: ReturnPickup[];
  returnsLoading: boolean;
  returnsError: boolean;
  onRetryReturns: () => void;
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
  onCollapse?: () => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
};

export function DirectoryRail({
  tab,
  onTabChange,
  vehicles,
  visibleVehicles,
  warehouses,
  returnPickups,
  returnsLoading,
  returnsError,
  onRetryReturns,
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
  onCollapse,
  searchInputRef,
}: DirectoryRailProps) {
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
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      {/* Tabs + Collapse button */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-2.5">
        <div
          role="tablist"
          aria-label="Fleet sections"
          className="flex h-full items-center gap-0.5"
        >
          {(
            [
              { id: "vehicles", label: "Vehicles", count: vehicles.length },
              {
                id: "warehouses",
                label: "Bases",
                count: warehouses.length,
              },
              {
                id: "returns",
                label: "Returns",
                count: returnPickups.length,
              },
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
                  "relative flex h-full items-center gap-1 px-2 text-xs font-medium transition-colors",
                  active
                    ? "text-foreground after:absolute after:inset-x-1.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide fleet panel"
            title="Hide panel"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {tab === "vehicles" ? (
        <>
          {/* Search + Sort + Single Filter Strip */}
          <div className="shrink-0 space-y-2 border-b p-2.5">
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Plate, driver, order…"
                  aria-label="Search vehicles"
                  className="h-8 pl-8 pr-7 text-xs"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => onQueryChange("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <select
                aria-label="Sort vehicles"
                value={sortKey}
                onChange={(event) =>
                  onSortChange(event.target.value as VehicleSortKey)
                }
                className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="priority">Priority</option>
                <option value="plate">Plate</option>
                <option value="gps">GPS</option>
                <option value="progress">Progress</option>
              </select>
            </div>

            <div
              role="group"
              aria-label="Filter vehicles"
              className="flex flex-wrap items-center gap-1"
            >
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
                      "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-foreground text-background"
                        : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground",
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
                  className="ml-auto px-1 text-[11px] font-medium text-primary hover:underline"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>

          {/* Hairline-divided vehicle list */}
          <div className="fm-scroller min-h-0 flex-1">
            {visibleVehicles.length === 0 ? (
              <div className="space-y-2 px-4 py-10 text-center">
                <p className="text-xs font-medium text-foreground">
                  {vehicles.length === 0 ? "No vehicles" : "No matches"}
                </p>
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={onClearFilters}
                  >
                    Reset filters
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {visibleVehicles.map((vehicle) => {
                  const warehouse = getWarehouse(vehicle, warehouses);
                  const position = positions.get(vehicle.id);
                  const selected = vehicle.id === selectedId;
                  const total = vehicle.stops.length;
                  const isActive = vehicle.status !== "available";
                  const percent =
                    total === 0 ? 0 : (vehicle.completedStops / total) * 100;
                  const failedCount = vehicle.stops.filter(
                    (s) =>
                      stopEnrichment.get(s.id)?.actualStatus === "failed",
                  ).length;

                  return (
                    <li key={vehicle.id}>
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(vehicle)}
                        aria-pressed={selected}
                        className={cn(
                          "w-full px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          selected && "bg-primary/8",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: vehicle.color }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                              {vehicle.plate}
                            </span>
                          </div>
                          <StatusLabel
                            status={getOperationalStatusKey(vehicle)}
                          />
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2 pl-4 text-xs text-muted-foreground">
                          <span className="truncate">{vehicle.driver}</span>
                          {position ? <GpsLabel position={position} /> : null}
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2 pl-4">
                          <p className="truncate text-xs text-foreground/85">
                            {getAssignmentLine(vehicle, warehouse)}
                          </p>
                          {isActive && total > 0 ? (
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {vehicle.completedStops}/{total}
                              {failedCount > 0 ? (
                                <span className="ml-1 font-medium text-destructive">
                                  ({failedCount}!)
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </div>

                        {isActive && total > 0 ? (
                          <div className="mt-1.5 pl-4">
                            <div className="h-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-[width]"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : tab === "warehouses" ? (
        <div className="fm-scroller min-h-0 flex-1">
          {warehouses.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              No warehouses configured.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {warehouses.map((warehouse) => {
                const homed = vehicles.filter(
                  (v) => v.warehouseId === warehouse.id,
                );
                const ready = homed.filter(isAvailableVehicle).length;
                const active = homed.filter(
                  (v) => v.status !== "available",
                ).length;
                const focused = focusedWarehouseId === warehouse.id;

                return (
                  <li key={warehouse.id}>
                    <button
                      type="button"
                      onClick={() => onFocusWarehouse(warehouse)}
                      aria-pressed={focused}
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        focused && "bg-primary/8",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {warehouse.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {pluralize(homed.length, "unit")}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {warehouse.address}
                      </p>
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {active} active · {ready} ready
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="fm-scroller min-h-0 flex-1">
          {simulationOn ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              Exit simulation to manage return pickups.
            </p>
          ) : returnsError ? (
            <div role="alert" className="space-y-2 p-4 text-center text-xs">
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
              className="px-4 py-10 text-center text-xs text-muted-foreground"
            >
              Loading…
            </p>
          ) : (
            <ReturnPickupsList tasks={returnPickups} onFocus={onFocusReturn} />
          )}
        </div>
      )}
    </div>
  );
}
