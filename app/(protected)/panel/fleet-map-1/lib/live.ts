// Keep telemetry validation and monotonic update handling identical to Fleet Map.
export { isValidLiveFix, mergeMonotonicPositions, resolveVehiclePosition } from "../../fleet-map/lib/live";
import type { Vehicle, ResolvedPosition } from "../types";

/** GPS attention is for vehicles currently expected to report. */
export function needsGpsAttention(vehicle: Vehicle, position: ResolvedPosition | undefined): boolean {
  return vehicle.status !== "available" && (!position || position.health === "none" || position.health === "stale");
}
