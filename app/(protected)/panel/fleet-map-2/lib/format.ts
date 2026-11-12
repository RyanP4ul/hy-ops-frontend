import type { PaymentArrangement } from "../types";

import { formatCurrency as money } from "@/utils/date-util";
export function formatCurrency(value: number | null): string { return value === null ? "Unverified" : money(value); }

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

/** "just now", "42s ago", "5m ago", "3h ago". */
export function formatAgo(ageMs: number): string {
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function formatSpeed(speedKph: number | null): string {
  return speedKph === null ? "—" : `${Math.round(speedKph)} km/h`;
}
