"use client";

import FleetMapPage from "./components/fleet-map-page";
import { FleetMapProvider } from "./provider";

export default function Page() {
  return (
    <FleetMapProvider>
      <FleetMapPage />
    </FleetMapProvider>
  );
}
