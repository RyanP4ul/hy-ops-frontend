import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fleetApi } from "../api/fleet.api";
import { FLEET_POLL_MS } from "../constants";
import type { StopEnrichment } from "../types";
import { fleetKeys } from "./use-fleet-query";

const EMPTY_STOP_MAP = new Map<string, StopEnrichment>();

/**
 * Optional read-only enrichment from GET /api/deliveries?active=true&limit=100.
 * Supplies real failed-stop status, failure reasons, numeric order IDs, and
 * order group metadata without altering the /api/fleet contract.
 */
export function useDeliveryEnrichment(enabled: boolean) {
  const query = useQuery({
    queryKey: fleetKeys.enrichment,
    queryFn: ({ signal }) => fleetApi.getActiveDeliveries(signal),
    enabled,
    refetchInterval: enabled ? FLEET_POLL_MS : false,
    refetchOnReconnect: true,
    retry: 1,
  });

  const byStopId = useMemo(() => {
    const rows = query.data;
    if (!rows || !Array.isArray(rows)) return EMPTY_STOP_MAP;
    const map = new Map<string, StopEnrichment>();
    for (const delivery of rows) {
      for (const item of delivery.orders ?? []) {
        if (item.stop_id == null) continue;
        map.set(String(item.stop_id), {
          stopId: String(item.stop_id),
          orderId: item.order_id,
          orderNumber: item.order_number,
          actualStatus: item.status,
          failureReason: item.failure_reason ?? null,
          orderGroupId: item.order_group_id ?? null,
          orderGroupNumber: item.order_group_number ?? null,
          orderGroupPosition: item.order_group_position ?? null,
          returnId: item.return_id ?? null,
          returnStatus: item.return_status ?? null,
        });
      }
    }
    return map;
  }, [query.data]);

  return {
    byStopId,
    isError: query.isError,
    refetch: query.refetch,
  };
}
