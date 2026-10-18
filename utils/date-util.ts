import { format } from "date-fns";

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function formatTimeRange(start: Date, end: Date) {
  return `${format(start, "hh:mm a")} - ${format(end, "hh:mm a")}`;
}

export function parseLocalDateTime(date: Date | string, time: string): Date {
  const result = new Date(date);
  const [hours, minutes] = time.split(":").map(Number);

  result.setHours(hours, minutes, 0, 0);

  return result;
}
