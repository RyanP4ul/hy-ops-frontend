import { useEffect, type Dispatch, type SetStateAction } from "react";
import { advanceVehicle } from "../lib/simulation";
import type { Vehicle } from "../types";

const TICK_MS = 1000;

type Options = {
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  enabled: boolean;
  autoDispatch: boolean;
};

/**
 * TESTING TOOL. Animates vehicles along their routes once per second, purely in the
 * browser. Never calls the API or persists changes.
 */
export function useFleetSimulation({
  setVehicles,
  enabled,
  autoDispatch,
}: Options) {
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      setVehicles((current) =>
        current.map((vehicle) => advanceVehicle(vehicle, autoDispatch)),
      );
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [enabled, autoDispatch, setVehicles]);
}
