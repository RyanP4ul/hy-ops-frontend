import type { ReturnPickup } from "./return-pickups";
import { Check, Truck, Warehouse } from "lucide-react";
import { useEffect, type RefObject } from "react";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  type MapRef,
  useMap,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";
import { AT_WAREHOUSE_RADIUS_M, DEFAULT_MAP_CENTER } from "../constants";
import { distanceMeters, getWarehouse } from "../lib/geometry";
import type { RoadRoute } from "../lib/road-routing";
import { formatAgo, pluralize } from "../lib/format";
import { getNextPendingStop, isRouteComplete } from "../lib/vehicle";
import type {
  ResolvedPosition,
  Trip,
  Vehicle,
  WarehouseLocation,
} from "../types";

const PENDING_COLOR = "#94a3b8";
const PREVIEW_COLOR = "#6366f1";

// Resizing the workspace or revealing a hidden map must update its canvas too.
function ResizeMap() {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type FleetMapCanvasProps = {
  returnPickups?: ReturnPickup[];
  mapRef: RefObject<MapRef | null>;
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
  positions: Map<string, ResolvedPosition>;
  selectedId: string | null;
  previewTrip: { trip: Trip; vehicle: Vehicle } | null;
  roadRoutes: Map<string, RoadRoute | undefined>;
  previewRoute: RoadRoute | undefined;
  simulationOn: boolean;
  focusedWarehouseId: string | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onFocusWarehouse: (warehouse: WarehouseLocation) => void;
};

export function FleetMapCanvas({
  returnPickups = [],
  mapRef,
  vehicles,
  warehouses,
  positions,
  selectedId,
  previewTrip,
  roadRoutes,
  previewRoute,
  simulationOn,
  focusedWarehouseId,
  onSelectVehicle,
  onFocusWarehouse,
}: FleetMapCanvasProps) {
  const selectedVehicle = vehicles.find((v) => v.id === selectedId) ?? null;

  // Routes: the selected vehicle's (always) and every vehicle that is out on a trip.
  const segments = vehicles.flatMap((vehicle) => {
    const selected = vehicle.id === selectedId;
    if (vehicle.stops.length === 0 && !vehicle.pickups?.length) return [];
    if (!selected && vehicle.status === "available") return [];

    const route = roadRoutes.get(vehicle.id);
    if (!route) return [];
    if (!simulationOn) return [{
      key: `route-${vehicle.id}-live`, coordinates: route.coordinates,
      color: vehicle.color, selected,
    }];
    const stopSegments = vehicle.stops.map((stop, index) => ({
      key: `route-${vehicle.id}-${stop.id}`,
      coordinates: route.legs[index].coordinates,
      color: stop.status === "completed" ? vehicle.color : PENDING_COLOR,
      selected,
    }));

    const returnLeg = route.legs[vehicle.stops.length];
    const returnSegment =
      returnLeg
        ? [
            {
              key: `route-${vehicle.id}-return`,
              coordinates: returnLeg.coordinates,
              color: isRouteComplete(vehicle) ? vehicle.color : PENDING_COLOR,
              selected,
            },
          ]
        : [];

    return [...stopSegments, ...returnSegment];
  });

  const previewPath = previewRoute?.coordinates;

  // Idle vehicles parked at their warehouse are folded into the warehouse marker.
  const visibleVehicles = vehicles
    .filter((vehicle) => {
      if (vehicle.id === selectedId || vehicle.status !== "available") {
        return true;
      }
      const position = positions.get(vehicle.id);
      return (
        !!position &&
        distanceMeters(
          position.coordinates,
          getWarehouse(vehicle, warehouses).coordinates,
        ) > AT_WAREHOUSE_RADIUS_M
      );
    })
    .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));

  return (
    <Map
      ref={mapRef}
      center={DEFAULT_MAP_CENTER}
      zoom={11}
      className="h-full w-full"
    >
      <MapControls position="bottom-right" />
      <ResizeMap />
      {returnPickups.filter(task => task.coordinates && task.status !== "collected").map(task => <MapMarker key={`return-${task.id}`} longitude={task.coordinates![0]} latitude={task.coordinates![1]}><MarkerContent><div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-rose-700 font-bold text-white shadow">R</div></MarkerContent><MarkerTooltip>Refunded: {task.orderNumber} / {task.status === "requested" ? "Awaiting retrieval" : "Pickup assigned"}</MarkerTooltip></MapMarker>)}

      {segments.map((segment) => (
        <MapRoute
          key={segment.key}
          coordinates={segment.coordinates}
          color={segment.color}
          width={segment.selected ? 5 : 3}
          opacity={segment.selected ? 0.9 : 0.45}
        />
      ))}

      {previewPath ? (
        <MapRoute
          key="preview-route"
          coordinates={previewPath}
          color={PREVIEW_COLOR}
          width={4}
          opacity={0.8}
        />
      ) : null}

      {/* WAREHOUSES (read-only) */}
      {warehouses.map((warehouse) => {
        const based = vehicles.filter((v) => v.warehouseId === warehouse.id);
        const focused = focusedWarehouseId === warehouse.id;
        return (
          <MapMarker
            key={warehouse.id}
            longitude={warehouse.coordinates[0]}
            latitude={warehouse.coordinates[1]}
            onClick={() => onFocusWarehouse(warehouse)}
          >
            <MarkerContent>
              <div className="relative">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl border-2 border-white bg-slate-900 text-white shadow-lg transition-transform",
                    focused && "scale-110 ring-2 ring-primary ring-offset-2",
                  )}
                  role="img"
                  aria-label={warehouse.name}
                >
                  <Warehouse className="size-5" />
                </div>
                {based.length > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-primary-foreground">
                    {based.length}
                  </span>
                ) : null}
              </div>
            </MarkerContent>
            <MarkerTooltip>
              <div>
                <p className="font-semibold">{warehouse.name}</p>
                <p className="text-xs">{warehouse.address}</p>
                <p className="text-xs">
                  {pluralize(based.length, "vehicle")} based here
                </p>
              </div>
            </MarkerTooltip>
          </MapMarker>
        );
      })}

      {/* STOPS: numbered for the selected vehicle, small dots for the others on a trip */}
      {vehicles.flatMap((vehicle) => {
        const selected = vehicle.id === selectedId;
        if (!selected && vehicle.status === "available") return [];
        const next = getNextPendingStop(vehicle);

        return vehicle.stops.map((stop, index) => {
          const completed = stop.status === "completed";
          return (
            <MapMarker
              key={`${vehicle.id}-${stop.id}`}
              longitude={stop.coordinates[0]}
              latitude={stop.coordinates[1]}
              onClick={() => onSelectVehicle(vehicle)}
            >
              <MarkerContent>
                {selected ? (
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-md",
                      completed && "bg-emerald-600 text-white",
                      !completed &&
                        stop.id === next?.id &&
                        "bg-primary text-primary-foreground",
                      !completed &&
                        stop.id !== next?.id &&
                        "bg-amber-400 text-slate-950",
                    )}
                  >
                    {completed ? <Check className="size-4" /> : index + 1}
                  </div>
                ) : (
                  <div
                    className="size-3 rounded-full border-2 border-white shadow"
                    style={{
                      backgroundColor: completed
                        ? vehicle.color
                        : PENDING_COLOR,
                    }}
                  />
                )}
              </MarkerContent>
              <MarkerTooltip>
                <div>
                  <p className="font-semibold">{stop.name}</p>
                  <p className="text-xs">
                    {vehicle.plate} · {completed ? "Delivered" : "Pending"}
                  </p>
                </div>
              </MarkerTooltip>
            </MapMarker>
          );
        });
      })}

      {/* PREVIEWED TRIP STOPS */}
      {previewTrip?.trip.stops.map((stop, index) => (
        <MapMarker
          key={`preview-${stop.id}`}
          longitude={stop.coordinates[0]}
          latitude={stop.coordinates[1]}
        >
          <MarkerContent>
            <div
              className="flex size-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md"
              style={{ backgroundColor: PREVIEW_COLOR }}
            >
              {index + 1}
            </div>
          </MarkerContent>
          <MarkerTooltip>
            <div>
              <p className="font-semibold">{stop.name}</p>
              <p className="text-xs">{previewTrip.trip.label} (preview)</p>
            </div>
          </MarkerTooltip>
        </MapMarker>
      ))}

      {/* VEHICLES (selected one is last so it draws on top) */}
      {visibleVehicles.map((vehicle) => {
        const position = positions.get(vehicle.id);
        if (!position) return null;
        const selected = vehicle.id === selectedVehicle?.id;
        const active = vehicle.status !== "available";
        const weakSignal =
          active && (position.signal === "stale" || position.signal === "none");

        return (
          <MapMarker
            key={vehicle.id}
            longitude={position.coordinates[0]}
            latitude={position.coordinates[1]}
            onClick={() => onSelectVehicle(vehicle)}
          >
            <MarkerContent>
              <div className="relative flex flex-col items-center">
                {position.signal === "live" && active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 size-9 animate-ping rounded-full opacity-25"
                    style={{ backgroundColor: vehicle.color }}
                  />
                ) : null}
                <div
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform",
                    selected && "scale-110 ring-2 ring-primary ring-offset-2",
                    !active && "opacity-70",
                  )}
                  style={{ backgroundColor: vehicle.color }}
                  aria-label={`${vehicle.plate}, ${vehicle.status}`}
                >
                  <Truck className="size-4" />
                  {weakSignal ? (
                    <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-amber-500" />
                  ) : null}
                </div>
                {selected ? (
                  <span className="mt-1 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                    {vehicle.plate}
                  </span>
                ) : null}
              </div>
            </MarkerContent>
            <MarkerTooltip>
              <div>
                <p className="font-semibold">{vehicle.plate}</p>
                <p className="text-xs">{vehicle.driver}</p>
                <p className="text-xs">
                  {position.signal === "live" || position.signal === "stale"
                    ? `GPS ${formatAgo(position.ageMs ?? 0)}`
                    : position.signal === "simulated"
                      ? "Simulated position"
                      : "No GPS signal"}
                </p>
              </div>
            </MarkerTooltip>
          </MapMarker>
        );
      })}
    </Map>
  );
}
