"use client";

import { useEffect, useMemo } from "react";
import { Warehouse } from "lucide-react";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [120.9842, 14.5995];

export type RouteMapStop = {
  id: string | number;
  coordinates: [number, number];
  label: string;
  kind: "warehouse" | "stop";
  index?: number;
};

function RouteViewport({
  points,
}: {
  points: [number, number][];
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !points.length) return;
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 13, duration: 0 });
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
      { padding: 44, maxZoom: 15 },
    );
  }, [map, points]);

  return null;
}

export function DeliveryEstimateMap({
  coordinates = [],
  stops = [],
  isRoundTrip = false,
  clean = true,
  className,
}: {
  coordinates?: [number, number][];
  stops?: RouteMapStop[];
  isRoundTrip?: boolean;
  clean?: boolean;
  className?: string;
}) {
  const previewPath = useMemo<[number, number][]>(() => {
    if (coordinates.length >= 2 || stops.length < 2) return [];
    const base = stops.map((stop) => stop.coordinates);
    if (isRoundTrip && stops[0]?.kind === "warehouse") {
      return [...base, stops[0].coordinates];
    }
    return base;
  }, [coordinates.length, stops, isRoundTrip]);

  const fitPoints = useMemo<[number, number][]>(() => {
    const all: [number, number][] = [];
    for (const coord of coordinates) all.push(coord);
    for (const stop of stops) all.push(stop.coordinates);
    return all;
  }, [coordinates, stops]);

  const initialCenter = coordinates[0] ?? stops[0]?.coordinates ?? DEFAULT_CENTER;

  return (
    <div
      role="region"
      aria-label="Estimated delivery route"
      className={cn(
        "relative h-72 w-full overflow-hidden rounded-lg border bg-muted/30",
        className,
      )}
    >
      <Map clean={clean} center={initialCenter} zoom={11}>
        <RouteViewport points={fitPoints} />
        {coordinates.length >= 2 ? (
          <MapRoute
            coordinates={coordinates}
            color="#2563eb"
            width={4}
            opacity={0.92}
            interactive={false}
          />
        ) : previewPath.length >= 2 ? (
          <MapRoute
            coordinates={previewPath}
            color="#64748b"
            width={2.5}
            opacity={0.65}
            dashArray={[6, 6]}
            interactive={false}
          />
        ) : null}

        {stops.map((stop) => (
          <MapMarker
            key={`${stop.kind}-${stop.id}`}
            longitude={stop.coordinates[0]}
            latitude={stop.coordinates[1]}
          >
            <MarkerContent>
              {stop.kind === "warehouse" ? (
                <div
                  role="img"
                  aria-label={`Warehouse: ${stop.label}`}
                  className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-foreground text-background shadow-md"
                >
                  <Warehouse className="size-3.5" aria-hidden="true" />
                </div>
              ) : (
                <div
                  role="img"
                  aria-label={`Stop ${stop.index}: ${stop.label}`}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-blue-600 text-[11px] font-semibold text-white shadow-md"
                >
                  {stop.index}
                </div>
              )}
            </MarkerContent>
            <MarkerTooltip>{stop.label}</MarkerTooltip>
          </MapMarker>
        ))}

        <MapControls showZoom position="bottom-right" />
      </Map>
    </div>
  );
}
