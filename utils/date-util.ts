import { format } from "date-fns";

function normalizeCurrencyInput(
  amount: number | string | null | undefined,
): number | null {
  if (amount === null || amount === undefined || (typeof amount === "string" && amount.trim() === "")) {
    return null;
  }

  if (typeof amount === "string" && !/^-?\d+(\.\d+)?$/.test(amount.trim())) return null;
  const numericValue = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function formatCurrency(
  amount: number | string | null | undefined,
): string {
  const numericValue = normalizeCurrencyInput(amount);

  if (numericValue === null) {
    return amount === null || amount === undefined || (typeof amount === "string" && amount.trim() === "")
      ? "Not recorded"
      : "Invalid amount";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export const peso = (value: number | string | null | undefined) =>
  formatCurrency(value);

export function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function formatTimeRange(start: Date, end: Date) {
  return `${format(start, "hh:mm a")} - ${format(end, "hh:mm a")}`;
}

export function parseLocalDateTime(date: Date | string, time: string): Date {
  // SQL date-only values are wall-clock calendar dates, not UTC instants.
  const dateOnly = typeof date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  const result = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(date);
  const [hours, minutes] = time.split(":").map(Number);

  result.setHours(hours, minutes, 0, 0);

  return result;
}

/** Manila clock represented as local Date fields for the date-fns calendar UI.
 * Use only for display/navigation; this value is not an instant to persist.
 */
export function manilaCalendarNow(instant = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
}

/** A departure date and time are Manila wall-clock fields, independent of browser timezone. */
export function isFutureManilaDeparture(date: string, time: string, now = Date.now()): boolean {
  const instant = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`);
  return Number.isFinite(instant) && instant > now;
}

/** An incomplete financial total must stay unknown rather than silently contributing zero. */
export function sumKnownMoney(amounts: readonly (number | string | null | undefined)[]): number | null {
  let cents = 0;
  for (const amount of amounts) {
    const value = normalizeCurrencyInput(amount);
    if (value === null) return null;
    const minor = Math.round(value * 100);
    if (!Number.isSafeInteger(minor) || !Number.isSafeInteger(cents + minor)) return null;
    cents += minor;
  }
  return cents / 100;
}
