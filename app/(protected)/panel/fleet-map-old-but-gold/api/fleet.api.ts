import { http } from "../api-client";
import type {
  FleetOverview,
  PaymentArrangement,
  WarehouseInput,
  WarehouseLocation,
} from "../types";

type Ok = { ok: true };

/** Thin wrappers over the REST routes. No React in here. */
export const fleetApi = {
  getOverview: (signal?: AbortSignal) =>
    http.get<FleetOverview>("/fleet", signal),

  assignVehicleWarehouse: (vehicleId: string, warehouseId: string) =>
    http.patch<Ok>(`/fleet/vehicles/${vehicleId}/warehouse`, {
      warehouseId: Number(warehouseId),
    }),

  dispatchDelivery: (deliveryId: string) =>
    http.post<Ok>(`/deliveries/${deliveryId}/dispatch`),

  markStopDelivered: (stopId: string) =>
    http.post<Ok>(`/deliveries/stops/${stopId}/delivered`),

  completeDelivery: (deliveryId: string) =>
    http.post<Ok>(`/deliveries/${deliveryId}/complete`),

  updatePaymentArrangement: (
    orderNumber: string,
    paymentArrangement: PaymentArrangement,
  ) =>
    http.patch<Ok>(
      `/orders/${encodeURIComponent(orderNumber)}/payment-arrangement`,
      { paymentArrangement },
    ),

  createWarehouse: (input: WarehouseInput) =>
    http.post<WarehouseLocation>("/warehouses", input),

  updateWarehouse: (id: string, input: WarehouseInput) =>
    http.patch<WarehouseLocation>(`/warehouses/${id}`, input),

  archiveWarehouse: (id: string) => http.delete<Ok>(`/warehouses/${id}`),
};
