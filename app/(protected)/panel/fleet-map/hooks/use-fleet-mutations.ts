import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceQueryRoots } from "@/lib/realtime";
import { fleetApi } from "../api/fleet.api";
import { fleetKeys } from "./use-fleet-query";

export function useFleetMutations() {
  const queryClient = useQueryClient();

  const resync = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: fleetKeys.all }),
      ...resourceQueryRoots.deliveries.map((root) =>
        queryClient.invalidateQueries({ queryKey: [root] }),
      ),
    ]);
  };

  const assignVehicleWarehouse = useMutation({
    mutationFn: (v: { vehicleId: string; warehouseId: string }) =>
      fleetApi.assignVehicleWarehouse(v.vehicleId, v.warehouseId),
    onSettled: resync,
  });

  const dispatchDelivery = useMutation({
    mutationFn: (deliveryId: string) => fleetApi.dispatchDelivery(deliveryId),
    onSettled: resync,
  });

  const markStopDelivered = useMutation({
    mutationFn: (stopId: string) => fleetApi.markStopDelivered(stopId),
    onSettled: resync,
  });

  const completeDelivery = useMutation({
    mutationFn: (deliveryId: string) => fleetApi.completeDelivery(deliveryId),
    onSettled: resync,
  });

  return {
    assignVehicleWarehouse,
    dispatchDelivery,
    markStopDelivered,
    completeDelivery,
  };
}
