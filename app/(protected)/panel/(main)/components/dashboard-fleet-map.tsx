"use client";

import { Fragment, useEffect, useRef } from "react";
import { MapPin, Truck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent, MarkerTooltip, useMap } from "@/components/ui/map";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { fleetKeys, useFleetQuery } from "../../fleet-map/hooks/use-fleet-query";
import { useLivePositions } from "../../fleet-map/hooks/use-live-positions";
import { useNow } from "../../fleet-map/hooks/use-now";
import { useRoadRoutes } from "../../fleet-map/hooks/use-road-routes";
import { resolveVehiclePosition } from "../../fleet-map/lib/live";
import { liveRoutePoints } from "../../fleet-map/lib/live-route";
import { getBounds } from "../../fleet-map/lib/geometry";
import { DEFAULT_MAP_CENTER, EMPTY_WAREHOUSES, FLEET_POLL_MS } from "../../fleet-map/constants";
import type { Coordinates } from "../../fleet-map/types";

function InitialExtent({ points }: { points: Coordinates[] }) {
  const { map, isLoaded } = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    const bounds = getBounds(points);
    if (!map || !isLoaded || fitted.current || !bounds) return;
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    fitted.current = true;
  }, [map, isLoaded, points]);
  return null;
}

export default function DashboardFleetMap() {
  const fleet = useFleetQuery({ pollMs: FLEET_POLL_MS });
  const live = useLivePositions(true);
  const now = useNow();
  const cache = useQueryClient();
  const { subscribe } = useWebSocket();
  useEffect(() => subscribe(REQUESTS.DRIVER_LOCATION_UPDATE, () => {
    void cache.invalidateQueries({ queryKey: fleetKeys.positions });
  }), [cache, subscribe]);
  const vehicles = fleet.data?.vehicles ?? [];
  const warehouses = fleet.data?.warehouses ?? EMPTY_WAREHOUSES;
  const routes = useRoadRoutes(vehicles, warehouses, null, null, live.positions, false, now);
  const entries = vehicles.flatMap(vehicle => {
    const position = resolveVehiclePosition(vehicle, warehouses, live.positions.get(vehicle.id), false, now);
    // Never present an estimated warehouse position as a vehicle's actual location.
    if (position.signal === "none") return [];
    const points = liveRoutePoints(vehicle, warehouses, position);
    return [{ vehicle, position, destination: points.at(-1), route: routes.byVehicle.get(vehicle.id) }];
  });
  const points = entries.flatMap(entry => [entry.position.coordinates, ...(entry.destination ? [entry.destination] : [])]);
  const loading = fleet.isPending && !fleet.data;

  return <div className="relative h-[65svh] min-h-[420px] max-h-[800px] w-full overflow-hidden bg-muted/30 sm:min-h-[560px]" aria-label="Dashboard vehicle map" role="region">
    {loading ? <div role="status" aria-label="Loading dashboard vehicles" className="absolute inset-0 p-4"><Skeleton className="h-full w-full motion-reduce:animate-none" /></div> : <Map center={DEFAULT_MAP_CENTER} zoom={10}>
      <InitialExtent points={points} />
      <MapControls position="bottom-right" showFullscreen />
      {entries.map(({ vehicle, position, destination, route }) => <Fragment key={vehicle.id}>
        {route && <MapRoute coordinates={route.coordinates} color={vehicle.color} width={4} />}
        <MapMarker longitude={position.coordinates[0]} latitude={position.coordinates[1]}>
          <MarkerContent><div aria-label={`Vehicle ${vehicle.plate}${position.signal === "stale" ? ", GPS stale" : ""}`} className="flex size-10 items-center justify-center rounded-full border-2 border-background text-white shadow" style={{ backgroundColor: vehicle.color }}><Truck className="size-5" /></div></MarkerContent>
          <MarkerTooltip>{vehicle.plate} / {vehicle.driver}{position.signal === "stale" ? " / GPS stale" : " / Live GPS"}</MarkerTooltip>
        </MapMarker>
        {destination && <MapMarker longitude={destination[0]} latitude={destination[1]}>
          <MarkerContent><div aria-label={`Destination for ${vehicle.plate}`} className="rounded-full border-2 border-background bg-background p-1 shadow" style={{ color: vehicle.color }}><MapPin className="size-6" /></div></MarkerContent>
          <MarkerTooltip>{vehicle.plate} / {vehicle.status === "returning" ? "Warehouse return" : vehicle.pickups?.some(task => task.status === "assigned") ? "Return pickup destination" : "Customer destination"}</MarkerTooltip>
        </MapMarker>}
      </Fragment>)}
    </Map>}
    {!loading && <div role="status" className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-md bg-background/95 px-3 py-2 text-xs shadow-sm">
      {fleet.isError ? "Unable to refresh vehicles." : live.isError ? "Unable to refresh GPS." : !entries.length ? "Waiting for vehicle GPS." : `${entries.length} vehicles with GPS${entries.some(entry => entry.position.signal === "stale") ? " / Some GPS positions are stale" : ""}`}
      {vehicles.length > entries.length && entries.length > 0 && ` / ${vehicles.length - entries.length} without GPS`}
      {(fleet.isError || live.isError) && <Button size="sm" variant="ghost" onClick={() => { void fleet.refetch(); void live.refetch(); }}>Retry</Button>}
    </div>}
    {(routes.isPending || routes.isError) && <div role="status" className="absolute bottom-3 left-3 z-10 max-w-[75%] bg-background/95 px-3 py-2 text-xs shadow-sm">{routes.isError ? "Some road routes are unavailable." : "Loading road routes..."}{routes.isError && <Button size="sm" variant="ghost" onClick={routes.retry}>Retry</Button>}</div>}
  </div>;
}
