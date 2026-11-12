import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { fleetApi } from "../api/fleet.api";
import { LIVE_POLL_MS } from "../constants";
import { mergeMonotonicPositions } from "../lib/live";
import type { LivePosition } from "../types";
import { fleetKeys } from "./use-fleet-query";

const EMPTY_POSITIONS = new Map<string, LivePosition>();

export function useLivePositions(enabled: boolean) {
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
