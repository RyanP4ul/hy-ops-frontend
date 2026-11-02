import { STALE_AFTER_MS } from "../constants";
import type {
  LivePosition,
  ResolvedPosition,
  Vehicle,
  WarehouseLocation,
} from "../types";
import { getPosition } from "./geometry";
import type { RoadRoute } from "./road-routing";

/**
 * Decides where a vehicle is drawn and how much to trust that.
 *
 * - Simulation mode: the animated position; real GPS is ignored.
 * - Live mode: the latest real fix (flagged stale once it gets old).
 * - Live mode without any fix: an estimate from trip progress (the warehouse for idle
 *   vehicles, otherwise the last completed stop) flagged as "no signal".
 */
export function resolveVehiclePosition(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
  live: LivePosition | undefined,
  simulationOn: boolean,
  now: number,
  roadRoute?: RoadRoute,
): ResolvedPosition {
  if (simulationOn) {
    return {
      coordinates: getPosition(vehicle, warehouses, roadRoute),
      signal: "simulated",
      speedKph: vehicle.speed,
      heading: null,
      ageMs: null,
    };
  }

  if (!live || live.coordinates.some((value) => !Number.isFinite(value)) || Math.abs(live.coordinates[0]) > 180 || Math.abs(live.coordinates[1]) > 90) {
    return {
      coordinates: getPosition(vehicle, warehouses, roadRoute),
      signal: "none",
      speedKph: null,
      heading: null,
      ageMs: null,
    };
  }

  const recordedAt = Date.parse(live.recordedAt);
  if (!Number.isFinite(recordedAt) || recordedAt > now + 30_000) {
    return {
      coordinates: live.coordinates,
      signal: "stale",
      speedKph: live.speedKph,
      heading: live.heading,
      ageMs: null,
    };
  }

  const ageMs = Math.max(0, now - recordedAt);
  return {
    coordinates: live.coordinates,
    signal: ageMs > STALE_AFTER_MS ? "stale" : "live",
    speedKph: live.speedKph,
    heading: live.heading,
    ageMs,
    sampleIntervalSeconds: live.sampleIntervalSeconds,
    accuracyM: live.accuracyM,
  };
}
