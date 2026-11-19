import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fleetApi } from "../api/fleet.api";
import { FLEET_POLL_MS } from "../constants";
import type { StopEnrichment } from "../types";
import { fleetKeys } from "./use-fleet-query";

const EMPTY_STOP_MAP = new Map<string, StopEnrichment>();

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
