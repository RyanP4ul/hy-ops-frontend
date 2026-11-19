import { ArrowUpDown, ChevronRight, Search, Truck, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatAgo, formatSchedule, pluralize } from "../lib/format";
import { getWarehouse } from "../lib/geometry";
import {
  compareVehicles,
  getNextPendingStop,
  getOperationalStatusKey,
  matchesFilter,
  matchesSearch,
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
import { EmptyState } from "./empty-state";
import { SignalBadge } from "./signal-badge";
import { StatusBadge } from "./status-badge";

const FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivering", label: "On route" },
  { value: "returning", label: "Returning" },
  { value: "available", label: "Available" },
  { value: "blocked", label: "Out of service" },
  { value: "gps_attention", label: "GPS attention" },
];

type VehicleListProps = {
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
  positions: Map<string, ResolvedPosition>;
  counts: FleetCounts;
  stopEnrichment: Map<string, StopEnrichment>;
  selectedId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  filter: VehicleFilter;
  onFilterChange: (filter: VehicleFilter) => void;
  sortKey: VehicleSortKey;
  onSortChange: (sortKey: VehicleSortKey) => void;
  onClearFilters: () => void;
  layout?: "sidebar" | "table";
  onSelect: (vehicle: Vehicle) => void;
};

function getVehicleAssignmentText(
  vehicle: Vehicle,
  warehouse: WarehouseLocation,
): string {
  const nextStop = getNextPendingStop(vehicle);
  const nextTrip = vehicle.scheduledTrips[0];
  const pickup = vehicle.pickups?.find((task) => task.status === "assigned");

  if (vehicle.status === "delivering" && pickup) {
    return `Return pickup: ${pickup.customer} (${pickup.orderNumber})`;
  }
  if (vehicle.status === "delivering" && nextStop) {
    return `Next: ${nextStop.name}`;
  }
  if (vehicle.status === "delivering") {
    return "Pending orders skipped for now";
  }
  if (vehicle.status === "returning") {
    return `Returning to ${warehouse.name}`;
  }
  if (vehicle.blockedReason) {
    return `At ${warehouse.name} · Non-dispatchable`;
  }
  if (nextTrip) {
    return `${nextTrip.phase === "overdue" ? "Overdue" : "Next trip"}: ${nextTrip.label} · ${formatSchedule(nextTrip.scheduledAt)}`;
  }
  return `At ${warehouse.name}`;
}

