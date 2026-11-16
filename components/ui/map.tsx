"use client";

/* Google Maps objects are mutable external SDK instances, created/disposed in
 * effects. State publishes those instances to their React portal children. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */

import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Locate, Maximize, Minus, Navigation, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { GoogleMapController, loadGoogleMaps, onGoogleMapsError, toLatLng, type Coordinate } from "@/lib/google-maps";

type Theme = "light" | "dark";
type MapRef = GoogleMapController;
type MapViewport = { center: Coordinate; zoom: number; bearing: number; pitch: number };
type MapProps = {
  children?: ReactNode; className?: string; theme?: Theme; center?: Coordinate;
  zoom?: number; bearing?: number; pitch?: number; minZoom?: number; maxZoom?: number;
  interactive?: boolean; viewport?: Partial<MapViewport>;
  onViewportChange?: (viewport: MapViewport) => void; loading?: boolean;
};
const MapContext = createContext<{ map: MapRef | null; isLoaded: boolean; resolvedTheme: Theme } | null>(null);
function useMap() {
  const value = useContext(MapContext);
  if (!value) throw new Error("useMap must be used within a Map component");
  return value;
}
function getViewport(map: MapRef): MapViewport {
  const center = map.getCenter();
  return { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

const Map = forwardRef<MapRef, MapProps>(function Map({ children, className, theme, viewport, onViewportChange, loading, ...options }, ref) {
  const { resolvedTheme: appTheme } = useTheme();
  const resolvedTheme: Theme = theme ?? (appTheme === "dark" ? "dark" : "light");
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapRef | null>(null);
  const [isLoaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const initial = useRef({ ...options, ...viewport });
  const camera = useRef<Partial<MapViewport>>(viewport ?? options);
  const callback = useRef(onViewportChange);
  useEffect(() => { callback.current = onViewportChange; }, [onViewportChange]);
  useImperativeHandle(ref, () => map!, [map]);
  useEffect(() => onGoogleMapsError(setError), []);

  useEffect(() => {
    let disposed = false;
    let controller: MapRef | undefined;
    const target = container.current;
    setError(null);
    setLoaded(false);
    loadGoogleMaps().then(maps => {
      if (disposed || !target) return;
      const props = { ...initial.current, ...camera.current };
      const native = new maps.Map(target, {
        center: toLatLng(props.center ?? [120.9842, 14.5995]), zoom: props.zoom ?? 11,
        heading: props.bearing ?? 0, tilt: props.pitch ?? 0,
        minZoom: props.minZoom, maxZoom: props.maxZoom,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID",
        renderingType: maps.RenderingType.VECTOR,
        colorScheme: resolvedTheme === "dark" ? maps.ColorScheme.DARK : maps.ColorScheme.LIGHT,
        disableDefaultUI: true, clickableIcons: false,
        gestureHandling: props.interactive === false ? "none" : "greedy",
        keyboardShortcuts: props.interactive !== false,
        headingInteractionEnabled: true, tiltInteractionEnabled: true,
      });
      controller = new GoogleMapController(native);
      controller.on("move", () => {
        camera.current = getViewport(controller!);
        callback.current?.(getViewport(controller!));
      });
      setMap(controller);
      setLoaded(true);
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : "Google Maps could not load."); });
    return () => {
      disposed = true;
      controller?.destroy();
      setMap(null);
      target?.replaceChildren();
    };
  }, [attempt, resolvedTheme]); // Google colorScheme is fixed at construction.

  const syncing = useRef(false);
  useEffect(() => {
    if (!map || !viewport || syncing.current) return;
    const current = getViewport(map);
    const next = { ...current, ...viewport };
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    syncing.current = true;
    map.jumpTo(next);
    syncing.current = false;
  }, [map, viewport]);

  return <MapContext.Provider value={{ map, isLoaded, resolvedTheme }}>
    <div className={cn("relative h-full w-full", className)} data-map-provider="google">
      <div ref={container} className="absolute inset-0" aria-label="Google Map" />
      {!error && (!isLoaded || loading) && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-background/70 text-sm">Loading Google Maps…</div>}
      {error && <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center text-sm">
        <p>{error}</p><p>You can still enter the address and coordinates manually.</p>
        <button type="button" className="rounded-md border px-3 py-2" onClick={() => setAttempt(value => value + 1)}>Retry map</button>
      </div>}
      {map && children}
    </div>
  </MapContext.Provider>;
});

type MapMarkerProps = {
  longitude: number; latitude: number; children: ReactNode;
  draggable?: boolean; anchor?: "center" | "bottom" | "top"; offset?: [number, number];
  rotation?: number; rotationAlignment?: "map" | "viewport" | "auto"; pitchAlignment?: "map" | "viewport" | "auto";
  onClick?: (event: MouseEvent) => void; onMouseEnter?: (event: MouseEvent) => void; onMouseLeave?: (event: MouseEvent) => void;
  onDragStart?: (position: { lng: number; lat: number }) => void;
  onDrag?: (position: { lng: number; lat: number }) => void;
  onDragEnd?: (position: { lng: number; lat: number }) => void;
};
type MarkerValue = { marker: google.maps.marker.AdvancedMarkerElement; element: HTMLDivElement };
const MarkerContext = createContext<MarkerValue | null>(null);
function useMarker() {
  const value = useContext(MarkerContext);
  if (!value) throw new Error("Marker components must be used within MapMarker");
  return value;
}
function MapMarker(props: MapMarkerProps) {
  const { map } = useMap();
  const [value, setValue] = useState<MarkerValue | null>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    if (!map) return;
    const element = document.createElement("div");
    element.className = "relative";
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: map.native, position: { lng: latest.current.longitude, lat: latest.current.latitude },
      gmpDraggable: latest.current.draggable ?? false, anchorLeft: "-50%", anchorTop: "-50%",
    });
    marker.append(element);
    const click = (event: MouseEvent) => { event.stopPropagation(); latest.current.onClick?.(event); };
    const enter = (event: MouseEvent) => latest.current.onMouseEnter?.(event);
    const leave = (event: MouseEvent) => latest.current.onMouseLeave?.(event);
    element.addEventListener("click", click); element.addEventListener("mouseenter", enter); element.addEventListener("mouseleave", leave);
    const dragEvents = (["dragstart", "drag", "dragend"] as const).map(name => marker.addListener(name, (event: google.maps.MapMouseEvent) => {
      const position = event.latLng?.toJSON();
      if (position) latest.current[name === "dragstart" ? "onDragStart" : name === "drag" ? "onDrag" : "onDragEnd"]?.(position);
    }));
    setValue({ marker, element });
    return () => {
      dragEvents.forEach(handle => handle.remove());
      element.removeEventListener("click", click); element.removeEventListener("mouseenter", enter); element.removeEventListener("mouseleave", leave);
      marker.map = null; marker.remove();
    };
  }, [map]);
  useEffect(() => {
    if (!value) return;
    value.marker.position = { lng: props.longitude, lat: props.latitude };
    value.marker.gmpDraggable = props.draggable ?? false;
    value.marker.anchorTop = props.anchor === "bottom" ? "-100%" : props.anchor === "top" ? "0%" : "-50%";
    value.element.style.translate = `${props.offset?.[0] ?? 0}px ${props.offset?.[1] ?? 0}px`;
    value.element.style.rotate = `${props.rotation ?? 0}deg`;
  }, [value, props.longitude, props.latitude, props.draggable, props.anchor, props.offset, props.rotation]);
  return value ? <MarkerContext.Provider value={value}>{createPortal(props.children, value.element)}</MarkerContext.Provider> : null;
}
type MarkerContentProps = { children?: ReactNode; className?: string };
function MarkerContent({ children, className }: MarkerContentProps) {
  return <div className={cn("relative cursor-pointer", className)}>{children ?? <div className="size-4 rounded-full border-2 border-white bg-blue-500 shadow" />}</div>;
}
type MarkerPopupProps = { children: ReactNode; className?: string; closeButton?: boolean; maxWidth?: string; offset?: number };
function MarkerPopup({ children, className, maxWidth, offset = 16 }: MarkerPopupProps) {
  const { map } = useMap();
  const { marker, element } = useMarker();
  const content = useMemo(() => document.createElement("div"), []);
  useEffect(() => {
    if (!map) return;
    const popup = new google.maps.InfoWindow({ content, maxWidth: maxWidth ? parseInt(maxWidth) : 360, pixelOffset: new google.maps.Size(0, -offset) });
    const open = () => popup.open({ map: map.native, anchor: marker, shouldFocus: false });
    element.addEventListener("click", open);
    return () => { element.removeEventListener("click", open); popup.close(); };
  }, [map, marker, element, content, maxWidth, offset]);
  return createPortal(<div className={cn("bg-popover text-popover-foreground p-2 text-sm", className)}>{children}</div>, content);
}
type MarkerTooltipProps = { children: ReactNode; className?: string; offset?: number; maxWidth?: string };
function MarkerTooltip({ children, className }: MarkerTooltipProps) {
  const { element } = useMarker();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    element.addEventListener("mouseenter", show); element.addEventListener("mouseleave", hide);
    element.addEventListener("focusin", show); element.addEventListener("focusout", hide);
    return () => {
      element.removeEventListener("mouseenter", show); element.removeEventListener("mouseleave", hide);
      element.removeEventListener("focusin", show); element.removeEventListener("focusout", hide);
    };
  }, [element]);
  return visible ? <div role="tooltip" className={cn("pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md", className)}>{children}</div> : null;
}
type MarkerLabelProps = { children: ReactNode; className?: string; position?: "top" | "bottom" };
function MarkerLabel({ children, className, position = "top" }: MarkerLabelProps) {
  return <div className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-foreground", position === "top" ? "bottom-full mb-1" : "top-full mt-1", className)}>{children}</div>;
}

