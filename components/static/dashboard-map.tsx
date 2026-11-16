"use client";

import { Map, MapControls, MapMarker, MarkerContent, MarkerPopup } from "@/components/ui/map";

export default function DashboardMap() {
  return (
    <Map center={[120.882177, 14.832451]} zoom={13}>
      <MapControls />
      <MapMarker latitude={14.5995} longitude={120.9842}>
        <MarkerContent />
        <MarkerPopup>Hello!</MarkerPopup>
      </MapMarker>
    </Map>
  );
}
