import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  FleetCounts,
  ResolvedPosition,
  StopEnrichment,
  Vehicle,
  VehicleFilter,
  VehicleSortKey,
  WarehouseLocation,
} from "../types";
import { ReturnPickups, type ReturnPickup } from "./return-pickups";
import { VehicleList } from "./vehicle-list";
import { WarehouseList } from "./warehouse-list";

export type SidebarTab = "vehicles" | "warehouses" | "returns";

type SidebarProps = {
  returnPickups: ReturnPickup[];
  returnsLoading: boolean;
  returnsError: boolean;
  onRetryReturns: () => void;
  onFocusReturn: (point: [number, number]) => void;
  simulationOn: boolean;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  vehicles: Vehicle[];
  warehouseFilter: string;
  onWarehouseFilterChange: (value: string) => void;
  warehouses: WarehouseLocation[];
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
  layout?: "sidebar" | "table";
  onSelectVehicle: (vehicle: Vehicle) => void;
  onFocusWarehouse: (warehouse: WarehouseLocation) => void;
};

export function Sidebar({
  returnPickups,
  returnsLoading,
  returnsError,
  onRetryReturns,
  onFocusReturn,
  simulationOn,
  tab,
  onTabChange,
  vehicles,
  warehouseFilter,
  onWarehouseFilterChange,
  warehouses,
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
  layout = "sidebar",
  onSelectVehicle,
  onFocusWarehouse,
}: SidebarProps) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as SidebarTab)}
      className="flex h-full min-h-0 flex-col gap-0 bg-background"
    >
      <div className="shrink-0 border-b px-3 py-2">
        <TabsList className="grid h-8 w-full grid-cols-3" aria-label="Fleet lists">
          <TabsTrigger value="vehicles" className="gap-1 text-xs">
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1 text-xs">
            Warehouses
          </TabsTrigger>
          <TabsTrigger
            value="returns"
            className="gap-1 text-xs"
            aria-label={`Refunded / return pickups (${returnPickups.length})`}
          >
            Returns
          </TabsTrigger>
        </TabsList>
      </div>

      <label className="flex shrink-0 items-center gap-2 border-b px-3 py-2 text-xs font-medium">Warehouse
        <select aria-label="Filter by warehouse" value={warehouseFilter} onChange={e => onWarehouseFilterChange(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2">
          <option value="all">All permitted warehouses</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <TabsContent value="vehicles" className="flex min-h-0 flex-1 flex-col">
        <VehicleList
          vehicles={vehicles}
          warehouses={warehouses}
          positions={positions}
          counts={counts}
          stopEnrichment={stopEnrichment}
          selectedId={selectedId}
          query={query}
          onQueryChange={onQueryChange}
          filter={filter}
          onFilterChange={onFilterChange}
          sortKey={sortKey}
          onSortChange={onSortChange}
          onClearFilters={onClearFilters}
          layout={layout}
          onSelect={onSelectVehicle}
        />
      </TabsContent>

      <TabsContent value="warehouses" className="min-h-0 flex-1 overflow-y-auto">
        <WarehouseList
          warehouses={warehouses}
          vehicles={vehicles}
          focusedId={focusedWarehouseId}
          layout={layout}
          onFocus={onFocusWarehouse}
        />
      </TabsContent>

      <TabsContent value="returns" className="min-h-0 flex-1 overflow-y-auto">
        {simulationOn ? (
          <p className="p-4 text-sm text-muted-foreground">
            Switch back to live mode to view and assign return pickups.
          </p>
        ) : (
          <>
            {returnsError ? (
              <div role="alert" className="space-y-2 p-3 text-sm">
                <p>Unable to load return pickups.</p>
                <Button size="sm" variant="outline" onClick={onRetryReturns}>
                  Retry
                </Button>
              </div>
            ) : null}
            {returnsLoading ? (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                Loading return pickups…
              </p>
            ) : !returnsError || returnPickups.length > 0 ? (
              <ReturnPickups tasks={returnPickups} onFocus={onFocusReturn} />
            ) : null}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