type MapControlsProps = {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  showZoom?: boolean; showCompass?: boolean; showLocate?: boolean; showFullscreen?: boolean;
  className?: string; onLocate?: (coords: { longitude: number; latitude: number }) => void;
};
function MapControls({ position = "bottom-right", showZoom = true, showCompass, showLocate, showFullscreen, className, onLocate }: MapControlsProps) {
  const { map } = useMap();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState({ bearing: 0, pitch: 0 });
  useEffect(() => {
    if (!map) return;
    const sync = () => setOrientation({ bearing: map.getBearing(), pitch: map.getPitch() });
    sync(); map.on("rotate", sync); map.on("pitch", sync);
    return () => { map.off("rotate", sync); map.off("pitch", sync); };
  }, [map]);
  const positions = { "top-left": "top-2 left-2", "top-right": "top-2 right-2", "bottom-left": "bottom-10 left-2", "bottom-right": "bottom-10 right-2" };
  const locate = () => {
    if (!navigator.geolocation) { setLocationError("Location is unavailable in this browser."); return; }
    setLocating(true); setLocationError(null);
    navigator.geolocation.getCurrentPosition(position => {
      const coords = { longitude: position.coords.longitude, latitude: position.coords.latitude };
      map?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 14 });
      onLocate?.(coords); setLocating(false);
    }, () => { setLocating(false); setLocationError("Unable to locate you. Check browser location permissions."); }, { timeout: 10000 });
  };
  const buttonClass = "grid size-8 place-items-center bg-background text-foreground hover:bg-accent disabled:opacity-50";
  return <div className={cn("absolute z-10 flex flex-col gap-1", positions[position], className)}>
    <div className="overflow-hidden rounded-md border shadow-sm [&>button+button]:border-t">
      {showZoom && <><button type="button" className={buttonClass} aria-label="Zoom in" onClick={() => map?.zoomTo(map.getZoom() + 1)}><Plus className="size-4" /></button><button type="button" className={buttonClass} aria-label="Zoom out" onClick={() => map?.zoomTo(map.getZoom() - 1)}><Minus className="size-4" /></button></>}
      {showCompass && <button type="button" className={buttonClass} aria-label="Reset bearing to north" onClick={() => map?.resetNorthPitch()}><Navigation className="size-4" style={{ transform: `rotateX(${orientation.pitch}deg) rotateZ(${-orientation.bearing}deg)` }} /></button>}
      {showLocate && <button type="button" className={buttonClass} aria-label="Find my location" disabled={locating} onClick={locate}><Locate className="size-4" /></button>}
      {showFullscreen && <button type="button" className={buttonClass} aria-label="Toggle fullscreen" onClick={() => {
        const container = map?.getContainer().parentElement;
        if (document.fullscreenElement) void document.exitFullscreen();
        else if (container?.requestFullscreen) void container.requestFullscreen();
      }}><Maximize className="size-4" /></button>}
    </div>
    {locationError && <p role="status" className="max-w-48 rounded border bg-background p-2 text-xs">{locationError}</p>}
  </div>;
}

