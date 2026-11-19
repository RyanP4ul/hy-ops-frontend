"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Truck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Map,
  MapControls,
  MapRoute,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import {
  fleetKeys,
  useFleetQuery,
} from "../../fleet-map/hooks/use-fleet-query";
import { useLivePositions } from "../../fleet-map/hooks/use-live-positions";
import { useNow } from "../../fleet-map/hooks/use-now";
import { useRoadRoutes } from "../../fleet-map/hooks/use-road-routes";
import { resolveVehiclePosition } from "../../fleet-map/lib/live";
import { liveRoutePoints } from "../../fleet-map/lib/live-route";
import { getBounds } from "../../fleet-map/lib/geometry";
import {
  DEFAULT_MAP_CENTER,
  EMPTY_WAREHOUSES,
  FLEET_POLL_MS,
} from "../../fleet-map/constants";
import type { Coordinates } from "../../fleet-map/types";
import { MapMarker } from "./map-marker";

function MapCameraController({
  allPoints,
  focusTarget,
  fitTrigger,
}: {
  allPoints: Coordinates[];
  focusTarget: Coordinates | null;
  fitTrigger: number;
}) {
  const { map, isLoaded } = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    const bounds = getBounds(allPoints);
    if (!map || !isLoaded || fitted.current || !bounds) return;
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
    fitted.current = true;
  }, [map, isLoaded, allPoints]);

  useEffect(() => {
    if (!map || !isLoaded || !focusTarget) return;
    map.easeTo({ center: focusTarget, zoom: 14 });
  }, [map, isLoaded, focusTarget]);

  useEffect(() => {
    if (!map || !isLoaded || fitTrigger === 0) return;
    const bounds = getBounds(allPoints);
    if (bounds) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 14 });
    }
  }, [map, isLoaded, fitTrigger, allPoints]);

  return null;
}

