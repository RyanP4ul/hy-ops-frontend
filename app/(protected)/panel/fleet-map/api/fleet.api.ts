import { http } from "../api-client";
import type {
  ActiveDeliveryApiRow,
  DeliveryProofMeta,
  FleetOverview,
  LivePosition,
} from "../types";

type Ok = { ok: true };

/** Thin wrappers over the real backend REST routes. */
export const fleetApi = {
  getOverview: (signal?: AbortSignal) =>
    http.get<FleetOverview>("/fleet", signal),

  getPositions: (signal?: AbortSignal) =>
    http.get<{ positions: LivePosition[] }>("/fleet/positions", signal),

  getActiveDeliveries: (signal?: AbortSignal) =>
    http.get<ActiveDeliveryApiRow[]>(
      "/deliveries?active=true&limit=100",
      signal,
    ),

  getStopProofs: (stopId: string, signal?: AbortSignal) =>
    http.get<DeliveryProofMeta[]>(
      `/deliveries/stops/${encodeURIComponent(stopId)}/proofs`,
      signal,
    ),

  assignVehicleWarehouse: (vehicleId: string, warehouseId: string) =>
    http.patch<Ok>(`/fleet/vehicles/${vehicleId}/warehouse`, {
      warehouseId: Number(warehouseId),
    }),

  dispatchDelivery: (deliveryId: string) =>
    http.post<Ok>(`/deliveries/${encodeURIComponent(deliveryId)}/dispatch`),

  markStopDelivered: (stopId: string) =>
    http.post<Ok>(`/deliveries/stops/${encodeURIComponent(stopId)}/delivered`),

  completeDelivery: (deliveryId: string) =>
    http.post<Ok>(`/deliveries/${encodeURIComponent(deliveryId)}/complete`),
};
