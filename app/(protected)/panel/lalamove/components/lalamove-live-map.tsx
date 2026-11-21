"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Crosshair,
  Loader2,
  Maximize2,
  Navigation,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";
import { api } from "../lib/api";
import type {
  Booking,
  DriverCoordinates,
  PickupWarehouse,
} from "../types";
import { dateLabel } from "./shared";

const DEFAULT_CENTER: [number, number] = [120.9842, 14.5995];

function parseLngLat(
  lat?: string | number | null,
  lng?: string | number | null,
): [number, number] | null {
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (
    !Number.isFinite(la) ||
    !Number.isFinite(ln) ||
    (la === 0 && ln === 0) ||
    la < -90 ||
    la > 90 ||
    ln < -180 ||
    ln > 180
  ) {
    return null;
  }
  return [ln, la];
}

function MapViewportController({
  points,
  focusTarget,
  focusNonce,
}: {
  points: [number, number][];
  focusTarget: [number, number] | null;
  focusNonce: number;
}) {
  const { map } = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!map || !points.length) return;
    if (initialized.current && focusNonce === 0) return;
    if (focusTarget && focusNonce > 0) {
      map.flyTo({ center: focusTarget, zoom: 15, duration: 500 });
      return;
    }
    initialized.current = true;
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 14, duration: 0 });
      return;
    }
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const [lng, lat] of points) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 52, maxZoom: 15 },
    );
  }, [map, points, focusTarget, focusNonce]);

  return null;
}

