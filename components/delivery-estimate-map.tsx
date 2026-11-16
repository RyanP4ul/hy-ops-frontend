"use client";

import { useEffect } from "react";
import { Map, MapControls, MapRoute, useMap } from "@/components/ui/map";

function RouteLine({ coordinates }: { coordinates: [number, number][] }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map || !coordinates.length) return;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (const [lng, lat] of coordinates) {
      west = Math.min(west, lng); east = Math.max(east, lng);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
    map.fitBounds([[west, south], [east, north]], { padding: 40, maxZoom: 16 });
  }, [map, coordinates]);
  return <MapRoute coordinates={coordinates} />;
}

export function DeliveryEstimateMap({ coordinates }: { coordinates: [number, number][] }) {
  return <div aria-label="Estimated delivery route" className="h-72 overflow-hidden rounded-lg border">
    <Map center={coordinates[0]} zoom={11}>
      <RouteLine coordinates={coordinates} />
      <MapControls showZoom />
    </Map>
  </div>;
}

