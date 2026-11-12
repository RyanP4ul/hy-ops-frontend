import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useConnectionStore } from "@/stores/connection-store";
import { fleetApi } from "../api/fleet.api";

export const fleetKeys = {
  all: ["fleet"] as const,
  positions: ["fleet", "positions"] as const,
  enrichment: ["fleet", "active-deliveries-enrichment"] as const,
};

export function useFleetQuery({ pollMs }: { pollMs: number | false }) {
  const queryClient = useQueryClient();
  const connected = useConnectionStore((state) => state.connected);
  const previousConnection = useRef<boolean | null>(null);
  const query = useQuery({
    queryKey: fleetKeys.all,
    queryFn: ({ signal }) => fleetApi.getOverview(signal),
    refetchInterval: pollMs,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (previousConnection.current === false && connected) {
      void queryClient.invalidateQueries({ queryKey: fleetKeys.all });
    }
    previousConnection.current = connected;
  }, [connected, queryClient]);

  return query;
}
