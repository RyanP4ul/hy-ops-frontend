"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMap } from "@/components/ui/map";

/** HTML overlay marker for locally styled Google Maps (which cannot use a map ID). */
export function MapMarker({
  longitude,
  latitude,
  tooltip,
  onClick,
  children,
}: {
  longitude: number;
  latitude: number;
  tooltip: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { map } = useMap();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const position = useRef({ lng: longitude, lat: latitude });
  const overlay = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;
    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;transform:translate(-50%,-50%);";
    const marker = new google.maps.OverlayView();
    marker.onAdd = () => {
      marker.getPanes()?.overlayMouseTarget.append(container);
    };
    marker.draw = () => {
      const point = marker
        .getProjection()
        .fromLatLngToDivPixel(position.current);
      if (!point) return;
      container.style.left = `${point.x}px`;
      container.style.top = `${point.y}px`;
    };
    marker.onRemove = () => container.remove();
    google.maps.OverlayView.preventMapHitsAndGesturesFrom(container);
    marker.setMap(map.native);
    overlay.current = marker;
    // Publish the SDK-owned container to the React portal.
    setElement(container);
    return () => {
      overlay.current = null;
      marker.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    position.current = { lng: longitude, lat: latitude };
    if (overlay.current?.getPanes()) overlay.current.draw();
  }, [longitude, latitude]);

  if (!element) return null;

  return createPortal(
    <div
      role={onClick ? "button" : undefined}
      tabIndex={0}
      aria-label={tooltip}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative w-max cursor-pointer focus-visible:outline-none"
    >
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-md group-hover:block group-focus-visible:block"
      >
        {tooltip}
      </div>
    </div>,
    element,
  );
}
