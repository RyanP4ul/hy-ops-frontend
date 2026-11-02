import { formatCurrency } from "@/utils/date-util";
export const peso = (n: number | null) => n === null ? "Unverified" : formatCurrency(n);
export const k = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 }).format(n);
/** "YYYY-MM-DD" in Manila time — matches the day boundaries the API uses. */
export const manilaDay = (d: Date | number) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
/** Local calendar date as YYYY-MM-DD (for the date picker). */
export const ymd = (d: Date) => d.toLocaleDateString("en-CA");
export const label = (s: string) => s.replace(/_/g, " ");
