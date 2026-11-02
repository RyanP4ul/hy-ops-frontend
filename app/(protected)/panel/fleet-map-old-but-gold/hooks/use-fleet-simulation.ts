import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fleetApi } from "../api/fleet.api";
import { PERSIST_SIMULATION } from "../constants";
import {
  advanceVehicle,
  diffTransitions,
  type SimulationEvent,
} from "../lib/simulation";
import type { Vehicle } from "../types";
import { fleetKeys } from "./use-fleet-query";

const TICK_MS = 1000;

type Options = {
  vehicles: Vehicle[];
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  isRunning: boolean;
  autoDispatch: boolean;
};

/**
 * Animates vehicles along their routes once per second.
 *
 * The tick reads the latest state from a ref (not a state updater) so the events it
 * emits are computed exactly once per tick, outside React's updater functions.
 */
export function useFleetSimulation({
  vehicles,
  setVehicles,
  isRunning,
  autoDispatch,
}: Options) {
  const persist = useSimulationPersistence();
  const latest = useRef(vehicles);

  useEffect(() => {
    latest.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      const previous = latest.current;
      const next = previous.map((vehicle) =>
        advanceVehicle(vehicle, autoDispatch),
      );
      latest.current = next;
      setVehicles(next);
      persist(diffTransitions(previous, next));
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [isRunning, autoDispatch, setVehicles, persist]);
}

/** Writes simulated progress to the API. A no-op unless PERSIST_SIMULATION is on. */
function useSimulationPersistence() {
  const queryClient = useQueryClient();

  return useCallback(
    (events: SimulationEvent[]) => {
      if (!PERSIST_SIMULATION || events.length === 0) return;

      for (const event of events) {
        const request =
          event.type === "stop-delivered"
            ? fleetApi.markStopDelivered(event.stopId)
            : event.type === "trip-completed"
              ? fleetApi.completeDelivery(event.tripId)
              : fleetApi.dispatchDelivery(event.tripId);

        // On failure, re-sync so the UI shows what the server actually has.
        request.catch(() =>
          queryClient.invalidateQueries({ queryKey: fleetKeys.all }),
        );
      }
    },
    [queryClient],
  );
}
