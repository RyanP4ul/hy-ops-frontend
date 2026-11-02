"use client";

import FleetMapPage from "./components/fleet-map-page";
import { FleetMapProvider } from "./provider";
import { MotionPage } from "@/components/page-motion";

export default function Page() {
  return (
    <MotionPage className="h-full">
      <FleetMapProvider>
        <FleetMapPage />
      </FleetMapProvider>
    </MotionPage>
  );
}
