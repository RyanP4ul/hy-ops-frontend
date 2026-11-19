import {
  Check,
  Crosshair,
  Layers,
  Maximize2,
  PackageMinus,
  TriangleAlert,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
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
import {
  formatDistance,
  formatDuration,
  pluralize,
} from "../lib/format";
import {
  clusterCoLocatedVehicles,
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
  FollowMode,
  MapLayers,
  ResolvedPosition,
  StopEnrichment,
  Trip,
  Vehicle,
  WarehouseLocation,
  WorkspaceMode,
} from "../types";
import { FleetMarker, MarkerGlyph, type MarkerTone } from "./fleet-marker";
import type { ReturnPickup } from "./return-pickups";
import { GpsLabel, StatusLabel } from "./status-pill";

const PENDING_COLOR = "#94a3b8";
const PREVIEW_COLOR = "#4f46e5";
const SELECTED_ROUTE_COLOR = "#1d4ed8";

const STOP_LABELS = {
  next: "Next stop",
  pending: "Pending",
  delivered: "Delivered",
  failed: "Failed",
} as const;

const MARKER_KEY = [
  { tone: "vehicle", label: "Vehicle", glyph: <Truck />, heading: 45 },
  {
    tone: "cluster",
    label: "Vehicle group",
    glyph: (
      <>
        <Truck />
        <span className="fm-cluster-count">3</span>
      </>
    ),
  },
  { tone: "warehouse", label: "Warehouse", glyph: <Warehouse /> },
  { tone: "return", label: "Return pickup", glyph: <PackageMinus /> },
  { tone: "next", label: STOP_LABELS.next, glyph: "1" },
  { tone: "pending", label: STOP_LABELS.pending, glyph: "2" },
  { tone: "delivered", label: STOP_LABELS.delivered, glyph: <Check /> },
  { tone: "failed", label: STOP_LABELS.failed, glyph: <X /> },
  { tone: "preview", label: "Trip preview", glyph: "1" },
  { tone: "gps", label: "GPS issue", glyph: <TriangleAlert /> },
] satisfies {
  tone: MarkerTone;
  label: string;
  glyph?: ReactNode;
  heading?: number;
}[];

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
  mode: WorkspaceMode;
  fullscreen: boolean;
  railOpen: boolean;
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
  onSelectVehicle: (vehicle: Vehicle) => void;
  onSelectStop: (vehicle: Vehicle, stop: DeliveryStop) => void;
  onFocusWarehouse: (warehouse: WarehouseLocation) => void;
};

