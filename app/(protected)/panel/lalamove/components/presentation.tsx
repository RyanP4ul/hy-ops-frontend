import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { Check, CircleAlert, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Booking } from "../types";

export const selectClass = "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
export const primaryClass = "bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500";

export function LinkButton({ className, variant = "outline", size = "default", ...props }: ComponentProps<typeof Link> & { variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" }) {
  return <Link {...props} className={cn(buttonVariants({ variant, size }), className)} />;
}

export function money(amount: string | null | undefined, currency?: string | null) {
  if (amount == null || amount.trim() === "" || !Number.isFinite(Number(amount))) return "Not available";
  try { return new Intl.NumberFormat("en-PH", { style: "currency", currency: currency || "PHP" }).format(Number(amount)); }
  catch { return `${amount} ${currency || ""}`.trim(); }
}

export function dateLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not synchronized";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value));
}

export function words(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase().replace(/^\w/, character => character.toUpperCase());
}

export function bookingStatus(booking: Booking) {
  if (booking.booking_state === "UNKNOWN") return { label: "Confirmation uncertain", tone: "warning" } as const;
  if (booking.booking_state === "REVIEW") return { label: "Needs review", tone: "warning" } as const;
  if (booking.booking_state === "CREATING") return { label: "Confirming booking", tone: "info" } as const;
  if (booking.booking_state === "FAILED") return { label: "Booking unsuccessful", tone: "danger" } as const;
  if (booking.booking_state === "RESOLVED") return { label: booking.status === "CANCELED" ? "Cancelled" : "Resolved", tone: "neutral" } as const;
  if (booking.completed_at || booking.status === "COMPLETED") return { label: "Delivered", tone: "success" } as const;
  if (booking.picked_up_at || booking.status === "PICKED_UP") return { label: "On the way", tone: "info" } as const;
  const known: Record<string, string> = { ASSIGNING_DRIVER: "Finding a driver", ON_GOING: "Driver assigned", CANCELED: "Cancelled", REJECTED: "Driver unavailable", EXPIRED: "Booking expired", PENDING: "Awaiting confirmation" };
  return { label: known[booking.status] || words(booking.status), tone: booking.active ? "info" : "neutral" } as const;
}

export function StatusBadge({ booking }: { booking: Booking }) {
  const status = bookingStatus(booking);
  const colors = { success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300", warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300", danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300", info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300", neutral: "border-border bg-muted/50 text-muted-foreground" };
  return <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-1 font-medium", colors[status.tone])}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{status.label}</Badge>;
}

export function SectionHeading({ title, description, trailing }: { title: string; description?: string; trailing?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{trailing}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted/15 px-5 py-10 text-center"><span className="mb-3 grid size-11 place-items-center rounded-full border bg-background"><Inbox className="size-5 text-muted-foreground" aria-hidden="true" /></span><p className="font-medium">{title}</p><p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function QueryError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4"><p className="flex items-start gap-2 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />{message}</p><Button type="button" variant="outline" size="sm" onClick={retry}><RefreshCw className="size-3.5" aria-hidden="true" />Retry</Button></div>;
}

export function ListSkeleton({ label }: { label: string }) {
  return <div role="status" aria-label={`Loading ${label}`} className="space-y-3">{[0, 1, 2].map(item => <div key={item} className="flex items-center gap-4 rounded-xl border p-4"><Skeleton className="size-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-3/4" /></div><Skeleton className="h-8 w-20" /></div>)}</div>;
}

export function BookingProgress({ booking }: { booking: Booking }) {
  const index = booking.completed_at || booking.status === "COMPLETED" ? 3 : booking.picked_up_at || booking.status === "PICKED_UP" ? 2 : booking.status === "ON_GOING" ? 1 : 0;
  const confirmed = !!booking.lalamove_order_id && !["CREATING", "UNKNOWN", "FAILED"].includes(booking.booking_state);
  return <ol aria-label="Delivery progress" className="grid grid-cols-4 gap-1 py-2">{["Matching", "Driver assigned", "Picked up", "Delivered"].map((label, step) => <li key={label} aria-current={confirmed && step === index ? "step" : undefined} className="relative text-center"><div aria-hidden="true" className={cn("absolute top-3 left-0 h-px w-full bg-border", step === 0 && "left-1/2 w-1/2", step === 3 && "w-1/2")} /><span className={cn("relative mx-auto grid size-6 place-items-center rounded-full border text-[10px]", confirmed && step < index ? "border-emerald-600 bg-emerald-600 text-white" : confirmed && step === index ? "border-orange-600 bg-orange-600 text-white ring-4 ring-orange-100 dark:ring-orange-950" : "border-border bg-background text-muted-foreground")}>{confirmed && step < index ? <Check className="size-3" aria-hidden="true" /> : step + 1}</span><span className={cn("mt-2 block text-[11px] leading-tight", confirmed && step === index ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span></li>)}</ol>;
}

export function PendingIcon({ pending }: { pending: boolean }) {
  return pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />;
}