type MapRouteProps = {
  id?: string; coordinates: Coordinate[]; color?: string; width?: number; opacity?: number;
  dashArray?: [number, number]; active?: boolean; activeColor?: string; activeWidth?: number;
  activeOpacity?: number; activeDashArray?: [number, number]; interactive?: boolean;
  onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void;
};
function MapRoute({ coordinates, color = "#3b82f6", width = 3, opacity = 0.8, dashArray, active, activeColor, activeWidth, activeOpacity, activeDashArray, interactive = true, onClick, onMouseEnter, onMouseLeave }: MapRouteProps) {
  const { map } = useMap();
  const [line, setLine] = useState<google.maps.Polyline | null>(null);
  useEffect(() => {
    if (!map) return;
    const polyline = new google.maps.Polyline({ map: map.native });
    setLine(polyline);
    return () => { google.maps.event.clearInstanceListeners(polyline); polyline.setMap(null); };
  }, [map]);
  useEffect(() => {
    if (!line) return;
    const strokeColor = active ? activeColor ?? color : color;
    const strokeWeight = active ? activeWidth ?? width : width;
    const strokeOpacity = active ? activeOpacity ?? opacity : opacity;
    const dash = active ? activeDashArray ?? dashArray : dashArray;
    line.setOptions({
      path: coordinates.map(toLatLng), strokeColor, strokeWeight,
      strokeOpacity: dash ? 0 : strokeOpacity, clickable: interactive, zIndex: active ? 2 : 1,
      icons: dash ? [{ icon: { path: `M 0,0 0,${dash[0]}`, strokeColor, strokeWeight, strokeOpacity, scale: 1 }, offset: "0", repeat: `${dash[0] + dash[1]}px` }] : [],
    });
  }, [line, coordinates, color, width, opacity, dashArray, active, activeColor, activeWidth, activeOpacity, activeDashArray, interactive]);
  useEffect(() => {
    if (!line || !interactive) return;
    const listeners = [line.addListener("click", () => onClick?.()), line.addListener("mouseover", () => onMouseEnter?.()), line.addListener("mouseout", () => onMouseLeave?.())];
    return () => listeners.forEach(listener => listener.remove());
  }, [line, interactive, onClick, onMouseEnter, onMouseLeave]);
  return null;
}

export { Map, useMap, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MarkerLabel, MapControls, MapRoute };
export type { MapRef, MapViewport, MapProps, MapMarkerProps, MarkerContentProps, MarkerPopupProps, MarkerTooltipProps, MarkerLabelProps, MapControlsProps, MapRouteProps };
