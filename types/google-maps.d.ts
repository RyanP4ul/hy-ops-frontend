/** The subset of the browser-loaded Google Maps SDK used by this application.
 * Reference: https://developers.google.com/maps/documentation/javascript/reference
 */
declare namespace google.maps {
  interface LatLngLiteral { lat: number; lng: number; }
  interface LatLng { toJSON(): LatLngLiteral; }
  interface Padding { top: number; bottom: number; left: number; right: number; }
  interface CameraOptions { center?: LatLngLiteral; zoom?: number; heading?: number; tilt?: number; }
  interface MapMouseEvent { latLng: LatLng | null; domEvent: Event; }
  interface MapsEventListener { remove(): void; }
  interface MapOptions extends CameraOptions {
    minZoom?: number; maxZoom?: number; mapId?: string; renderingType?: string;
    colorScheme?: string; disableDefaultUI?: boolean; clickableIcons?: boolean;
    gestureHandling?: string; keyboardShortcuts?: boolean;
    headingInteractionEnabled?: boolean; tiltInteractionEnabled?: boolean;
  }
  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    getCenter(): LatLng | undefined;
    getZoom(): number | undefined;
    getHeading(): number | undefined;
    getTilt(): number | undefined;
    getDiv(): HTMLElement;
    setZoom(zoom: number): void;
    moveCamera(options: CameraOptions): void;
    panBy(x: number, y: number): void;
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
    addListener(name: string, handler: (event?: MapMouseEvent) => void): MapsEventListener;
  }
  class LatLngBounds { constructor(southWest: LatLngLiteral, northEast: LatLngLiteral); }
  class Size { constructor(width: number, height: number); }
  const RenderingType: { VECTOR: string };
  const ColorScheme: { DARK: string; LIGHT: string };
  namespace event {
    function trigger(instance: object, name: string): void;
    function clearInstanceListeners(instance: object): void;
    function addListenerOnce(instance: object, name: string, callback: () => void): MapsEventListener;
  }
  namespace marker {
    class AdvancedMarkerElement extends HTMLElement {
      constructor(options: { map: Map; position: LatLngLiteral; gmpDraggable: boolean; anchorLeft: string; anchorTop: string });
      map: Map | null;
      position: LatLngLiteral;
      gmpDraggable: boolean;
      anchorTop: string;
      addListener(name: string, callback: (event: MapMouseEvent) => void): MapsEventListener;
    }
  }
  class InfoWindow {
    constructor(options: { content: HTMLElement; maxWidth?: number; pixelOffset?: Size });
    open(options: { map: Map; anchor: marker.AdvancedMarkerElement; shouldFocus: boolean }): void;
    close(): void;
  }
  interface PolylineOptions {
    map?: Map; path?: LatLngLiteral[]; strokeColor?: string; strokeWeight?: number;
    strokeOpacity?: number; clickable?: boolean; zIndex?: number;
    icons?: { icon: { path: string; strokeColor: string; strokeWeight: number; strokeOpacity: number; scale: number }; offset: string; repeat: string }[];
  }
  class Polyline {
    constructor(options: PolylineOptions);
    setOptions(options: PolylineOptions): void;
    setMap(map: Map | null): void;
    addListener(name: string, callback: () => void): MapsEventListener;
  }
}
