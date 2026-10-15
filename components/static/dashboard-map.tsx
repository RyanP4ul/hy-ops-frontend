"use client";

import { useTheme } from "next-themes";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

export default function DashboardMap() {
  const { theme } = useTheme();

  return (
    <>
      <MapContainer
        center={[14.5995, 120.9842]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`}
          // url={`https://{s}.basemaps.cartocdn.com/${theme === "dark" ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
        />

        <Marker position={[14.5995, 120.9842]}>
          <Popup>Hello!</Popup>
        </Marker>
      </MapContainer>
    </>
  );
}
