import { expect, test } from "bun:test";
import {
  buildPaymentQueryParams,
  DEFAULT_PAYMENT_FILTERS,
  formatPaymentDateRange,
  getActivePaymentFilterChips,
  getPaymentDatePresets,
  hasActivePaymentFilters,
} from "../app/(protected)/panel/payments/filters";

test("buildPaymentQueryParams omits default ALL filters and includes active ones", () => {
  const defaultParams = buildPaymentQueryParams({
    pageIndex: 0,
    pageSize: 10,
    search: "",
    sortBy: { id: "id", type: "desc" },
    filters: DEFAULT_PAYMENT_FILTERS,
  });

  expect(defaultParams.toString()).toBe("grouped=true&page=0&limit=10&sort_by=id%3Adesc");

  const activeParams = buildPaymentQueryParams({
    pageIndex: 2,
    pageSize: 20,
    search: "  ORD-100  ",
    sortBy: { id: "received_at", type: "asc" },
    filters: {
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "PARTIALLY_PAID",
      entryType: "GROUP",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-21",
    },
  });

  expect(activeParams.get("search")).toBe("ORD-100");
  expect(activeParams.get("payment_method")).toBe("BANK_TRANSFER");
  expect(activeParams.get("payment_status")).toBe("PARTIALLY_PAID");
  expect(activeParams.get("entry_type")).toBe("GROUP");
  expect(activeParams.get("date_from")).toBe("2026-11-01");
  expect(activeParams.get("date_to")).toBe("2026-11-21");
});

test("date presets and labels use Asia/Manila wall dates", () => {
  // 2026-11-20T18:00:00Z is 2026-11-21 02:00:00 in Asia/Manila
  const presets = getPaymentDatePresets(new Date("2026-11-20T18:00:00.000Z"));
  expect(presets.find((p) => p.id === "today")).toEqual({
    id: "today",
    label: "Today",
    from: "2026-11-21",
    to: "2026-11-21",
  });
  expect(presets.find((p) => p.id === "last_7_days")).toEqual({
    id: "last_7_days",
    label: "Last 7 days",
    from: "2026-11-15",
    to: "2026-11-21",
  });
  expect(presets.find((p) => p.id === "this_month")).toEqual({
    id: "this_month",
    label: "This month",
    from: "2026-11-01",
    to: "2026-11-21",
  });

  expect(formatPaymentDateRange("2026-11-15", "2026-11-21", presets)).toBe("Last 7 days");
  expect(formatPaymentDateRange("2026-11-05", "2026-11-12", presets)).toBe("Nov 5 – Nov 12, 2026");
  expect(formatPaymentDateRange("2026-11-05", "2026-11-05", presets)).toBe("Nov 5, 2026");
  expect(formatPaymentDateRange("", "", presets)).toBe("Received date");
});

test("hasActivePaymentFilters and getActivePaymentFilterChips track every active filter", () => {
  expect(hasActivePaymentFilters(DEFAULT_PAYMENT_FILTERS, "")).toBe(false);
  expect(getActivePaymentFilterChips(DEFAULT_PAYMENT_FILTERS, "")).toEqual([]);

  const filters = {
    paymentMethod: "CASH" as const,
    paymentStatus: "REFUNDED" as const,
    entryType: "SINGLE" as const,
    dateFrom: "2026-11-01",
    dateTo: "2026-11-10",
  };
  expect(hasActivePaymentFilters(filters, "Juan")).toBe(true);
  expect(getActivePaymentFilterChips(filters, "Juan")).toEqual([
    { id: "search", category: "Search", value: "Juan" },
    { id: "status", category: "Status", value: "Refunded" },
    { id: "method", category: "Method", value: "Cash" },
    { id: "entryType", category: "Type", value: "Single payment" },
    { id: "date", category: "Received", value: "Nov 1 – Nov 10, 2026" },
  ]);
});
