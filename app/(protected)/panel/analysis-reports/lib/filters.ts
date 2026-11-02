import { ARRAY_FILTER_KEYS, DATE_PRESETS, DEFAULT_FILTERS, type Filters } from "../api/contract";
import { FILTER_DEFS, PRESETS } from "../constants";

export const isCustom = (f: Filters) => f.preset === "custom" && !!f.from && !!f.to;

/** Query string for the API. Arrays are comma-separated; defaults are omitted. */
export function toQuery(f: Filters, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ preset: f.preset });
  if (isCustom(f)) { p.set("from", f.from); p.set("to", f.to); }
  ARRAY_FILTER_KEYS.forEach((key) => f[key].length && p.set(key, f[key].join(",")));
  if (f.overdueOnly) p.set("overdueOnly", "true");
  Object.entries(extra).forEach(([key, v]) => p.set(key, v));
  return p.toString();
}

export const periodLabel = (f: Filters) => (isCustom(f) ? `${f.from} to ${f.to}` : PRESETS.find(([v]) => v === f.preset)?.[1] ?? "Last 90 days");

/** Badges shown for active filters, e.g. "Customer: 2". */
export const activeFilterLabels = (f: Filters) =>
  FILTER_DEFS.filter((d) => f[d.key].length).map((d) => `${d.label}: ${f[d.key].length}`).concat(f.overdueOnly ? ["Overdue only"] : []);

// ---- Page URL (?f=...) so a filtered view can be shared ----
export function readFiltersFromUrl(): Filters {
  try {
    const raw = new URLSearchParams(location.search).get("f");
    if (!raw) return DEFAULT_FILTERS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_FILTERS;
    const input = parsed as Record<string, unknown>;
    const filters = { ...DEFAULT_FILTERS };
    if (typeof input.preset === "string" && DATE_PRESETS.some(preset => preset === input.preset)) filters.preset = input.preset as Filters["preset"];
    if (typeof input.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.from)) filters.from = input.from;
    if (typeof input.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.to)) filters.to = input.to;
    for (const key of ARRAY_FILTER_KEYS) {
      const value = input[key];
      if (Array.isArray(value) && value.every(item => typeof item === "string")) filters[key] = [...new Set(value)];
    }
    if (typeof input.overdueOnly === "boolean") filters.overdueOnly = input.overdueOnly;
    return filters;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function writeFiltersToUrl(f: Filters) {
  const diff = Object.fromEntries(Object.entries(f).filter(([key, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULT_FILTERS[key as keyof Filters])));
  const u = new URL(location.href);
  Object.keys(diff).length ? u.searchParams.set("f", JSON.stringify(diff)) : u.searchParams.delete("f");
  history.replaceState(null, "", u);
}
