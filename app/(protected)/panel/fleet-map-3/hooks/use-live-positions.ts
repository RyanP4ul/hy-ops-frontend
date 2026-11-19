import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { fleetApi } from "../api/fleet.api";
import { LIVE_POLL_MS } from "../constants";
import {
  applyLivePositionFix,
  livePositionFromWsPayload,
  mergeMonotonicPositions,
} from "../lib/live";
import type { LivePosition } from "../types";
import { fleetKeys } from "./use-fleet-query";

const EMPTY_POSITIONS = new Map<string, LivePosition>();

export function useLivePositions(enabled: boolean) {
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const acceptedRef = useRef<Map<string, LivePosition>>(new Map());

  const query = useQuery({
    queryKey: fleetKeys.positions,
    queryFn: async ({ signal }) => {
      const data = await fleetApi.getPositions(signal);
      const merged = mergeMonotonicPositions(
        acceptedRef.current,
        data.positions ?? [],
      );
      acceptedRef.current = merged;
      return merged;
    },
    enabled,
    refetchInterval: enabled ? LIVE_POLL_MS : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!enabled) return;
    return subscribe(REQUESTS.DRIVER_LOCATION_UPDATE, (message) => {
      const fix = livePositionFromWsPayload(message.payload);
      if (fix) {
        const merged = applyLivePositionFix(acceptedRef.current, fix);
        if (merged !== acceptedRef.current) {
          acceptedRef.current = merged;
          queryClient.setQueryData(fleetKeys.positions, merged);
        }
      }
      void queryClient.invalidateQueries({ queryKey: fleetKeys.positions });
    });
  }, [enabled, queryClient, subscribe]);

  const positions = useMemo(
    () => query.data ?? EMPTY_POSITIONS,
    [query.data],
  );

  return {
    positions,
    isError: query.isError,
    isFetched: query.isFetched,
    updatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}