export function FleetMapCanvas({
  returnPickups = [],
  mapRef,
  mode,
  fullscreen,
  railOpen,
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
  onSelectVehicle,
  onSelectStop,
  onFocusWarehouse,
}: FleetMapCanvasProps) {
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId) ?? null;
  const selectedRoadRoute = selectedVehicle
    ? roadRoutes.get(selectedVehicle.id)
    : undefined;

  const resizeTrigger = `${mode}-${fullscreen}-${railOpen}-${selectedId ?? "none"}`;

  const segments = useMemo(() => {
    if (!layers.routes) return [];

    return vehicles.flatMap((vehicle) => {
      const selected = vehicle.id === selectedId;
      if (vehicle.stops.length === 0 && !vehicle.pickups?.length) return [];
      if (
        !selected &&
        (!layers.allActiveRoutes || vehicle.status === "available")
      ) {
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
    ? (vehicleClusters.find((c) => c.key === activeClusterKey) ?? null)
    : null;

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        center={DEFAULT_MAP_CENTER}
        zoom={11}
        clean
        className="h-full w-full"
      >
        <MapControls position="bottom-right" showZoom showCompass />
        <ResizeMap triggerKey={resizeTrigger} />
        <FollowInteractionGuard
          followMode={followMode}
          onPauseFollow={onPauseFollow}
        />

        {/* Road Routes */}
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

        {/* Previewed Scheduled Trip Route */}
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
                  anchor="bottom"
                >
                  <FleetMarker
                    name={`Return pickup ${task.orderNumber}`}
                    title={`Return pickup · ${task.orderNumber}`}
                    details={task.customer}
                    pinned
                    priority="location"
                  >
                    <MarkerGlyph tone="return">
                      <PackageMinus />
                    </MarkerGlyph>
                  </FleetMarker>
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
                  anchor="bottom"
                  onClick={() => {
                    setActiveClusterKey(null);
                    onFocusWarehouse(warehouse);
                  }}
                >
                  <FleetMarker
                    name={`Warehouse ${warehouse.name}, ${pluralize(based.length, "vehicle")}`}
                    title={warehouse.name}
                    details={pluralize(based.length, "vehicle")}
                    badge={based.length}
                    interactive
                    pinned
                    selected={focused}
                    priority="location"
                  >
                    <MarkerGlyph tone="warehouse">
                      <Warehouse />
                    </MarkerGlyph>
                  </FleetMarker>
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
                const tone =
                  actualStatus === "pending" && selected && stop.id === next?.id
                    ? "next"
                    : actualStatus;
                const status = STOP_LABELS[tone];

                return (
                  <MapMarker
                    key={`${vehicle.id}-${stop.id}`}
                    longitude={stop.coordinates[0]}
                    latitude={stop.coordinates[1]}
                    anchor={selected ? "bottom" : "center"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveClusterKey(null);
                      onSelectStop(vehicle, stop);
                    }}
                  >
                    <FleetMarker
                      name={`Stop ${index + 1}: ${stop.name}, ${status}, ${vehicle.plate}`}
                      title={`#${index + 1} · ${stop.name}`}
                      details={`${status} · ${vehicle.plate} · ${stop.order.id}`}
                      interactive
                      pinned={selected}
                      priority={selected ? "location" : undefined}
                    >
                      <MarkerGlyph
                        tone={tone}
                        compact={!selected}
                        pulse={selected && tone === "next" ? "selected" : false}
                      >
                        {tone === "delivered" ? (
                          <Check />
                        ) : tone === "failed" ? (
                          <X />
                        ) : selected ? (
                          index + 1
                        ) : null}
                      </MarkerGlyph>
                    </FleetMarker>
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
                anchor="bottom"
              >
                <FleetMarker
                  name={`Preview stop ${index + 1}: ${stop.name}`}
                  title={`#${index + 1} · ${stop.name}`}
                  details={previewTrip.trip.label}
                  pinned
                  priority="location"
                >
                  <MarkerGlyph tone="preview">
                    {index + 1}
                  </MarkerGlyph>
                </FleetMarker>
              </MapMarker>
            ))
          : null}

        {/* Vehicle Markers & Co-located Clusters */}
        {vehicleClusters.map((cluster) => {
          if (cluster.vehicles.length === 1) {
            const vehicle = cluster.vehicles[0];
            const position = positions.get(vehicle.id);
            if (!position) return null;

            const selected = vehicle.id === selectedVehicle?.id;
            const active = vehicle.status !== "available";
            const gpsWarning =
              position.health === "stale"
                ? position.ageMs === null
                  ? "Invalid GPS"
                  : "Stale GPS"
                : position.health === "none"
                  ? "No GPS"
                  : undefined;

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
                <FleetMarker
                  name={`Vehicle ${vehicle.plate}${position.isEstimated ? ", estimated location" : ""}`}
                  title={`${vehicle.plate} · ${vehicle.driver}`}
                  details={
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <StatusLabel status={getOperationalStatusKey(vehicle)} />
                      <GpsLabel position={position} />
                    </div>
                  }
                  label={selected ? vehicle.plate : undefined}
                  accentColor={vehicle.color}
                  warning={gpsWarning}
                  interactive
                  selected={selected}
                  priority={selected ? "selected" : "vehicle"}
                >
                  <MarkerGlyph
                    tone={active ? "vehicle" : "parked"}
                    color={vehicle.color}
                    heading={active ? position.heading : null}
                    estimated={position.isEstimated}
                    pulse={selected ? "selected" : active ? "live" : false}
                  >
                    <Truck />
                  </MarkerGlyph>
                </FleetMarker>
              </MapMarker>
            );
          }

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
              <FleetMarker
                name={`${cluster.vehicles.length} vehicles here`}
                title={`${cluster.vehicles.length} vehicles at this location`}
                details={cluster.vehicles.map((v) => v.plate).join(", ")}
                label={
                  selectedInCluster
                    ? `${selectedInCluster.plate} +${cluster.vehicles.length - 1}`
                    : undefined
                }
                accentColor={selectedInCluster?.color}
                warning={anyGpsWarn ? "GPS issue" : undefined}
                interactive
                expanded={activeCluster?.key === cluster.key}
                selected={selectedInCluster ? true : undefined}
                priority={
                  selectedInCluster || activeCluster?.key === cluster.key
                    ? "selected"
                    : "vehicle"
                }
              >
                <MarkerGlyph
                  tone="cluster"
                  pulse={selectedInCluster ? "selected" : false}
                >
                  <Truck />
                  <span className="fm-cluster-count">
                    {cluster.vehicles.length}
                  </span>
                </MarkerGlyph>
              </FleetMarker>
            </MapMarker>
          );
        })}
      </Map>

      {/* Top-right compact floating controls (Fit fleet + Layers/Key popover) */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur-md">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={onFitFleet}
            title="Fit all vehicles"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Fit all</span>
          </Button>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  aria-label="Map layers and key"
                >
                  <Layers className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Layers</span>
                </Button>
              }
            />
            <PopoverContent align="end" className="w-64 space-y-3 p-3 text-xs">
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground">Map layers</p>
                {(
                  [
                    { key: "routes", label: "Road routes" },
                    { key: "allActiveRoutes", label: "Other active routes" },
                    { key: "stops", label: "Delivery stops" },
                    { key: "warehouses", label: "Warehouses" },
                    { key: "returns", label: "Return pickups" },
                  ] as const
                ).map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between gap-2 py-0.5"
                  >
                    <span
                      className={cn(
                        key === "allActiveRoutes" &&
                          !layers.routes &&
                          "opacity-50",
                      )}
                    >
                      {label}
                    </span>
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
              </div>

              <div className="space-y-1.5 border-t pt-2.5 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground">Key</p>
                <ul className="fm-marker-key grid grid-cols-2 gap-x-2 gap-y-2">
                  {MARKER_KEY.map(({ tone, label, glyph, heading }) => (
                    <li key={tone} className="flex items-center gap-2">
                      <span className="grid w-6 shrink-0 place-items-center">
                        <MarkerGlyph tone={tone} heading={heading}>
                          {glyph}
                        </MarkerGlyph>
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Selected vehicle route ETA pill */}
        {selectedRoadRoute && selectedVehicle ? (
          <div className="fm-panel-enter pointer-events-auto hidden rounded-lg border bg-background/95 px-2.5 py-1 text-xs shadow-sm backdrop-blur-md sm:block">
            <span className="font-semibold text-foreground">
              {selectedVehicle.plate}
            </span>
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {formatDuration(selectedRoadRoute.duration)} ·{" "}
              {formatDistance(selectedRoadRoute.distance)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Active / Paused Follow Pill */}
      {followMode !== "off" && selectedVehicle ? (
        <div className="fm-panel-enter absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 py-1 pl-3 pr-1.5 text-xs shadow-sm backdrop-blur-md">
          <Crosshair
            className={cn(
              "size-3.5 shrink-0",
              followMode === "active" ? "text-primary" : "text-amber-600",
            )}
            aria-hidden="true"
          />
          <span className="font-medium">
            {followMode === "active"
              ? `Following ${selectedVehicle.plate}`
              : `Paused · ${selectedVehicle.plate}`}
          </span>
          {followMode === "paused" ? (
            <Button
              type="button"
              size="sm"
              className="h-6 rounded-full px-2.5 text-[11px]"
              onClick={onResumeFollow}
            >
              Resume
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 rounded-full px-2 text-[11px]"
              onClick={onStopFollow}
            >
              Stop
            </Button>
          )}
        </div>
      ) : null}

      {/* Co-located Vehicle Picker */}
      {activeCluster ? (
        <div
          role="dialog"
          aria-label="Vehicles at this location"
          className="fm-panel-enter absolute bottom-12 right-12 z-20 w-64 max-w-[calc(100%-1.5rem)] rounded-xl border bg-background/95 p-2.5 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center justify-between pb-1.5 border-b">
            <span className="text-xs font-semibold">
              {activeCluster.vehicles.length} vehicles here
            </span>
            <button
              type="button"
              onClick={() => setActiveClusterKey(null)}
              aria-label="Close list"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="mt-1.5 max-h-48 divide-y divide-border/50 overflow-y-auto">
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
                      "flex w-full items-center justify-between gap-2 px-1.5 py-2 text-left text-xs hover:bg-accent/60",
                      vehicle.id === selectedId && "bg-primary/8",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{vehicle.plate}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {vehicle.driver}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <StatusLabel status={getOperationalStatusKey(vehicle)} />
                      {pos ? <GpsLabel position={pos} /> : null}
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
