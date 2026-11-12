import { Search, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getWarehouse } from "../lib/geometry";
import { formatSchedule, pluralize } from "../lib/format";
import {
  compareVehicles,
  getNextPendingStop,
  matchesFilter,
  matchesSearch,
  type VehicleFilter,
} from "../lib/vehicle";
import type { ResolvedPosition, Vehicle, WarehouseLocation } from "../types";
import { EmptyState } from "./empty-state";
import { SignalBadge } from "./signal-badge";
import { StatusBadge } from "./status-badge";

const FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivering", label: "On route" },
  { value: "returning", label: "Returning" },
  { value: "available", label: "Available" },
];

type VehicleListProps = {
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
  positions: Map<string, ResolvedPosition>;
  selectedId: string | null;
  onSelect: (vehicle: Vehicle) => void;
};

export function VehicleList({
  vehicles,
  warehouses,
  positions,
  selectedId,
  onSelect,
}: VehicleListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VehicleFilter>("all");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(({ value }) => [
          value,
          vehicles.filter((v) => matchesFilter(v, value)).length,
        ]),
      ) as Record<VehicleFilter, number>,
    [vehicles],
  );

  const visible = useMemo(
    () =>
      vehicles
        .filter((v) => matchesFilter(v, filter) && matchesSearch(v, query))
        .sort(compareVehicles),
    [vehicles, filter, query],
  );

  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search plate, driver, customer, order…"
            aria-label="Search vehicles"
            className="h-9 pl-8 text-sm"
          />
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter by status"
        >
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {label} <span className="opacity-70">{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 items-start gap-2 overflow-y-auto px-3 pb-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {visible.length === 0 ? (
          <li className="col-span-full">
            <EmptyState icon={Truck} title="No vehicles found">
              {vehicles.length === 0
                ? "There are no vehicles in the system yet."
                : "Try a different search or filter."}
            </EmptyState>
          </li>
        ) : (
          visible.map((vehicle) => {
            const position = positions.get(vehicle.id);
            return (
              <li key={vehicle.id}>
                <VehicleCard
                  vehicle={vehicle}
                  warehouse={getWarehouse(vehicle, warehouses)}
                  position={position}
                  selected={vehicle.id === selectedId}
                  onSelect={() => onSelect(vehicle)}
                />
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function VehicleCard({
  vehicle,
  warehouse,
  position,
  selected,
  onSelect,
}: {
  vehicle: Vehicle;
  warehouse: WarehouseLocation;
  position: ResolvedPosition | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const nextStop = getNextPendingStop(vehicle);
  const nextTrip = vehicle.scheduledTrips[0];
  const total = vehicle.stops.length;
  const isActive = vehicle.status !== "available";
  const percent = total === 0 ? 0 : (vehicle.completedStops / total) * 100;

  let summary: string;
  const pickup = vehicle.pickups?.find(task => task.status === "assigned");
  if (vehicle.status === "delivering" && pickup) {
    summary = `Pickup: ${pickup.customer} / ${pickup.orderNumber}`;
  } else if (vehicle.status === "delivering" && nextStop) {
    summary = `Heading to ${nextStop.name}`;
  } else if (vehicle.status === "returning") {
    summary = `Returning to ${warehouse.name}`;
  } else if (vehicle.blockedReason) {
    summary = `At ${warehouse.name}`;
  } else if (nextTrip) {
    summary = `${nextTrip.phase === "overdue" ? "Overdue" : "Next"}: ${nextTrip.label} · ${formatSchedule(nextTrip.scheduledAt)}`;
  } else {
    summary = `Idle at ${warehouse.name}`;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:bg-accent/50",
        selected && "border-primary bg-accent ring-1 ring-primary",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: vehicle.color }}
        >
          <Truck className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{vehicle.plate}</p>
            <StatusBadge status={vehicle.blockedReason ?? vehicle.status} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {vehicle.driver}
          </p>
        </div>
      </div>

      <p className="mt-2 truncate text-xs">{summary}</p>

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
              className="h-full rounded-full transition-[width]"
              style={{ width: `${percent}%`, backgroundColor: vehicle.color }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {pluralize(vehicle.completedStops, "stop")} of {total}
          </span>
        </div>
      ) : null}

      {isActive && position ? (
        <SignalBadge position={position} className="mt-2" />
      ) : null}
    </button>
  );
}
