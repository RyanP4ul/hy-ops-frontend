import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fleetApi } from "../api/fleet.api";
import { LIVE_POLL_MS } from "../constants";
import type { LivePosition } from "../types";
import { fleetKeys } from "./use-fleet-query";

/**
 * Real-time vehicle coordinates, keyed by vehicle id.
 *
 * This is the only place the web app learns where vehicles are. Polling is the default;
 * to use a websocket / SSE feed instead, replace the body of this hook and keep the
 * return shape (a Map plus status fields) and nothing else needs to change.
 */
export function useLivePositions(enabled: boolean) {
  const query = useQuery({
    queryKey: fleetKeys.positions,
    queryFn: ({ signal }) => fleetApi.getPositions(signal),
    enabled,
    refetchInterval: enabled ? LIVE_POLL_MS : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const positions = useMemo(
    () =>
      new Map<string, LivePosition>(
        (query.data?.positions ?? []).map((p) => [p.vehicleId, p]),
      ),
    [query.data],
  );

  return {
    positions,
    isError: query.isError,
    isFetched: query.isFetched,
    /** Epoch ms of the last successful poll (0 if none yet). */
    updatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}
