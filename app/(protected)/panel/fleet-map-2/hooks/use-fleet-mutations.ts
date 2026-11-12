import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fleetApi } from "../api/fleet.api";
import type { PaymentArrangement } from "../types";
import { fleetKeys } from "./use-fleet-query";

/**
 * User-initiated writes. The page applies the change optimistically in local state;
 * every mutation re-syncs from the server when it settles, so a rejected change
 * (e.g. a 409 from a concurrent dispatch) snaps back to the real state.
 * Warehouses are read-only, so there are no warehouse mutations.
 */
export function useFleetMutations() {
  const queryClient = useQueryClient();
  const resync = () =>
    queryClient.invalidateQueries({ queryKey: fleetKeys.all });

  const assignVehicleWarehouse = useMutation({
    mutationFn: (v: { vehicleId: string; warehouseId: string }) =>
      fleetApi.assignVehicleWarehouse(v.vehicleId, v.warehouseId),
    onSettled: resync,
  });

  const dispatchDelivery = useMutation({
    mutationFn: (deliveryId: string) => fleetApi.dispatchDelivery(deliveryId),
    onSettled: resync,
  });

  const changePaymentArrangement = useMutation({
    mutationFn: (v: {
      orderNumber: string;
      paymentArrangement: PaymentArrangement;
    }) =>
      fleetApi.updatePaymentArrangement(v.orderNumber, v.paymentArrangement),
    onSettled: resync,
  });

  return { assignVehicleWarehouse, dispatchDelivery, changePaymentArrangement };
}
