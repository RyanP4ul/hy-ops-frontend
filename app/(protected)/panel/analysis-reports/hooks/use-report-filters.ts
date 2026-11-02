"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_FILTERS, type ArrayFilterKey, type Filters } from "../api/contract";
import { readFiltersFromUrl, writeFiltersToUrl } from "../lib/filters";

/** Filter state kept in sync with the page URL. `ready` is false until the URL has been read (avoids a wasted fetch with defaults). */
export function useReportFilters() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);

  useEffect(() => { setFilters(readFiltersFromUrl()); setReady(true); }, []);
  useEffect(() => { if (ready) writeFiltersToUrl(filters); }, [filters, ready]);

  const patch = useCallback((p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p })), []);
  const setList = useCallback((key: ArrayFilterKey) => (v: string[]) => setFilters((f) => ({ ...f, [key]: v })), []);
  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  return { filters, ready, patch, setList, reset };
}
