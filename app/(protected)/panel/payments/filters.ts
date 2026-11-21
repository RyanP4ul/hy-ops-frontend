import { format, startOfMonth, subDays } from "date-fns";
import { manilaCalendarNow, toDateInputValue } from "@/utils/date-util";

export type PaymentMethodFilter = "ALL" | "CASH" | "BANK_TRANSFER";

export type PaymentStatusFilter =
  | "ALL"
  | "PAID"
  | "PARTIALLY_PAID"
  | "UNPAID"
  | "OVERDUE"
  | "UNVERIFIED"
  | "REFUNDED"
  | "CANCELLED";

export type PaymentEntryTypeFilter = "ALL" | "SINGLE" | "GROUP";

export type PaymentFilters = {
  paymentMethod: PaymentMethodFilter;
  paymentStatus: PaymentStatusFilter;
  entryType: PaymentEntryTypeFilter;
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_PAYMENT_FILTERS: PaymentFilters = {
  paymentMethod: "ALL",
  paymentStatus: "ALL",
  entryType: "ALL",
  dateFrom: "",
  dateTo: "",
};

export const PAYMENT_STATUS_OPTIONS: readonly {
  value: PaymentStatusFilter;
  label: string;
}[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const PAYMENT_METHOD_OPTIONS: readonly {
  value: PaymentMethodFilter;
  label: string;
}[] = [
  { value: "ALL", label: "All methods" },
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

export const PAYMENT_ENTRY_TYPE_OPTIONS: readonly {
  value: PaymentEntryTypeFilter;
  label: string;
}[] = [
  { value: "ALL", label: "All types" },
  { value: "SINGLE", label: "Single payment" },
  { value: "GROUP", label: "Combined payment" },
];

export type DatePresetId = "today" | "last_7_days" | "last_30_days" | "this_month";

export type DatePreset = {
  id: DatePresetId;
  label: string;
  from: string;
  to: string;
};

export function getPaymentDatePresets(now = new Date()): DatePreset[] {
  const manilaToday = manilaCalendarNow(now);
  const todayStr = toDateInputValue(manilaToday);

  return [
    {
      id: "today",
      label: "Today",
      from: todayStr,
      to: todayStr,
    },
    {
      id: "last_7_days",
      label: "Last 7 days",
      from: toDateInputValue(subDays(manilaToday, 6)),
      to: todayStr,
    },
    {
      id: "last_30_days",
      label: "Last 30 days",
      from: toDateInputValue(subDays(manilaToday, 29)),
      to: todayStr,
    },
    {
      id: "this_month",
      label: "This month",
      from: toDateInputValue(startOfMonth(manilaToday)),
      to: todayStr,
    },
  ];
}

export function parseYmdToLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function formatPaymentDateRange(
  dateFrom: string,
  dateTo: string,
  presets?: readonly DatePreset[],
): string {
  if (!dateFrom && !dateTo) return "Received date";

  const matchedPreset = presets?.find(
    (preset) => preset.from === dateFrom && preset.to === dateTo,
  );
  if (matchedPreset) return matchedPreset.label;

  const fromDate = parseYmdToLocalDate(dateFrom);
  const toDate = parseYmdToLocalDate(dateTo);

  if (fromDate && toDate) {
    if (dateFrom === dateTo) return format(fromDate, "MMM d, yyyy");
    if (fromDate.getFullYear() === toDate.getFullYear()) {
      return `${format(fromDate, "MMM d")} – ${format(toDate, "MMM d, yyyy")}`;
    }
    return `${format(fromDate, "MMM d, yyyy")} – ${format(toDate, "MMM d, yyyy")}`;
  }
  if (fromDate) return `From ${format(fromDate, "MMM d, yyyy")}`;
  if (toDate) return `Until ${format(toDate, "MMM d, yyyy")}`;
  return "Received date";
}

export function hasActivePaymentFilters(
  filters: PaymentFilters,
  search = "",
): boolean {
  return Boolean(
    search.trim() ||
      filters.paymentStatus !== "ALL" ||
      filters.paymentMethod !== "ALL" ||
      filters.entryType !== "ALL" ||
      filters.dateFrom ||
      filters.dateTo,
  );
}

export type ActivePaymentFilterChip = {
  id: "search" | "status" | "method" | "entryType" | "date";
  category: string;
  value: string;
};

export function getActivePaymentFilterChips(
  filters: PaymentFilters,
  search: string,
  presets?: readonly DatePreset[],
): ActivePaymentFilterChip[] {
  const chips: ActivePaymentFilterChip[] = [];

  if (search.trim()) {
    chips.push({
      id: "search",
      category: "Search",
      value: search.trim(),
    });
  }

  if (filters.paymentStatus !== "ALL") {
    const label =
      PAYMENT_STATUS_OPTIONS.find((option) => option.value === filters.paymentStatus)
        ?.label ?? filters.paymentStatus;
    chips.push({
      id: "status",
      category: "Status",
      value: label,
    });
  }

  if (filters.paymentMethod !== "ALL") {
    const label =
      PAYMENT_METHOD_OPTIONS.find((option) => option.value === filters.paymentMethod)
        ?.label ?? filters.paymentMethod;
    chips.push({
      id: "method",
      category: "Method",
      value: label,
    });
  }

  if (filters.entryType !== "ALL") {
    const label =
      PAYMENT_ENTRY_TYPE_OPTIONS.find((option) => option.value === filters.entryType)
        ?.label ?? filters.entryType;
    chips.push({
      id: "entryType",
      category: "Type",
      value: label,
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      id: "date",
      category: "Received",
      value: formatPaymentDateRange(filters.dateFrom, filters.dateTo, presets),
    });
  }

  return chips;
}

export function buildPaymentQueryParams({
  pageIndex,
  pageSize,
  search,
  sortBy,
  filters,
}: {
  pageIndex: number;
  pageSize: number;
  search: string;
  sortBy: { id: string; type: string };
  filters: PaymentFilters;
}): URLSearchParams {
  const params = new URLSearchParams({
    grouped: "true",
    page: String(pageIndex),
    limit: String(pageSize),
    sort_by: `${sortBy.id}:${sortBy.type}`,
  });

  if (search.trim()) params.set("search", search.trim());
  if (filters.paymentMethod !== "ALL") params.set("payment_method", filters.paymentMethod);
  if (filters.paymentStatus !== "ALL") params.set("payment_status", filters.paymentStatus);
  if (filters.entryType !== "ALL") params.set("entry_type", filters.entryType);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);

  return params;
}
