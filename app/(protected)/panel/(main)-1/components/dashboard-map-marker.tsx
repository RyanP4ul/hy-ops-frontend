"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMap } from "@/components/ui/map";

/** HTML markers for the locally styled map, which cannot use a map ID. */
export function DashboardMapMarker({ longitude, latitude, tooltip, children }: {
  longitude: number; latitude: number; tooltip: string; children: ReactNode;
}) {
  const { map } = useMap();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const position = useRef({ lng: longitude, lat: latitude });
  const overlay = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;transform:translate(-50%,-50%);";
    const marker = new google.maps.OverlayView();
    marker.onAdd = () => { marker.getPanes()?.overlayMouseTarget.append(container); };
    marker.draw = () => {
      const point = marker.getProjection().fromLatLngToDivPixel(position.current);
      if (!point) return;
      container.style.left = `${point.x}px`;
      container.style.top = `${point.y}px`;
    };
    marker.onRemove = () => container.remove();
    google.maps.OverlayView.preventMapHitsAndGesturesFrom(container);
    marker.setMap(map.native);
    overlay.current = marker;
    // Publish the SDK-owned container to the React portal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElement(container);
    return () => { overlay.current = null; marker.setMap(null); };
  }, [map]);

  useEffect(() => {
    position.current = { lng: longitude, lat: latitude };
    if (overlay.current?.getPanes()) overlay.current.draw();
  }, [longitude, latitude]);

  return element ? createPortal(<div tabIndex={0} aria-label={tooltip} className="group relative w-max">
    {children}
    <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md group-hover:block group-focus:block">{tooltip}</div>
  </div>, element) : null;
}
