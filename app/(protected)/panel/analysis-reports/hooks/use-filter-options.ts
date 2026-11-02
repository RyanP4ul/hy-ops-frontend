"use client";
import { useEffect, useState } from "react";
import { DEFAULT_FILTERS, type OptionsResponse } from "../api/contract";
import { getReport } from "../api/client";

const EMPTY: OptionsResponse = { customers: [], products: [], warehouses: [], vehicles: [] };

/** Customer / product / warehouse / vehicle choices for the filter dropdowns. */
export function useFilterOptions() {
  const [options, setOptions] = useState<OptionsResponse>(EMPTY);
  useEffect(() => {
    const ctrl = new AbortController();
    getReport<OptionsResponse>("/options", DEFAULT_FILTERS, {}, ctrl.signal).then(setOptions).catch(() => {});
    return () => ctrl.abort();
  }, []);
  return options;
}
