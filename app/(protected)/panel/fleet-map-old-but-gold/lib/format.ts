import type { PaymentArrangement } from "../types";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function getPaymentArrangementLabel(
  arrangement: PaymentArrangement,
): string {
  switch (arrangement) {
    case "FULLY_PAID":
      return "Fully paid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "PAY_ON_DELIVERY":
      return "Pay on delivery";
    case "NET_30":
      return "Net 30";
  }
}

export const SCHEDULE_TIME_ZONE = "Asia/Manila"; // fixed zone keeps SSR and client output identical

export function formatSchedule(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(iso));
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Formats an ISO date (YYYY-MM-DD) such as an order's due date. */
export function formatDueDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(`${isoDate}T00:00:00+08:00`));
}