export function FleetMapPanel() {
  const fleet = useFleetQuery({ pollMs: FLEET_POLL_MS });
  const live = useLivePositions(true);
  const now = useNow();
  const cache = useQueryClient();
  const { subscribe } = useWebSocket();

  const [focusedVehicleId, setFocusedVehicleId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  useEffect(
    () =>
      subscribe(REQUESTS.DRIVER_LOCATION_UPDATE, () => {
        void cache.invalidateQueries({ queryKey: fleetKeys.positions });
      }),
    [cache, subscribe],
  );

  const vehicles = useMemo(
    () => fleet.data?.vehicles ?? [],
    [fleet.data?.vehicles],
  );
  const warehouses = fleet.data?.warehouses ?? EMPTY_WAREHOUSES;
  const routes = useRoadRoutes(
    vehicles,
    warehouses,
    null,
    null,
    live.positions,
    false,
    now,
  );

  const entries = useMemo(
    () =>
      vehicles.flatMap((vehicle) => {
        const position = resolveVehiclePosition(
          vehicle,
          warehouses,
          live.positions.get(vehicle.id),
          false,
          now,
        );
        // Never present an estimated warehouse position as a vehicle's actual location.
        if (position.signal === "none") return [];
        const points = liveRoutePoints(vehicle, warehouses, position);
        return [
          {
            vehicle,
            position,
            destination: points.at(-1),
            route: routes.byVehicle.get(vehicle.id),
          },
        ];
      }),
    [vehicles, warehouses, live.positions, now, routes.byVehicle],
  );

  const allPoints = useMemo(
    () =>
      entries.flatMap((entry) => [
        entry.position.coordinates,
        ...(entry.destination ? [entry.destination] : []),
      ]),
    [entries],
  );

  const focusedEntry = entries.find((e) => e.vehicle.id === focusedVehicleId);
  const loading = fleet.isPending && !fleet.data;
  const hasStale = entries.some((entry) => entry.position.signal === "stale");
  const missingGpsCount = Math.max(0, vehicles.length - entries.length);

  const statusText = fleet.isError
    ? "Vehicles unavailable"
    : live.isError
      ? "GPS unavailable"
      : !entries.length
        ? "Waiting for GPS"
        : `${entries.length} on GPS${hasStale ? " · stale" : ""}${
            missingGpsCount > 0 ? ` · ${missingGpsCount} offline` : ""
          }`;

  function handleSelectVehicle(vehicleId: string) {
    if (focusedVehicleId === vehicleId) {
      setFocusedVehicleId(null);
      setFitTrigger((n) => n + 1);
    } else {
      setFocusedVehicleId(vehicleId);
    }
  }

  return (
    <div
      className="relative h-[460px] w-full min-w-0 overflow-hidden bg-muted/25 xl:h-[540px]"
      aria-label="Live fleet map"
      role="region"
    >
      {loading ? (
        <div
          role="status"
          aria-label="Loading fleet map"
          className="absolute inset-0 p-4"
        >
          <Skeleton className="h-full w-full rounded-lg motion-reduce:animate-none" />
        </div>
      ) : (
        <Map clean center={DEFAULT_MAP_CENTER} zoom={10}>
          <MapCameraController
            allPoints={allPoints}
            focusTarget={focusedEntry?.position.coordinates ?? null}
            fitTrigger={fitTrigger}
          />
          <MapControls position="bottom-right" showFullscreen />
          {entries.map(({ vehicle, position, destination, route }) => {
            const isSelected = focusedVehicleId === vehicle.id;
            return (
              <Fragment key={vehicle.id}>
                {route && (
                  <MapRoute
                    coordinates={route.coordinates}
                    color={vehicle.color}
                    width={isSelected ? 5 : 3.5}
                    opacity={focusedVehicleId && !isSelected ? 0.35 : 0.9}
                  />
                )}
                <MapMarker
                  longitude={position.coordinates[0]}
                  latitude={position.coordinates[1]}
                  tooltip={`${vehicle.plate} · ${vehicle.driver}${
                    position.signal === "stale" ? " (stale GPS)" : ""
                  }`}
                  onClick={() => handleSelectVehicle(vehicle.id)}
                >
                  <MarkerContent>
                    <div
                      aria-label={`Vehicle ${vehicle.plate}${
                        position.signal === "stale" ? ", GPS stale" : ""
                      }`}
                      className={`flex size-9 items-center justify-center rounded-full border-2 border-background text-white shadow-sm transition-transform ${
                        isSelected ? "scale-110 ring-2 ring-foreground/40" : ""
                      }`}
                      style={{ backgroundColor: vehicle.color }}
                    >
                      <Truck className="size-4" />
                    </div>
                  </MarkerContent>
                </MapMarker>
                {destination && (
                  <MapMarker
                    longitude={destination[0]}
                    latitude={destination[1]}
                    tooltip={`${vehicle.plate} · ${
                      vehicle.status === "returning"
                        ? "Warehouse return"
                        : vehicle.pickups?.some(
                              (task) => task.status === "assigned",
                            )
                          ? "Return pickup"
                          : "Destination"
                    }`}
                  >
                    <MarkerContent>
                      <div
                        aria-label={`Destination for ${vehicle.plate}`}
                        className="rounded-full border-2 border-background bg-background p-1 shadow-sm"
                        style={{ color: vehicle.color }}
                      >
                        <MapPin className="size-4" />
                      </div>
                    </MarkerContent>
                  </MapMarker>
                )}
              </Fragment>
            );
          })}
        </Map>
      )}

      {/* Floating top controls — no card header */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {!loading && (
            <div
              role="status"
              className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border bg-background/92 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-md"
            >
              <span className="tabular-nums">{statusText}</span>
              {(fleet.isError || live.isError) && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-5 px-1.5 text-xs"
                  onClick={() => {
                    void fleet.refetch();
                    void live.refetch();
                  }}
                >
                  Retry
                </Button>
              )}
            </div>
          )}

          {!loading && focusedVehicleId && (
            <button
              type="button"
              onClick={() => {
                setFocusedVehicleId(null);
                setFitTrigger((n) => n + 1);
              }}
              className="pointer-events-auto rounded-lg border bg-background/92 px-2.5 py-1.5 text-xs font-medium shadow-xs backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              Show all
            </button>
          )}

          {!loading &&
            entries.slice(0, 5).map(({ vehicle, position }) => {
              const active = focusedVehicleId === vehicle.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectVehicle(vehicle.id)}
                  className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-xs backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "bg-background/92 text-foreground hover:bg-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: vehicle.color }}
                  />
                  <span>{vehicle.plate}</span>
                  {position.signal === "stale" && (
                    <span className="text-[10px] opacity-70">stale</span>
                  )}
                </button>
              );
            })}
        </div>

        <Link
          href="/panel/fleet-map"
          className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-lg border bg-background/92 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span>Fleet map</span>
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>

      {/* Route loading / error overlay */}
      {(routes.isPending || routes.isError) && (
        <div
          role="status"
          className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border bg-background/92 px-3 py-1.5 text-xs text-muted-foreground shadow-xs backdrop-blur-md"
        >
          <span>
            {routes.isError
              ? "Some routes unavailable."
              : "Loading routes..."}
          </span>
          {routes.isError && (
            <Button size="xs" variant="ghost" onClick={routes.retry}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
