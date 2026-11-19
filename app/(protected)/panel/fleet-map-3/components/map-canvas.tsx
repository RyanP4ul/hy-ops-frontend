import {
  AlertCircle,
  Check,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  Layers,
  LocateFixed,
  Maximize2,
  Navigation,
  Route as RouteIcon,
  Search,
  Truck,
  Warehouse,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  useMap,
  type MapRef,
} from "@/components/ui/map";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CO_LOCATION_RADIUS_M, DEFAULT_MAP_CENTER } from "../constants";
import { formatAgo, formatDistance, formatDuration, pluralize } from "../lib/format";
import {
  clusterCoLocatedVehicles,
  getWarehouse,
  type CoLocatedVehicleGroup,
} from "../lib/geometry";
import type { RoadRoute } from "../lib/road-routing";
import {
  getNextPendingStop,
  getOperationalStatusKey,
  isRouteComplete,
} from "../lib/vehicle";
import type {
  DeliveryStop,
  FleetView,
  FollowMode,
  MapLayers,
  ResolvedPosition,
  StopEnrichment,
  Trip,
  Vehicle,
  WarehouseLocation,
} from "../types";
import type { ReturnPickup } from "./return-pickups";
import { SignalBadge } from "./signal-badge";
import { StatusBadge } from "./status-badge";

const PENDING_COLOR = "#94a3b8";
const PREVIEW_COLOR = "#4f46e5";
const SELECTED_ROUTE_COLOR = "#1d4ed8";

function ResizeMap({ triggerKey }: { triggerKey: string }) {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const frame = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(frame);
  }, [map, triggerKey]);

  return null;
}

function FollowInteractionGuard({
  followMode,
  onPauseFollow,
}: {
  followMode: FollowMode;
  onPauseFollow: () => void;
}) {
  const { map } = useMap();
  const stateRef = useRef({ followMode, onPauseFollow });

  useEffect(() => {
    stateRef.current = { followMode, onPauseFollow };
  }, [followMode, onPauseFollow]);

  useEffect(() => {
    if (!map) return;
    const handleMoveStart = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent && stateRef.current.followMode === "active") {
        stateRef.current.onPauseFollow();
      }
    };
    map.on("movestart", handleMoveStart);
    return () => {
      map.off("movestart", handleMoveStart);
    };
  }, [map]);

  return null;
}

type FleetMapCanvasProps = {
  returnPickups?: ReturnPickup[];
  mapRef: RefObject<MapRef | null>;
  view: FleetView;
  fullscreen: boolean;
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
  positions: Map<string, ResolvedPosition>;
  stopEnrichment: Map<string, StopEnrichment>;
  selectedId: string | null;
  previewTrip: { trip: Trip; vehicle: Vehicle } | null;
  roadRoutes: Map<string, RoadRoute | undefined>;
  previewRoute: RoadRoute | undefined;
  simulationOn: boolean;
  focusedWarehouseId: string | null;
  followMode: FollowMode;
  layers: MapLayers;
  onLayersChange: (next: MapLayers) => void;
  onPauseFollow: () => void;
  onResumeFollow: () => void;
  onStopFollow: () => void;
  onFitFleet: () => void;
  onFitRoute: () => void;
  onRecenterSelected: () => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onSelectStop: (vehicle: Vehicle, stop: DeliveryStop) => void;
  onFocusWarehouse: (warehouse: WarehouseLocation) => void;
};

