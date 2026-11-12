import { MapPin, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralize } from "../lib/format";
import { isAvailableVehicle } from "../lib/vehicle";
import type { Vehicle, WarehouseLocation } from "../types";
import { EmptyState } from "./empty-state";

/** Read-only: warehouses can be located on the map but not edited here. */
export function WarehouseList({
  warehouses,
  vehicles,
  focusedId,
  onFocus,
}: {
  warehouses: WarehouseLocation[];
  vehicles: Vehicle[];
  focusedId: string | null;
  onFocus: (warehouse: WarehouseLocation) => void;
}) {
  if (warehouses.length === 0) {
    return (
      <div className="p-3">
        <EmptyState icon={Warehouse} title="No warehouses">
          Warehouses with a map location will appear here.
        </EmptyState>
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      {warehouses.map((warehouse) => {
        const homed = vehicles.filter((v) => v.warehouseId === warehouse.id);
        const idle = homed.filter(isAvailableVehicle).length;

        return (
          <li key={warehouse.id}>
            <button
              type="button"
              onClick={() => onFocus(warehouse)}
              aria-pressed={focusedId === warehouse.id}
              className={cn(
                "w-full rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:bg-accent/50",
                focusedId === warehouse.id &&
                  "border-primary bg-accent ring-1 ring-primary",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Warehouse className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {warehouse.name}
                  </p>
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 size-3 shrink-0" />
                    <span className="line-clamp-2">{warehouse.address}</span>
                  </p>
                  <p className="mt-2 text-xs">
                    {pluralize(homed.length, "vehicle")} based here
                    <span className="text-muted-foreground">
                      {" "}
                      · {idle} available
                    </span>
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
