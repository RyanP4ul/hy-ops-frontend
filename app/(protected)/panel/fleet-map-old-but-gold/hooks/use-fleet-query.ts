import { useQuery } from "@tanstack/react-query";
import { fleetApi } from "../api/fleet.api";

export const fleetKeys = {
  all: ["fleet"] as const,
};

/**
 * One request hydrates the whole map (vehicles + trips + stops + orders + warehouses).
 * Polling is off on purpose: the local simulation owns vehicle movement, and merging a
 * poll mid-animation is only safe right after a user action (mutations invalidate this).
 * If you add a real position feed, turn on `refetchInterval` here.
 */
export function useFleetQuery() {
  return useQuery({
    queryKey: fleetKeys.all,
    queryFn: ({ signal }) => fleetApi.getOverview(signal),
    refetchOnWindowFocus: false,
  });
}
