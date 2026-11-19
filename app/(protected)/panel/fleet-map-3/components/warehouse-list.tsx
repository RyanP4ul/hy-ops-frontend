import { MapPin, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralize } from "../lib/format";
import { isAvailableVehicle, isBlockedVehicle } from "../lib/vehicle";
import type { Vehicle, WarehouseLocation } from "../types";
import { EmptyState } from "./empty-state";

/** Read-only: warehouses can be located on the map but not edited here. */
export function WarehouseList({
  warehouses,
  vehicles,
  focusedId,
  layout = "sidebar",
  onFocus,
}: {
  warehouses: WarehouseLocation[];
  vehicles: Vehicle[];
  focusedId: string | null;
  layout?: "sidebar" | "table";
  onFocus: (warehouse: WarehouseLocation) => void;
}) {
  if (warehouses.length === 0) {
    return (
      <div className="p-3">
        <EmptyState icon={Warehouse} title="No warehouses">
          Active warehouses with verified coordinates will appear here.
        </EmptyState>
      </div>
    );
  }

  if (layout === "table") {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Warehouse</th>
                <th className="px-3 py-2.5 font-medium">Address</th>
                <th className="px-3 py-2.5 font-medium">Based Fleet</th>
                <th className="px-3 py-2.5 font-medium">On Route</th>
                <th className="px-3 py-2.5 font-medium">Available</th>
                <th className="px-3 py-2.5 font-medium">Out of Service</th>
                <th className="px-3 py-2.5 text-right font-medium">Map</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {warehouses.map((warehouse) => {
                const homed = vehicles.filter(
                  (v) => v.warehouseId === warehouse.id,
                );
                const activeCount = homed.filter(
                  (v) => v.status !== "available",
                ).length;
                const availableCount = homed.filter(isAvailableVehicle).length;
                const blockedCount = homed.filter(isBlockedVehicle).length;
                const focused = focusedId === warehouse.id;

                return (
                  <tr
                    key={warehouse.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      focused && "bg-primary/5",
                    )}
                  >
                    <td className="px-3 py-2.5 font-semibold text-foreground">
                      {warehouse.name}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-muted-foreground">
                      <span className="line-clamp-2">{warehouse.address}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {homed.length}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-blue-700 dark:text-blue-300">
                      {activeCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-emerald-700 dark:text-emerald-300">
                      {availableCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-amber-700 dark:text-amber-300">
                      {blockedCount}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onFocus(warehouse)}
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                      >
                        <MapPin className="size-3" aria-hidden="true" />
                        Focus map
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2 p-3">
      {warehouses.map((warehouse) => {
        const homed = vehicles.filter((v) => v.warehouseId === warehouse.id);
        const idle = homed.filter(isAvailableVehicle).length;
        const active = homed.filter((v) => v.status !== "available").length;

        return (
          <li key={warehouse.id}>
            <button
              type="button"
              onClick={() => onFocus(warehouse)}
              aria-pressed={focusedId === warehouse.id}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                focusedId === warehouse.id &&
                  "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-slate-800">
                  <Warehouse className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {warehouse.name}
                  </p>
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-2">{warehouse.address}</span>
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {pluralize(homed.length, "vehicle")}
                    </span>{" "}
                    · {idle} available · {active} active
                  </p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
