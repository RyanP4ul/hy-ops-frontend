"use client";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "../api/client";
import { toQuery } from "../lib/filters";
import type { Filters } from "../api/contract";

interface State<T> { data: T | null; loading: boolean; error: string | null }

/** Keep the previous report visible while filters or operational data refresh. */
export function useReport<T>(path: string, f: Filters, opts: { refreshKey?: number; extra?: Record<string, string>; enabled?: boolean } = {}): State<T> {
  const { refreshKey = 0, extra, enabled = true } = opts;
  const filterKey = toQuery(f, extra);
  const query = useQuery({
    queryKey: ["reports", path, filterKey, refreshKey],
    queryFn: ({ signal }) => getReport<T>(path, f, extra, signal),
    enabled,
    placeholderData: (previousData, previousQuery) => previousQuery?.queryKey[2] === filterKey ? previousData : undefined,
    retry: 1,
    staleTime: 30_000,
  });
  return { data: query.data ?? null, loading: query.isFetching, error: query.error?.message ?? null };
}
