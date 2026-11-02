import {
  DELIVERY_STATUSES, DELIVERY_TYPES, ORDER_STATUSES, PAYMENT_ARRANGEMENTS, PAYMENT_METHODS, PAYMENT_STATUSES,
  type ArrayFilterKey, type DatePreset, type Opt,
} from "./api/contract";
import { label } from "./lib/format";

export const PRESETS: [DatePreset, string][] = [
  ["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["mtd", "Month to date"], ["ytd", "Year to date"], ["custom", "Custom range"],
];

/** In stock but this many units or fewer sold in the period = "slow moving". */
export const SLOW_UNITS = 10;
export const DEFAULT_LOW_STOCK = 10;

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export const enumOptions = (values: readonly string[]): Opt[] => values.map((v) => ({ value: v, label: label(v) }));

/** Filters whose choices never change (enums). Customer / product / warehouse / vehicle choices come from GET /reports/options. */
export const STATIC_FILTERS: { key: ArrayFilterKey; label: string; options: Opt[] }[] = [
  { key: "arrangements", label: "Arrangement", options: enumOptions(PAYMENT_ARRANGEMENTS) },
  { key: "payStatuses", label: "Payment status", options: enumOptions(PAYMENT_STATUSES) },
  { key: "orderStatuses", label: "Order status", options: enumOptions(ORDER_STATUSES) },
  { key: "paymentMethods", label: "Payment method", options: enumOptions(PAYMENT_METHODS) },
  { key: "deliveryStatuses", label: "Delivery status", options: enumOptions(DELIVERY_STATUSES) },
  { key: "deliveryTypes", label: "Delivery type", options: enumOptions(DELIVERY_TYPES) },
];

/** Every array filter in display order — used for the active-filter badges and the filter panel. */
export const FILTER_DEFS: { key: ArrayFilterKey; label: string }[] = [
  { key: "customers", label: "Customer" }, { key: "products", label: "Product" }, { key: "warehouses", label: "Warehouse" },
  { key: "arrangements", label: "Arrangement" }, { key: "payStatuses", label: "Payment status" }, { key: "orderStatuses", label: "Order status" },
  { key: "paymentMethods", label: "Payment method" }, { key: "deliveryStatuses", label: "Delivery status" }, { key: "deliveryTypes", label: "Delivery type" },
  { key: "vehicles", label: "Vehicle" },
];
