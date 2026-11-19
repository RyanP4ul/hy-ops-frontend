import type { DeliveryEffectiveStatus } from "@/lib/delivery-calendar";

export const CALENDAR_CATEGORIES: CalendarCategory[] = [
  "DELIVERY",
  "ORDER_FULFILLMENT",
  "VEHICLE_MAINTENANCE",
  "INVENTORY_WAREHOUSE",
  "STAFF_SCHEDULE",
  "MEETING_APPOINTMENT",
  "OTHER",
];

export const CATEGORY_LABELS: Record<CalendarCategory, string> = {
  DELIVERY: "Delivery note",
  ORDER_FULFILLMENT: "Order fulfillment",
  VEHICLE_MAINTENANCE: "Vehicle maintenance",
  INVENTORY_WAREHOUSE: "Inventory & warehouse",
  STAFF_SCHEDULE: "Staff schedule",
  MEETING_APPOINTMENT: "Meeting / appointment",
  OTHER: "Other",
};

export const DELIVERY_STATUS_STYLES: Record<
  DeliveryEffectiveStatus,
  {
    card: string;
    accent: string;
    dot: string;
    badge: string;
    label: string;
  }
> = {
  scheduled: {
    card: "bg-sky-100/90 text-sky-950 hover:bg-sky-200/90 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900/70",
    accent: "border-sky-500",
    dot: "bg-sky-500",
    badge:
      "border-sky-500/30 bg-sky-500/15 text-sky-900 dark:text-sky-200",
    label: "Scheduled",
  },
  overdue: {
    card: "bg-rose-100/95 text-rose-950 hover:bg-rose-200/95 dark:bg-rose-950/70 dark:text-rose-100 dark:hover:bg-rose-900/70",
    accent: "border-rose-600",
    dot: "bg-rose-600",
    badge:
      "border-rose-600/30 bg-rose-600/15 text-rose-900 dark:text-rose-200",
    label: "Overdue",
  },
  in_transit: {
    card: "bg-emerald-100/90 text-emerald-950 hover:bg-emerald-200/90 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/70",
    accent: "border-emerald-600",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-600/30 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
    label: "In transit",
  },
  returning: {
    card: "bg-indigo-100/90 text-indigo-950 hover:bg-indigo-200/90 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-900/70",
    accent: "border-indigo-500",
    dot: "bg-indigo-500",
    badge:
      "border-indigo-500/30 bg-indigo-500/15 text-indigo-900 dark:text-indigo-200",
    label: "Returning",
  },
  completed: {
    card: "bg-slate-100 text-slate-800 hover:bg-slate-200/90 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800",
    accent: "border-slate-400",
    dot: "bg-slate-500",
    badge:
      "border-slate-500/30 bg-slate-500/15 text-slate-800 dark:text-slate-200",
    label: "Completed",
  },
  cancelled: {
    card: "bg-muted/70 text-muted-foreground hover:bg-muted dark:bg-muted/40",
    accent: "border-muted-foreground/50",
    dot: "bg-muted-foreground/60",
    badge:
      "border-muted-foreground/30 bg-muted text-muted-foreground",
    label: "Cancelled",
  },
};

export const MANUAL_CATEGORY_STYLES: Record<
  CalendarCategory,
  { card: string; accent: string; dot: string }
> = {
  DELIVERY: {
    card: "bg-amber-50/90 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60",
    accent: "border-amber-500/70",
    dot: "bg-amber-500",
  },
  ORDER_FULFILLMENT: {
    card: "bg-orange-50/90 text-orange-950 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-100 dark:hover:bg-orange-950/60",
    accent: "border-orange-500/70",
    dot: "bg-orange-500",
  },
  STAFF_SCHEDULE: {
    card: "bg-teal-50/90 text-teal-950 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-950/60",
    accent: "border-teal-500/70",
    dot: "bg-teal-500",
  },
  INVENTORY_WAREHOUSE: {
    card: "bg-lime-50/90 text-lime-950 hover:bg-lime-100 dark:bg-lime-950/40 dark:text-lime-100 dark:hover:bg-lime-950/60",
    accent: "border-lime-500/70",
    dot: "bg-lime-500",
  },
  VEHICLE_MAINTENANCE: {
    card: "bg-violet-50/90 text-violet-950 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60",
    accent: "border-violet-500/70",
    dot: "bg-violet-500",
  },
  MEETING_APPOINTMENT: {
    card: "bg-sky-50/80 text-sky-950 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/50",
    accent: "border-sky-400/70",
    dot: "bg-sky-400",
  },
  OTHER: {
    card: "bg-slate-50 text-slate-900 hover:bg-slate-100 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800/60",
    accent: "border-slate-400/70",
    dot: "bg-slate-400",
  },
};