export function LalamoveLiveMap({
  booking,
  warehouse,
  fallbackDropoff,
}: {
  booking: Booking;
  warehouse?: PickupWarehouse | null;
  fallbackDropoff?: {
    orderNumber: string;
    recipient: string | null;
    address: string | null;
    lat?: string | number | null;
    lng?: string | number | null;
  };
}) {
  const client = useQueryClient();
  const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const canPollDriver =
    booking.active &&
    Boolean(booking.lalamove_order_id) &&
    ["ON_GOING", "PICKED_UP"].includes(booking.status);

  const liveDriverQuery = useQuery({
    queryKey: ["lalamove", "driver-location", booking.id],
    queryFn: () =>
      api<{
        booking_id: number;
        status: string;
        driver_details: Booking["driver_details"];
        driver_coordinates: DriverCoordinates | null;
        last_synced_at: string | null;
      }>("POST", `/orders/${booking.id}/driver-location`),
    enabled: canPollDriver,
    refetchInterval: canPollDriver ? 15_000 : false,
    staleTime: 10_000,
  });

  const driverCoords = useMemo<DriverCoordinates | null>(() => {
    if (liveDriverQuery.data?.driver_coordinates) {
      return liveDriverQuery.data.driver_coordinates;
    }
    if (booking.driver_coordinates) return booking.driver_coordinates;
    const raw = booking.driver_details?.coordinates;
    const parsed = parseLngLat(raw?.lat, raw?.lng);
    if (!parsed) return null;
    return {
      lat: parsed[1],
      lng: parsed[0],
      updated_at: raw?.updatedAt ?? null,
    };
  }, [liveDriverQuery.data, booking.driver_coordinates, booking.driver_details]);

  const driverPoint = useMemo<[number, number] | null>(
    () => (driverCoords ? [driverCoords.lng, driverCoords.lat] : null),
    [driverCoords],
  );

  const driverInfo =
    liveDriverQuery.data?.driver_details ?? booking.driver_details;

  const pickupPoint = useMemo(
    () => parseLngLat(warehouse?.latitude, warehouse?.longitude),
    [warehouse?.latitude, warehouse?.longitude],
  );

  const stopMarkers = useMemo(() => {
    if (booking.stops && booking.stops.length > 0) {
      return booking.stops
        .map((stop) => {
          const point = parseLngLat(stop.dropoff_lat, stop.dropoff_lng);
          if (!point) return null;
          const delivered =
            Boolean(stop.delivered_at) ||
            stop.pod_status === "DELIVERED" ||
            stop.pod_status === "SIGNED" ||
            stop.order_status === "COMPLETED";
          return {
            id: stop.id,
            index: stop.stop_index,
            orderNumber: stop.order_number,
            recipient: stop.recipient_name,
            address: stop.dropoff_address,
            delivered,
            coordinates: point,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    if (fallbackDropoff) {
      const point = parseLngLat(fallbackDropoff.lat, fallbackDropoff.lng);
      if (point) {
        return [
          {
            id: booking.order_id,
            index: 1,
            orderNumber: fallbackDropoff.orderNumber,
            recipient: fallbackDropoff.recipient || booking.recipient_name || "Recipient",
            address: fallbackDropoff.address || booking.dropoff_address || "",
            delivered: booking.status === "COMPLETED" || Boolean(booking.completed_at),
            coordinates: point,
          },
        ];
      }
    }
    return [];
  }, [booking, fallbackDropoff]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (pickupPoint) pts.push(pickupPoint);
    for (const stop of stopMarkers) pts.push(stop.coordinates);
    if (driverPoint) pts.push(driverPoint);
    return pts;
  }, [pickupPoint, stopMarkers, driverPoint]);

  if (!allPoints.length) return null;

  const initialCenter = driverPoint ?? pickupPoint ?? stopMarkers[0]?.coordinates ?? DEFAULT_CENTER;
  const lastUpdated =
    driverCoords?.updated_at ??
    liveDriverQuery.data?.last_synced_at ??
    booking.last_synced_at;

  return (
    <section
      aria-label="Live Lalamove courier map"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">
            Live courier map
          </h2>
          {driverPoint ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-orange-600 motion-safe:animate-pulse"
              />
              Driver GPS live
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {canPollDriver
                ? "Waiting for driver GPS"
                : booking.status === "COMPLETED"
                  ? "Delivery completed"
                  : "Driver not assigned yet"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {driverPoint && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                setFocusTarget(driverPoint);
                setFocusNonce((n) => n + 1);
              }}
            >
              <Crosshair className="size-3" aria-hidden="true" />
              Locate driver
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              setFocusTarget(null);
              setFocusNonce((n) => n + 1);
            }}
          >
            <Maximize2 className="size-3" aria-hidden="true" />
            Fit route
          </Button>
          {canPollDriver && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={liveDriverQuery.isFetching}
              onClick={() => {
                void liveDriverQuery.refetch();
                void client.invalidateQueries({ queryKey: ["lalamove", "live"] });
              }}
            >
              {liveDriverQuery.isFetching ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-3" aria-hidden="true" />
              )}
              Refresh GPS
            </Button>
          )}
        </div>
      </div>

      <div className="relative h-72 w-full bg-muted/30 sm:h-80">
        <Map clean center={initialCenter} zoom={13}>
          <MapViewportController
            points={allPoints}
            focusTarget={focusTarget}
            focusNonce={focusNonce}
          />

          {/* Pickup warehouse marker */}
          {pickupPoint && (
            <MapMarker longitude={pickupPoint[0]} latitude={pickupPoint[1]}>
              <MarkerContent>
                <div
                  role="img"
                  aria-label={`Pickup: ${warehouse?.name || "Warehouse"}`}
                  className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-foreground text-background shadow-md"
                >
                  <Warehouse className="size-3.5" aria-hidden="true" />
                </div>
              </MarkerContent>
              <MarkerTooltip>
                <p className="font-semibold">
                  Pickup · {warehouse?.name || "Warehouse"}
                </p>
                {booking.pickup_address && (
                  <p className="text-[11px] text-muted-foreground">
                    {booking.pickup_address}
                  </p>
                )}
              </MarkerTooltip>
            </MapMarker>
          )}

          {/* Drop-off stop markers */}
          {stopMarkers.map((stop) => (
            <MapMarker
              key={`stop-${stop.id}`}
              longitude={stop.coordinates[0]}
              latitude={stop.coordinates[1]}
            >
              <MarkerContent>
                <div
                  role="img"
                  aria-label={`Stop ${stop.index}: ${stop.orderNumber}${stop.delivered ? " (delivered)" : ""}`}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-white shadow-md",
                    stop.delivered ? "bg-emerald-600" : "bg-blue-600",
                  )}
                >
                  {stop.delivered ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    stop.index
                  )}
                </div>
              </MarkerContent>
              <MarkerTooltip>
                <p className="font-semibold">
                  Stop #{stop.index} · {stop.orderNumber}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {stop.recipient}
                </p>
              </MarkerTooltip>
            </MapMarker>
          ))}

          {/* Live Lalamove driver pin */}
          {driverPoint && (
            <MapMarker longitude={driverPoint[0]} latitude={driverPoint[1]}>
              <MarkerContent>
                <div
                  role="img"
                  aria-label={`Lalamove driver ${driverInfo?.name || "location"}`}
                  className="relative flex size-9 items-center justify-center"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-orange-500/35 motion-safe:animate-ping"
                  />
                  <span className="relative flex size-8 items-center justify-center rounded-full border-2 border-white bg-orange-600 text-white shadow-lg">
                    <Navigation className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </MarkerContent>
              <MarkerTooltip>
                <p className="font-semibold">
                  Lalamove · {driverInfo?.name || "Courier"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {driverInfo?.plateNumber
                    ? `${driverInfo.plateNumber} · `
                    : ""}
                  {driverCoords
                    ? `${driverCoords.lat.toFixed(5)}, ${driverCoords.lng.toFixed(5)}`
                    : ""}
                </p>
              </MarkerTooltip>
            </MapMarker>
          )}

          <MapControls showZoom position="bottom-right" />
        </Map>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground">
        <span>
          {driverPoint
            ? `GPS: ${driverCoords!.lat.toFixed(5)}, ${driverCoords!.lng.toFixed(5)}`
            : "Lalamove shares live driver coordinates once a driver is en route until completion."}
        </span>
        {lastUpdated && (
          <span className="tabular-nums">
            Updated {dateLabel(lastUpdated)}
          </span>
        )}
      </div>
    </section>
  );
}
