"use client";

import { MapViewport } from "@/components/ui/map";
import { DEFAULT_LOCATION, StyleKey, styles } from "@/types/geocode";
import { createContext, useContext, useState } from "react";

type FleetMapContext = {
  viewport: MapViewport;
  setViewport: React.Dispatch<React.SetStateAction<MapViewport>>;
  style: StyleKey;
  setStyle: React.Dispatch<React.SetStateAction<StyleKey>>;
  selectedStyle: string | undefined;
  is3D: boolean;
};

const FleetMapContext = createContext<FleetMapContext | null>(null);

export function useFleetMap() {
  const context = useContext(FleetMapContext);

  if (!context)
    throw new Error("useFleetMap must be used inside FleetMapProvider");

  return context;
}

export function FleetMapProvider({ children }: { children: React.ReactNode }) {
  const [viewport, setViewport] = useState<MapViewport>({
    center: DEFAULT_LOCATION,
    zoom: 12,
    bearing: 0,
    pitch: 0,
  });

  const [style, setStyle] = useState<StyleKey>("default");
  const selectedStyle = styles[style];
  const is3D = style === "openstreetmap3d";

  return (
    <FleetMapContext.Provider
      value={{
        viewport,
        setViewport,
        style,
        setStyle,
        selectedStyle,
        is3D,
      }}
    >
      {children}
    </FleetMapContext.Provider>
  );
}