export function VehicleList({
  vehicles,
  warehouses,
  positions,
  counts,
  stopEnrichment,
  selectedId,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sortKey,
  onSortChange,
  onClearFilters,
  layout = "sidebar",
  onSelect,
}: VehicleListProps) {
  const filterCounts: Record<VehicleFilter, number> = {
    all: counts.total,
    delivering: counts.delivering,
    returning: counts.returning,
    available: counts.available,
    blocked: counts.blocked,
    gps_attention: counts.gpsAttention,
  };

  const hasActiveFilters = query.trim().length > 0 || filter !== "all";

  const visible = useMemo(
    () =>
      vehicles
        .filter(
          (v) =>
            matchesFilter(v, filter, positions.get(v.id)) &&
            matchesSearch(v, query, warehouses),
        )
        .sort((a, b) => compareVehicles(a, b, sortKey, positions)),
    [vehicles, filter, positions, query, warehouses, sortKey],
  );

  const controls = (
    <div
      className={cn(
        "space-y-2.5 border-b bg-background p-3",
        layout === "table" && "sm:px-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Plate, driver, order, stop…"
            aria-label="Search vehicles"
            className="h-8 pl-8 pr-8 text-xs"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <label className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
          <ArrowUpDown
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Sort vehicles</span>
          <select
            aria-label="Sort vehicles"
            value={sortKey}
            onChange={(event) =>
              onSortChange(event.target.value as VehicleSortKey)
            }
            className="bg-transparent text-xs font-medium outline-none"
          >
            <option value="priority">Priority</option>
            <option value="plate">Plate A–Z</option>
            <option value="gps">GPS attention</option>
            <option value="progress">Trip progress</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Filter vehicles by operational or GPS status"
        >
          {FILTERS.map(({ value, label }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(value)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span>{label}</span>
                <span className="tabular-nums opacity-80">
                  {filterCounts[value]}
                </span>
              </button>
            );
          })}
        </div>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="ml-auto h-6 px-2 text-[11px] text-primary hover:text-primary"
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (visible.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {controls}
        <div className="p-3 sm:p-4">
          <EmptyState
            icon={Truck}
            title={
              vehicles.length === 0
                ? "No vehicles in fleet"
                : "No vehicles match your filters"
            }
            action={
              hasActiveFilters ? (
                <Button size="sm" variant="outline" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          >
            {vehicles.length === 0
              ? "Active fleet vehicles will appear here once configured."
              : "Adjust your search query or reset status filters to view all units."}
          </EmptyState>
        </div>
      </div>
    );
  }

  if (layout === "table") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {controls}

        {/* Desktop & tablet aligned operations table */}
        <div className="hidden min-h-0 flex-1 overflow-auto p-3 sm:p-4 md:block">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Vehicle</th>
                  <th className="px-3 py-2.5 font-medium">Driver</th>
                  <th className="px-3 py-2.5 font-medium">Operational Status</th>
                  <th className="px-3 py-2.5 font-medium">GPS Health</th>
                  <th className="px-3 py-2.5 font-medium">Assignment</th>
                  <th className="px-3 py-2.5 font-medium">Stops</th>
                  <th className="px-3 py-2.5 font-medium">Last Seen</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((vehicle) => {
                  const warehouse = getWarehouse(vehicle, warehouses);
                  const position = positions.get(vehicle.id);
                  const selected = vehicle.id === selectedId;
                  const totalStops = vehicle.stops.length;
                  const failedCount = vehicle.stops.filter(
                    (s) =>
                      stopEnrichment.get(s.id)?.actualStatus === "failed",
                  ).length;

                  return (
                    <tr
                      key={vehicle.id}
                      onClick={() => onSelect(vehicle)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-accent/50",
                        selected && "bg-primary/5",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: vehicle.color }}
                            aria-hidden="true"
                          />
                          <div>
                            <p className="font-semibold text-foreground">
                              {vehicle.plate}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {warehouse.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            vehicle.driver === "Unassigned" &&
                              "text-muted-foreground",
                          )}
                        >
                          {vehicle.driver}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={getOperationalStatusKey(vehicle)} />
                      </td>
                      <td className="px-3 py-2.5">
                        {position ? (
                          <SignalBadge position={position} compact />
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        <p className="truncate font-medium text-foreground">
                          {getVehicleAssignmentText(vehicle, warehouse)}
                        </p>
                        {vehicle.trip ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {vehicle.trip.label}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {totalStops > 0 ? (
                          <div>
                            <span className="font-medium">
                              {vehicle.completedStops}/{totalStops}
                            </span>
                            {failedCount > 0 ? (
                              <span className="ml-1.5 text-[11px] font-medium text-destructive">
                                ({failedCount} failed)
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {position?.ageMs != null
                          ? formatAgo(position.ageMs)
                          : position?.health === "simulated"
                            ? "Simulated"
                            : "Never"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className="h-7 px-2.5 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(vehicle);
                          }}
                        >
                          {selected ? "Selected" : "View details"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile dense cards for List Only */}
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 md:hidden">
          {visible.map((vehicle) => (
            <li key={vehicle.id}>
              <VehicleRow
                vehicle={vehicle}
                warehouse={getWarehouse(vehicle, warehouses)}
                position={positions.get(vehicle.id)}
                selected={vehicle.id === selectedId}
                failedCount={
                  vehicle.stops.filter(
                    (s) =>
                      stopEnrichment.get(s.id)?.actualStatus === "failed",
                  ).length
                }
                onSelect={() => onSelect(vehicle)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {controls}
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {visible.map((vehicle) => (
          <li key={vehicle.id}>
            <VehicleRow
              vehicle={vehicle}
              warehouse={getWarehouse(vehicle, warehouses)}
              position={positions.get(vehicle.id)}
              selected={vehicle.id === selectedId}
              failedCount={
                vehicle.stops.filter(
                  (s) => stopEnrichment.get(s.id)?.actualStatus === "failed",
                ).length
              }
              onSelect={() => onSelect(vehicle)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VehicleRow({
  vehicle,
  warehouse,
  position,
  selected,
  failedCount,
  onSelect,
}: {
  vehicle: Vehicle;
  warehouse: WarehouseLocation;
  position: ResolvedPosition | undefined;
  selected: boolean;
  failedCount: number;
  onSelect: () => void;
}) {
  const total = vehicle.stops.length;
  const isActive = vehicle.status !== "available";
  const percent = total === 0 ? 0 : (vehicle.completedStops / total) * 100;
  const assignmentText = getVehicleAssignmentText(vehicle, warehouse);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group w-full rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary bg-primary/5 ring-1 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: vehicle.color }}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {vehicle.plate}
          </span>
        </div>
        <StatusBadge status={getOperationalStatusKey(vehicle)} />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{vehicle.driver}</span>
        <span className="shrink-0 text-[11px]">{warehouse.name}</span>
      </div>

      <p className="mt-1.5 truncate text-xs font-medium text-foreground/90">
        {assignmentText}
      </p>

      {isActive && total > 0 ? (
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Trip progress"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {pluralize(vehicle.completedStops, "stop")} of {total}
            {failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </span>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        {position ? <SignalBadge position={position} compact /> : <span />}
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5",
            selected && "text-primary",
          )}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