export function FleetMapCanvas({
  returnPickups = [],
  mapRef,
  view,
  fullscreen,
  vehicles,
  warehouses,
  positions,
  stopEnrichment,
  selectedId,
  previewTrip,
  roadRoutes,
  previewRoute,
  simulationOn,
  focusedWarehouseId,
  followMode,
  layers,
  onLayersChange,
  onPauseFollow,
  onResumeFollow,
  onStopFollow,
  onFitFleet,
  onFitRoute,
  onRecenterSelected,
  onSelectVehicle,
  onSelectStop,
  onFocusWarehouse,
}: FleetMapCanvasProps) {
  const [legendOpen, setLegendOpen] = useState(false);
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId) ?? null;
  const selectedRoadRoute = selectedVehicle
    ? roadRoutes.get(selectedVehicle.id)
    : undefined;

  const resizeTrigger = `${view}-${fullscreen}-${selectedId ?? "none"}`;

  // Planned road route segments (never straight-line fallbacks).
  const segments = useMemo(() => {
    if (!layers.routes) return [];

    return vehicles.flatMap((vehicle) => {
      const selected = vehicle.id === selectedId;
      if (vehicle.stops.length === 0 && !vehicle.pickups?.length) return [];
      if (!selected && (!layers.allActiveRoutes || vehicle.status === "available")) {
        return [];
      }

      const route = roadRoutes.get(vehicle.id);
      if (!route) return [];

      if (!simulationOn) {
        return [
          {
            key: `route-${vehicle.id}-live`,
            coordinates: route.coordinates,
            color: selected ? SELECTED_ROUTE_COLOR : vehicle.color,
            selected,
            dashed: false,
          },
        ];
      }

      const stopSegments = vehicle.stops.map((stop, index) => ({
        key: `route-${vehicle.id}-${stop.id}`,
        coordinates: route.legs[index].coordinates,
        color:
          stop.status === "completed"
            ? selected
              ? SELECTED_ROUTE_COLOR
              : vehicle.color
            : PENDING_COLOR,
        selected,
        dashed: stop.status !== "completed",
      }));

      const returnLeg = route.legs[vehicle.stops.length];
      const returnSegment = returnLeg
        ? [
            {
              key: `route-${vehicle.id}-return`,
              coordinates: returnLeg.coordinates,
              color: isRouteComplete(vehicle)
                ? selected
                  ? SELECTED_ROUTE_COLOR
                  : vehicle.color
                : PENDING_COLOR,
              selected,
              dashed: !isRouteComplete(vehicle),
            },
          ]
        : [];

      return [...stopSegments, ...returnSegment];
    });
  }, [
    layers.allActiveRoutes,
    layers.routes,
    roadRoutes,
    selectedId,
    simulationOn,
    vehicles,
  ]);

  const vehicleClusters = useMemo(
    () =>
      clusterCoLocatedVehicles(
        vehicles,
        positions,
        selectedId,
        CO_LOCATION_RADIUS_M,
      ),
    [positions, selectedId, vehicles],
  );

  const activeCluster: CoLocatedVehicleGroup | null = activeClusterKey
    ? vehicleClusters.find((c) => c.key === activeClusterKey) ?? null
    : null;

  const quickMatches = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    const list = q
      ? vehicles.filter(
          (v) =>
            v.plate.toLowerCase().includes(q) ||
            v.driver.toLowerCase().includes(q) ||
            getWarehouse(v, warehouses).name.toLowerCase().includes(q),
        )
      : vehicles;
    return list.slice(0, 8);
  }, [quickQuery, vehicles, warehouses]);

  const rightOffsetClass = selectedVehicle
    ? "@3xl:right-[372px] @5xl:right-2.5"
    : "";

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        center={DEFAULT_MAP_CENTER}
        zoom={11}
        className="h-full w-full"
      >
        <MapControls position="bottom-right" showZoom showCompass />
        <ResizeMap triggerKey={resizeTrigger} />
        <FollowInteractionGuard
          followMode={followMode}
          onPauseFollow={onPauseFollow}
        />

        {/* Planned Road Routes (OSRM) */}
        {segments.map((segment) => (
          <MapRoute
            key={segment.key}
            coordinates={segment.coordinates}
            color={segment.color}
            width={segment.selected ? 5 : 3}
            opacity={segment.selected ? 0.92 : 0.45}
            dashArray={segment.dashed ? [2, 2] : undefined}
            active={segment.selected}
          />
        ))}

        {/* Previewed Scheduled Trip Road Route */}
        {layers.routes && previewRoute?.coordinates ? (
          <MapRoute
            key="preview-route"
            coordinates={previewRoute.coordinates}
            color={PREVIEW_COLOR}
            width={4}
            opacity={0.85}
            dashArray={[2, 2]}
          />
        ) : null}

        {/* Return Pickups */}
        {layers.returns
          ? returnPickups
              .filter((task) => task.coordinates && task.status !== "collected")
              .map((task) => (
                <MapMarker
                  key={`return-${task.id}`}
                  longitude={task.coordinates![0]}
                  latitude={task.coordinates![1]}
                >
                  <MarkerContent>
                    <div
                      className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-rose-700 text-xs font-bold text-white shadow-md"
                      aria-label={`Return pickup ${task.orderNumber}`}
                    >
                      R
                    </div>
                  </MarkerContent>
                  <MarkerTooltip>
                    <div>
                      <p className="font-semibold">
                        Return pickup · {task.orderNumber}
                      </p>
                      <p className="text-xs">{task.customer}</p>
                      <p className="text-xs opacity-80">
                        {task.status === "requested"
                          ? "Awaiting retrieval assignment"
                          : "Pickup assigned"}
                      </p>
                    </div>
                  </MarkerTooltip>
                </MapMarker>
              ))
          : null}

        {/* Warehouses */}
        {layers.warehouses
          ? warehouses.map((warehouse) => {
              const based = vehicles.filter(
                (v) => v.warehouseId === warehouse.id,
              );
              const focused = focusedWarehouseId === warehouse.id;
              return (
                <MapMarker
                  key={warehouse.id}
                  longitude={warehouse.coordinates[0]}
                  latitude={warehouse.coordinates[1]}
                  onClick={() => {
                    setActiveClusterKey(null);
                    onFocusWarehouse(warehouse);
                  }}
                >
                  <MarkerContent>
                    <div className="relative">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg border-2 border-white bg-slate-900 text-white shadow-md transition-transform",
                          focused && "scale-110 ring-2 ring-primary ring-offset-2",
                        )}
                        role="img"
                        aria-label={`Warehouse ${warehouse.name}`}
                      >
                        <Warehouse className="size-4" aria-hidden="true" />
                      </div>
                      {based.length > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-primary px-1 text-[10px] font-bold text-primary-foreground">
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
            })
          : null}

        {/* Delivery Stops */}
        {layers.stops
          ? vehicles.flatMap((vehicle) => {
              const selected = vehicle.id === selectedId;
              if (!selected && vehicle.status === "available") return [];
              const next = getNextPendingStop(vehicle);

              return vehicle.stops.map((stop, index) => {
                const enrichment = stopEnrichment.get(stop.id);
                const actualStatus =
                  enrichment?.actualStatus ??
                  (stop.status === "completed" ? "delivered" : "pending");
                const isDelivered = actualStatus === "delivered";
                const isFailed = actualStatus === "failed";
                const isNext =
                  !isDelivered && !isFailed && stop.id === next?.id;

                return (
                  <MapMarker
                    key={`${vehicle.id}-${stop.id}`}
                    longitude={stop.coordinates[0]}
                    latitude={stop.coordinates[1]}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveClusterKey(null);
                      onSelectStop(vehicle, stop);
                    }}
                  >
                    <MarkerContent>
                      {selected ? (
                        <div
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-md transition-transform hover:scale-110",
                            isDelivered && "bg-emerald-600 text-white",
                            isFailed && "bg-destructive text-white",
                            isNext &&
                              "scale-110 bg-primary text-primary-foreground ring-2 ring-primary/40",
                            !isDelivered &&
                              !isFailed &&
                              !isNext &&
                              "bg-amber-400 text-slate-950",
                          )}
                          aria-label={`Stop ${index + 1}: ${stop.name}`}
                        >
                          {isDelivered ? (
                            <Check className="size-3.5" aria-hidden="true" />
                          ) : isFailed ? (
                            <AlertCircle
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            index + 1
                          )}
                        </div>
                      ) : (
                        <div
                          className="size-3 rounded-full border-2 border-white shadow"
                          style={{
                            backgroundColor: isDelivered
                              ? vehicle.color
                              : isFailed
                                ? "#dc2626"
                                : PENDING_COLOR,
                          }}
                          aria-label={`Stop ${index + 1} for ${vehicle.plate}`}
                        />
                      )}
                    </MarkerContent>
                    <MarkerTooltip>
                      <div>
                        <p className="font-semibold">
                          #{index + 1} · {stop.name}
                        </p>
                        <p className="text-xs">
                          {vehicle.plate} · {stop.order.id} ·{" "}
                          {isDelivered
                            ? "Delivered"
                            : isFailed
                              ? "Failed"
                              : isNext
                                ? "Next stop"
                                : "Pending"}
                        </p>
                      </div>
                    </MarkerTooltip>
                  </MapMarker>
                );
              });
            })
          : null}

        {/* Previewed Scheduled Trip Stops */}
        {layers.stops && previewTrip?.trip.stops
          ? previewTrip.trip.stops.map((stop, index) => (
              <MapMarker
                key={`preview-${stop.id}`}
                longitude={stop.coordinates[0]}
                latitude={stop.coordinates[1]}
              >
                <MarkerContent>
                  <div
                    className="flex size-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md"
                    style={{ backgroundColor: PREVIEW_COLOR }}
                    aria-label={`Preview stop ${index + 1}: ${stop.name}`}
                  >
                    {index + 1}
                  </div>
                </MarkerContent>
                <MarkerTooltip>
                  <div>
                    <p className="font-semibold">{stop.name}</p>
                    <p className="text-xs">
                      {previewTrip.trip.label} (planned preview)
                    </p>
                  </div>
                </MarkerTooltip>
              </MapMarker>
            ))
          : null}

        {/* Vehicles (clustered cleanly when sharing identical/nearby coordinates) */}
        {vehicleClusters.map((cluster) => {
          if (cluster.vehicles.length === 1) {
            const vehicle = cluster.vehicles[0];
            const position = positions.get(vehicle.id);
            if (!position) return null;

            const selected = vehicle.id === selectedVehicle?.id;
            const active = vehicle.status !== "available";
            const gpsWarn =
              position.health === "stale" || position.health === "none";

            return (
              <MapMarker
                key={vehicle.id}
                longitude={position.coordinates[0]}
                latitude={position.coordinates[1]}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveClusterKey(null);
                  onSelectVehicle(vehicle);
                }}
              >
                <MarkerContent>
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative flex size-9 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition-transform",
                        selected &&
                          "scale-115 ring-2 ring-primary ring-offset-2",
                        position.isEstimated && "border-dashed opacity-85",
                        !active && !selected && "opacity-80",
                      )}
                      style={{ backgroundColor: vehicle.color }}
                      aria-label={`Vehicle ${vehicle.plate}, ${getOperationalStatusKey(vehicle)}`}
                    >
                      {active && position.heading != null ? (
                        <Navigation
                          className="size-4"
                          style={{
                            transform: `rotate(${position.heading}deg)`,
                          }}
                          aria-hidden="true"
                        />
                      ) : (
                        <Truck className="size-4" aria-hidden="true" />
                      )}

                      {gpsWarn ? (
                        <span
                          className={cn(
                            "absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full border border-white text-white",
                            position.health === "stale"
                              ? "bg-orange-600"
                              : "bg-slate-600",
                          )}
                          title={
                            position.health === "stale"
                              ? "Stale GPS"
                              : "No GPS fix"
                          }
                        >
                          <WifiOff className="size-2" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>

                    {selected ? (
                      <span className="mt-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                        {vehicle.plate}
                      </span>
                    ) : null}
                  </div>
                </MarkerContent>

                <MarkerTooltip>
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {vehicle.plate} · {vehicle.driver}
                    </p>
                    <p className="text-xs opacity-90">
                      Status:{" "}
                      {getOperationalStatusKey(vehicle).replaceAll("_", " ")}
                    </p>
                    <p className="text-xs opacity-80">
                      {position.health === "fresh"
                        ? `GPS fresh · ${formatAgo(position.ageMs ?? 0)}`
                        : position.health === "delayed"
                          ? `GPS delayed · ${formatAgo(position.ageMs ?? 0)}`
                          : position.health === "stale"
                            ? `Last known · ${formatAgo(position.ageMs ?? 0)}`
                            : position.health === "simulated"
                              ? "Simulated position"
                              : "No GPS fix (estimated location)"}
                    </p>
                  </div>
                </MarkerTooltip>
              </MapMarker>
            );
          }

          // Multi-vehicle co-located cluster
          const selectedInCluster = cluster.vehicles.find(
            (v) => v.id === selectedVehicle?.id,
          );
          const anyGpsWarn = cluster.vehicles.some((v) => {
            const p = positions.get(v.id);
            return (
              v.status !== "available" &&
              (p?.health === "stale" || p?.health === "none")
            );
          });

          return (
            <MapMarker
              key={cluster.key}
              longitude={cluster.coordinates[0]}
              latitude={cluster.coordinates[1]}
              onClick={(event) => {
                event.stopPropagation();
                setActiveClusterKey((current) =>
                  current === cluster.key ? null : cluster.key,
                );
              }}
            >
              <MarkerContent>
                <div className="relative flex flex-col items-center">
                  <div
                    className={cn(
                      "relative flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border-2 border-white bg-slate-800 px-2 text-xs font-bold text-white shadow-md transition-transform hover:scale-105",
                      selectedInCluster &&
                        "bg-primary ring-2 ring-primary ring-offset-2",
                    )}
                    aria-label={`${cluster.vehicles.length} vehicles at this location`}
                  >
                    <Truck className="size-3.5" aria-hidden="true" />
                    <span>{cluster.vehicles.length}</span>
                    {anyGpsWarn ? (
                      <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border border-white bg-orange-500" />
                    ) : null}
                  </div>
                  {selectedInCluster ? (
                    <span className="mt-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                      {selectedInCluster.plate} +{cluster.vehicles.length - 1}
                    </span>
                  ) : null}
                </div>
              </MarkerContent>
              <MarkerTooltip>
                <div>
                  <p className="font-semibold">
                    {cluster.vehicles.length} vehicles at this location
                  </p>
                  <p className="text-xs">
                    Click to select:{" "}
                    {cluster.vehicles.map((v) => v.plate).join(", ")}
                  </p>
                </div>
              </MarkerTooltip>
            </MapMarker>
          );
        })}
      </Map>

      {/* Unified Top Map Overlay Row (wraps cleanly on narrow map widths to prevent collisions) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex flex-wrap items-start justify-between gap-2 transition-[right]",
          rightOffsetClass,
        )}
      >
        {(view === "map" || (followMode !== "off" && selectedVehicle)) ? (
          <div className="flex max-w-full flex-col items-start gap-2">
            {view === "map" ? (
              <div className="pointer-events-auto relative w-64 max-w-full">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={quickQuery}
                    onFocus={() => setQuickOpen(true)}
                    onChange={(event) => {
                      setQuickQuery(event.target.value);
                      setQuickOpen(true);
                    }}
                    placeholder="Jump to plate or driver…"
                    aria-label="Quick search vehicle on map"
                    className="h-8 border bg-background pl-8 pr-8 text-xs shadow-sm"
                  />
                  {quickQuery || quickOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickQuery("");
                        setQuickOpen(false);
                      }}
                      aria-label="Close vehicle search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {quickOpen ? (
                  <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
                    {quickMatches.length === 0 ? (
                      <p className="px-2.5 py-3 text-xs text-muted-foreground">
                        No matching vehicles.
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {quickMatches.map((vehicle) => {
                          const pos = positions.get(vehicle.id);
                          return (
                            <li key={vehicle.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickOpen(false);
                                  setQuickQuery("");
                                  onSelectVehicle(vehicle);
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                                  vehicle.id === selectedId && "bg-primary/10",
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">
                                    {vehicle.plate}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {vehicle.driver}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <StatusBadge
                                    status={getOperationalStatusKey(vehicle)}
                                  />
                                  {pos ? (
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                      {pos.health === "fresh"
                                        ? "GPS fresh"
                                        : pos.health === "delayed"
                                          ? "GPS delayed"
                                          : pos.health === "stale"
                                            ? "Last known"
                                            : pos.health === "simulated"
                                              ? "Simulated"
                                              : "No GPS"}
                                    </p>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {followMode !== "off" && selectedVehicle ? (
              <div className="pointer-events-auto flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-sm">
                <Crosshair
                  className={cn(
                    "size-3.5 shrink-0",
                    followMode === "active"
                      ? "text-primary"
                      : "text-amber-600",
                  )}
                  aria-hidden="true"
                />
                <span className="font-medium">
                  {followMode === "active"
                    ? `Following ${selectedVehicle.plate}`
                    : `Follow paused (${selectedVehicle.plate})`}
                </span>
                {followMode === "paused" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-6 px-2 text-[11px]"
                    onClick={onResumeFollow}
                  >
                    Resume
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={onStopFollow}
                  >
                    Stop
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 rounded-lg border bg-background p-1 shadow-sm">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onFitFleet}
            title="Fit map to all valid known vehicle and warehouse locations"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Fit fleet</span>
          </Button>

          {selectedVehicle ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onRecenterSelected}
                title={`Center on ${selectedVehicle.plate}`}
              >
                <LocateFixed className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Recenter</span>
              </Button>

              {selectedVehicle.stops.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={onFitRoute}
                  title="Fit map to selected vehicle route"
                >
                  <RouteIcon className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Fit route</span>
                </Button>
              ) : null}
            </>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant={layers.routes ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2 text-xs"
            aria-pressed={layers.routes}
            onClick={() =>
              onLayersChange({ ...layers, routes: !layers.routes })
            }
            title={layers.routes ? "Hide road routes" : "Show road routes"}
          >
            {layers.routes ? (
              <Eye className="size-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {layers.routes ? "Routes on" : "Routes off"}
            </span>
          </Button>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  aria-label="Map layers"
                >
                  <Layers className="size-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Layers</span>
                </Button>
              }
            />
            <PopoverContent align="end" className="w-60 space-y-2 p-3 text-xs">
              <p className="font-semibold text-foreground">Map layers</p>
              {(
                [
                  { key: "routes", label: "Planned road routes" },
                  {
                    key: "allActiveRoutes",
                    label: "Other active vehicle routes",
                  },
                  { key: "stops", label: "Delivery stops" },
                  { key: "warehouses", label: "Warehouses" },
                  { key: "returns", label: "Return pickups" },
                ] as const
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-2 py-0.5"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    disabled={key === "allActiveRoutes" && !layers.routes}
                    onChange={(event) =>
                      onLayersChange({
                        ...layers,
                        [key]: event.target.checked,
                      })
                    }
                  />
                </label>
              ))}
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            size="sm"
            variant={legendOpen ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2 text-xs"
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((current) => !current)}
          >
            <Info className="size-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Legend</span>
          </Button>
        </div>

        {legendOpen ? (
          <div className="pointer-events-auto w-64 rounded-lg border bg-background p-3 text-xs shadow-md">
            <div className="flex items-center justify-between border-b pb-1.5">
              <span className="font-semibold">Map legend</span>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                aria-label="Close legend"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-2 space-y-1.5 text-[11px]">
              <li className="flex items-center gap-2">
                <span className="h-1 w-5 rounded bg-primary" />
                <span>Planned road route (OSRM)</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="h-0 w-5 border-t-2 border-dashed"
                  style={{ borderColor: PREVIEW_COLOR }}
                />
                <span>Scheduled trip preview</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                  1
                </span>
                <span>Next actionable delivery stop</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                  ✓
                </span>
                <span>Delivered stop</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  !
                </span>
                <span>Failed stop</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center rounded bg-slate-900 text-[9px] text-white">
                  W
                </span>
                <span>Warehouse base</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-rose-700 text-[9px] font-bold text-white">
                  R
                </span>
                <span>Return pickup location</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-orange-600 text-white">
                  <WifiOff className="size-2.5" aria-hidden="true" />
                </span>
                <span>Stale or missing GPS fix</span>
              </li>
            </ul>
            <p className="mt-2 border-t pt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Lines show planned road navigation from current GPS, not
              historical GPS trails.
            </p>
          </div>
        ) : null}

        {selectedRoadRoute && selectedVehicle ? (
          <div className="pointer-events-auto hidden rounded-md border bg-background px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm sm:block">
            <span className="font-medium text-foreground">
              {selectedVehicle.plate}
            </span>{" "}
            planned leg: {formatDuration(selectedRoadRoute.duration)} ·{" "}
            {formatDistance(selectedRoadRoute.distance)}
          </div>
        ) : null}
        </div>
      </div>

      {/* Co-located Vehicle Selection Card */}
      {activeCluster ? (
        <div
          role="dialog"
          aria-label="Vehicles at this location"
          className="absolute bottom-14 left-3 z-20 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border bg-card p-2.5 shadow-lg"
        >
          <div className="flex items-center justify-between border-b pb-1.5">
            <span className="text-xs font-semibold">
              {activeCluster.vehicles.length} vehicles at this coordinate
            </span>
            <button
              type="button"
              onClick={() => setActiveClusterKey(null)}
              aria-label="Close co-located vehicles list"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto">
            {activeCluster.vehicles.map((vehicle) => {
              const pos = positions.get(vehicle.id);
              return (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClusterKey(null);
                      onSelectVehicle(vehicle);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                      vehicle.id === selectedId &&
                        "border-primary bg-primary/5",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{vehicle.plate}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {vehicle.driver}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <StatusBadge status={getOperationalStatusKey(vehicle)} />
                      {pos ? <SignalBadge position={pos} compact /> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
