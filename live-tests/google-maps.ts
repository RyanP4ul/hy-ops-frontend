import type { Page } from "@playwright/test";

/** Deterministic SDK substitute. Live Google tiles and key authorization need a manual smoke test. */
export async function mockGoogleMaps(page: Page) {
  await page.route("https://maps.googleapis.com/maps/api/js?**", route => route.fulfill({
    contentType: "application/javascript",
    body: `(${installGoogleMapsFixture.toString()})();`,
  }));
}

function installGoogleMapsFixture() {
  type Position = { lng: number; lat: number };
  class Events {
    listeners = new globalThis.Map<string, Set<(event?: unknown) => void>>();
    addListener(name: string, callback: (event?: unknown) => void) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name)!.add(callback);
      return { remove: () => { this.listeners.get(name)?.delete(callback); } };
    }
    emit(name: string, event?: unknown) { this.listeners.get(name)?.forEach(callback => callback(event)); }
  }
  class Map extends Events {
    markers = new Set<AdvancedMarkerElement>();
    overlays = new Set<OverlayView>();
    center: Position; zoom: number; heading: number; tilt: number;
    constructor(public div: HTMLElement, options: { center: Position; zoom: number; heading: number; tilt: number }) {
      super(); Object.assign(this, options);
      mapOptions.push(options);
      this.center = options.center; this.zoom = options.zoom; this.heading = options.heading; this.tilt = options.tilt;
      div.classList.add("gm-style"); div.style.background = "#e8edf0";
      div.addEventListener("click", event => {
        const rect = div.getBoundingClientRect();
        const scale = 256 * 2 ** this.zoom / 360;
        const position = { lng: this.center.lng + (event.clientX - rect.left - rect.width / 2) / scale, lat: this.center.lat - (event.clientY - rect.top - rect.height / 2) / scale };
        this.emit("click", { latLng: { toJSON: () => position }, domEvent: event });
      });
    }
    getCenter() { return { toJSON: () => this.center }; }
    getZoom() { return this.zoom; } getHeading() { return this.heading; } getTilt() { return this.tilt; }
    getDiv() { return this.div; }
    get scale() { return 256 * 2 ** this.zoom / 360; }
    draw() { this.markers.forEach(marker => marker.draw()); this.overlays.forEach(overlay => overlay.draw()); }
    moveCamera(options: { center?: Position; zoom?: number; heading?: number; tilt?: number }) {
      Object.assign(this, options); this.draw();
      this.emit("bounds_changed"); this.emit("heading_changed"); this.emit("tilt_changed");
      queueMicrotask(() => this.emit("idle"));
    }
    setZoom(zoom: number) { this.moveCamera({ zoom }); }
    panBy(x: number, y: number) { this.moveCamera({ center: { lng: this.center.lng + x / this.scale, lat: this.center.lat - y / this.scale } }); }
    fitBounds(bounds: LatLngBounds) {
      const span = Math.max(Math.abs(bounds.ne.lng - bounds.sw.lng), Math.abs(bounds.ne.lat - bounds.sw.lat), 0.01);
      this.moveCamera({ center: { lng: (bounds.sw.lng + bounds.ne.lng) / 2, lat: (bounds.sw.lat + bounds.ne.lat) / 2 }, zoom: Math.min(14, Math.log2(500 * 360 / (256 * span))) });
    }
  }
  const mapOptions: object[] = [];
  class OverlayView {
    map: Map | null = null;
    onAdd() {} draw() {} onRemove() {}
    setMap(map: Map | null) {
      this.map?.overlays.delete(this);
      if (this.map) this.onRemove();
      this.map = map;
      if (map) { map.overlays.add(this); this.onAdd(); this.draw(); }
    }
    getPanes() { return this.map ? { overlayMouseTarget: this.map.div } : null; }
    getProjection() {
      return { fromLatLngToDivPixel: (position: Position) => {
        const map = this.map!;
        return { x: map.div.clientWidth / 2 + (position.lng - map.center.lng) * map.scale, y: map.div.clientHeight / 2 - (position.lat - map.center.lat) * map.scale };
      } };
    }
    static preventMapHitsAndGesturesFrom(element: HTMLElement) {
      element.addEventListener("click", event => event.stopPropagation());
    }
  }
  class AdvancedMarkerElement extends HTMLElement {
    events = new Events(); currentMap: Map | null = null; currentPosition: Position = { lng: 0, lat: 0 };
    gmpDraggable = false; anchorTop = "-50%";
    constructor(options: { map: Map; position: Position }) {
      super(); this.style.position = "absolute"; this.style.zIndex = "3";
      this.currentPosition = options.position; this.map = options.map;
    }
    set map(map: Map | null) {
      this.currentMap?.markers.delete(this); this.currentMap = map;
      if (map) { map.markers.add(this); map.div.append(this); this.draw(); } else this.remove();
    }
    get map() { return this.currentMap; }
    set position(position: Position) { this.currentPosition = position; this.draw(); }
    get position() { return this.currentPosition; }
    draw() {
      const map = this.map; if (!map) return;
      this.style.left = `${map.div.clientWidth / 2 + (this.position.lng - map.center.lng) * map.scale}px`;
      this.style.top = `${map.div.clientHeight / 2 - (this.position.lat - map.center.lat) * map.scale}px`;
      this.style.transform = `translate(-50%, ${this.anchorTop})`;
    }
    addListener(name: string, callback: (event?: unknown) => void) { return this.events.addListener(name, callback); }
  }
  customElements.define("hyops-google-marker-fixture", AdvancedMarkerElement);
  class LatLngBounds { constructor(public sw: Position, public ne: Position) {} }
  class InfoWindow {
    constructor(public options: { content: HTMLElement }) {}
    open({ anchor }: { anchor: AdvancedMarkerElement }) { anchor.append(this.options.content); }
    close() { this.options.content.remove(); }
  }
  const lines: Polyline[] = [];
  class Polyline extends Events {
    options: Record<string, unknown> = {};
    constructor(options: Record<string, unknown>) { super(); this.options = options; lines.push(this); }
    setOptions(options: Record<string, unknown>) { Object.assign(this.options, options); }
    setMap(map: Map | null) { this.options.map = map; }
  }
  const sdk = {
    Map, OverlayView, LatLngBounds, InfoWindow, Polyline, Size: class {},
    marker: { AdvancedMarkerElement }, RenderingType: { VECTOR: "VECTOR", RASTER: "RASTER" }, ColorScheme: { DARK: "DARK", LIGHT: "LIGHT" },
    event: {
      trigger(instance: Events, name: string) { instance.emit(name); },
      clearInstanceListeners(instance: Events) { instance.listeners?.clear(); },
      addListenerOnce(instance: Events, name: string, callback: () => void) {
        const handle = instance.addListener(name, () => { handle.remove(); callback(); }); return handle;
      },
    },
  };
  Object.assign(window, { google: { maps: sdk }, __googleMapsFixtureLines: lines, __googleMapsFixtureOptions: mapOptions });
  (window as Window & { __hyopsGoogleMapsReady?: () => void }).__hyopsGoogleMapsReady?.();
}
