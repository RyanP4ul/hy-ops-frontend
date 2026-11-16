let mapsPromise: Promise<typeof google.maps> | undefined;
const errorListeners = new Set<(message: string) => void>();

declare global {
  interface Window { __hyopsGoogleMapsReady?: () => void; gm_authFailure?: () => void; }
}

export function onGoogleMapsError(listener: (message: string) => void) {
  errorListeners.add(listener);
  return () => { errorListeners.delete(listener); };
}

/** Share one SDK load across pages, dialogs, and concurrent maps. */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof google !== "undefined" && google.maps?.Map && google.maps?.marker) return Promise.resolve(google.maps);
  if (mapsPromise) return mapsPromise;
  window.gm_authFailure = () => {
    errorListeners.forEach(listener => listener("Google Maps authorization failed. Check the API key, enabled Maps JavaScript API, billing, and website restrictions."));
  };
  mapsPromise = new Promise<typeof google.maps>((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!key) { reject(new Error("Google Maps is not configured. Set GOOGLE_MAP_API_KEY in the frontend .env and restart the server.")); return; }
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete window.__hyopsGoogleMapsReady;
      reject(new Error("Google Maps could not load. Check your connection and Maps JavaScript API configuration."));
    };
    const timeout = window.setTimeout(fail, 20000);
    window.__hyopsGoogleMapsReady = () => {
      window.clearTimeout(timeout);
      delete window.__hyopsGoogleMapsReady;
      resolve(google.maps);
    };
    const params = new URLSearchParams({ key, v: "quarterly", loading: "async", libraries: "marker", callback: "__hyopsGoogleMapsReady" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => { mapsPromise = undefined; throw error; });
  return mapsPromise;
}

export type Coordinate = [number, number];
export type CameraOptions = {
  center?: Coordinate; zoom?: number; bearing?: number; pitch?: number;
  duration?: number; essential?: boolean; offset?: [number, number];
  padding?: number | google.maps.Padding;
};
export type MapEvent = { lngLat: { lng: number; lat: number }; originalEvent?: unknown };
type MapHandler = (event: MapEvent) => void;
export const toLatLng = ([lng, lat]: Coordinate): google.maps.LatLngLiteral => ({ lng, lat });

/** Keep existing longitude/latitude and camera calls while Google renders the map. */
export class GoogleMapController {
  private listeners = new globalThis.Map<string, globalThis.Map<MapHandler, google.maps.MapsEventListener[]>>();
  constructor(public readonly native: google.maps.Map) {}
  getCenter() { return this.native.getCenter()?.toJSON() ?? { lng: 0, lat: 0 }; }
  getZoom() { return this.native.getZoom() ?? 0; }
  getBearing() { return this.native.getHeading() ?? 0; }
  getPitch() { return this.native.getTilt() ?? 0; }
  getContainer() { return this.native.getDiv(); }
  resize() { google.maps.event.trigger(this.native, "resize"); }
  easeTo(options: CameraOptions) {
    const camera: google.maps.CameraOptions = {};
    if (options.center) camera.center = toLatLng(options.center);
    if (options.zoom !== undefined) camera.zoom = options.zoom;
    if (options.bearing !== undefined) camera.heading = options.bearing;
    if (options.pitch !== undefined) camera.tilt = options.pitch;
    this.native.moveCamera(camera);
    if (options.padding && typeof options.padding !== "number") {
      const { left, right, top, bottom } = options.padding;
      this.native.panBy((right - left) / 2, (bottom - top) / 2);
    }
    if (options.offset) this.native.panBy(-options.offset[0], -options.offset[1]);
  }
  flyTo(options: CameraOptions) { this.easeTo(options); }
  jumpTo(options: CameraOptions) { this.easeTo(options); }
  zoomTo(zoom: number) { this.native.setZoom(zoom); }
  resetNorthPitch() { this.native.moveCamera({ heading: 0, tilt: 0 }); }
  fitBounds(bounds: [Coordinate, Coordinate], options: { padding?: number | google.maps.Padding; maxZoom?: number; duration?: number } = {}) {
    if (options.maxZoom !== undefined) {
      const maxZoom = options.maxZoom;
      google.maps.event.addListenerOnce(this.native, "idle", () => {
        if (this.getZoom() > maxZoom) this.native.setZoom(maxZoom);
      });
    }
    this.native.fitBounds(new google.maps.LatLngBounds(toLatLng(bounds[0]), toLatLng(bounds[1])), options.padding ?? 0);
  }
  on(name: string, handler: MapHandler) {
    this.off(name, handler);
    const names: Record<string, string[]> = { move: ["bounds_changed"], rotate: ["heading_changed"], pitch: ["tilt_changed"], movestart: ["dragstart"], zoom: ["zoom_changed"] };
    const handles = (names[name] ?? [name]).map(eventName => this.native.addListener(eventName, (event?: google.maps.MapMouseEvent) => {
      handler({ lngLat: event?.latLng?.toJSON() ?? this.getCenter(), originalEvent: name === "movestart" ? true : event?.domEvent });
    }));
    if (name === "movestart") {
      const wheel = (originalEvent: WheelEvent) => handler({ lngLat: this.getCenter(), originalEvent });
      this.getContainer().addEventListener("wheel", wheel, { passive: true });
      handles.push({ remove: () => this.getContainer().removeEventListener("wheel", wheel) });
    }
    if (!this.listeners.has(name)) this.listeners.set(name, new globalThis.Map());
    this.listeners.get(name)!.set(handler, handles);
    return this;
  }
  off(name: string, handler: MapHandler) {
    this.listeners.get(name)?.get(handler)?.forEach(handle => handle.remove());
    this.listeners.get(name)?.delete(handler);
    return this;
  }
  destroy() {
    this.listeners.forEach(handlers => handlers.forEach(handles => handles.forEach(handle => handle.remove())));
    this.listeners.clear();
    google.maps.event.clearInstanceListeners(this.native);
  }
}
