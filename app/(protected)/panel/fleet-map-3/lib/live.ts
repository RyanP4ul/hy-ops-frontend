import {
  GPS_FRESH_MS,
  GPS_FUTURE_CLOCK_SKEW_MS,
  GPS_STALE_MS,
} from "../constants";
import type {
  GpsHealth,
  LivePosition,
  ResolvedPosition,
  Vehicle,
  WarehouseLocation,
} from "../types";
import { getPosition, isValidCoordinate } from "./geometry";
import type { RoadRoute } from "./road-routing";

export function isValidLiveFix(
  live: LivePosition | undefined,
): live is LivePosition {
  return Boolean(live && isValidCoordinate(live.coordinates));
}

/**
 * Enforces monotonic device timestamps so out-of-order responses never move a
 * vehicle marker backward in time.
 */
export function mergeMonotonicPositions(
  previous: Map<string, LivePosition>,
  incoming: LivePosition[],
): Map<string, LivePosition> {
  const next = new Map<string, LivePosition>();

  for (const fix of incoming) {
    if (!isValidLiveFix(fix)) continue;
    const prev = previous.get(fix.vehicleId);
    if (prev) {
      const prevTime = Date.parse(prev.recordedAt);
      const nextTime = Date.parse(fix.recordedAt);
      if (
        Number.isFinite(prevTime) &&
        Number.isFinite(nextTime) &&
        nextTime < prevTime
      ) {
        next.set(fix.vehicleId, prev);
        continue;
      }
    }
    next.set(fix.vehicleId, fix);
  }

  return next;
}

/**
 * Merges a single live WebSocket coordinate update into the existing positions
 * map monotonically without dropping other vehicles.
 */
export function applyLivePositionFix(
  previous: Map<string, LivePosition>,
  fix: LivePosition,
): Map<string, LivePosition> {
  if (!isValidLiveFix(fix)) return previous;

  const prev = previous.get(fix.vehicleId);
  if (prev) {
    const prevTime = Date.parse(prev.recordedAt);
    const nextTime = Date.parse(fix.recordedAt);
    if (
      Number.isFinite(prevTime) &&
      Number.isFinite(nextTime) &&
      nextTime < prevTime
    ) {
      return previous;
    }
  }

  const next = new Map(previous);
  next.set(fix.vehicleId, fix);
  return next;
}

/**
 * Parses a backend DRIVER_LOCATION_UPDATE WebSocket payload into a LivePosition
 * when it is associated with a vehicle.
 */
export function livePositionFromWsPayload(
  payload: unknown,
): LivePosition | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const raw = payload as Record<string, unknown>;
  const vehicleId = raw.vehicle_id;
  if (
    vehicleId === null ||
    vehicleId === undefined ||
    (typeof vehicleId !== "number" && typeof vehicleId !== "string")
  ) {
    return null;
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!isValidCoordinate([longitude, latitude])) return null;

  const recordedAt =
    typeof raw.recorded_at === "string" && Number.isFinite(Date.parse(raw.recorded_at))
      ? raw.recorded_at
      : new Date().toISOString();
  const speedMps =
    typeof raw.speed === "number" && Number.isFinite(raw.speed) && raw.speed >= 0
      ? raw.speed
      : null;
  const heading =
    typeof raw.heading === "number" &&
    Number.isFinite(raw.heading) &&
    raw.heading >= 0 &&
    raw.heading <= 360
      ? raw.heading
      : null;
  const accuracyM =
    typeof raw.accuracy === "number" &&
    Number.isFinite(raw.accuracy) &&
    raw.accuracy >= 0
      ? raw.accuracy
      : null;

  return {
    vehicleId: String(vehicleId),
    coordinates: [longitude, latitude],
    speedKph: speedMps === null ? null : speedMps * 3.6,
    heading,
    recordedAt,
    receivedAt: new Date().toISOString(),
    accuracyM,
  };
}

/**
 * Resolves where a vehicle should be rendered and classifies GPS health
 * independently from vehicle operational state and WebSocket connection state.
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
      health: "simulated",
      isEstimated: true,
      speedKph: vehicle.speed,
      heading: null,
      ageMs: null,
      recordedAt: null,
    };
  }

  if (!isValidLiveFix(live)) {
    return {
      coordinates: getPosition(vehicle, warehouses, roadRoute),
      signal: "none",
      health: "none",
      isEstimated: true,
      speedKph: null,
      heading: null,
      ageMs: null,
      recordedAt: null,
    };
  }

  const recordedAt = Date.parse(live.recordedAt);
  if (
    !Number.isFinite(recordedAt) ||
    recordedAt > now + GPS_FUTURE_CLOCK_SKEW_MS
  ) {
    return {
      coordinates: live.coordinates,
      signal: "stale",
      health: "stale",
      isEstimated: false,
      speedKph: live.speedKph,
      heading: live.heading,
      ageMs: null,
      recordedAt: live.recordedAt,
      sampleIntervalSeconds: live.sampleIntervalSeconds,
      accuracyM: live.accuracyM,
    };
  }

  const ageMs = Math.max(0, now - recordedAt);
  const health: GpsHealth =
    ageMs <= GPS_FRESH_MS
      ? "fresh"
      : ageMs <= GPS_STALE_MS
        ? "delayed"
        : "stale";

  return {
    coordinates: live.coordinates,
    signal: ageMs > GPS_STALE_MS ? "stale" : "live",
    health,
    isEstimated: false,
    speedKph: live.speedKph,
    heading: live.heading,
    ageMs,
    recordedAt: live.recordedAt,
    sampleIntervalSeconds: live.sampleIntervalSeconds,
    accuracyM: live.accuracyM,
  };
}

export function needsGpsAttention(
  vehicle: Vehicle,
  position: ResolvedPosition | undefined,
): boolean {
  if (!position) return true;
  if (position.health === "simulated") return false;
  if (position.health === "stale") return true;
  // An active vehicle with no GPS signal at all needs immediate dispatcher attention;
  // idle/maintenance vehicles without GPS are flagged clearly without cluttering active warnings,
  // or also counted when GPS attention filter is used if signal is none/stale.
  if (position.health === "none") {
    return vehicle.status !== "available" || Boolean(vehicle.blockedReason);
  }
  return false;
}
