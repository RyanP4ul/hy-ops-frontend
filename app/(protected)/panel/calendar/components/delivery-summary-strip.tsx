"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Package,
  Truck,
} from "lucide-react";
import { useCalendar } from "../provider";

export function DeliverySummaryStrip() {
  const { periodSummary, statusFilter, setStatusFilter, view } = useCalendar();

  const periodLabel =
    view === "Day" ? "today" : view === "Month" ? "this month" : "this week";

  const onTheRoad =
    periodSummary.byStatus.in_transit + periodSummary.byStatus.returning;
  const overdueCount = periodSummary.byStatus.overdue;
  const isOverdueSelected = statusFilter === "overdue";

  const stopDetail = [
    `${periodSummary.deliveredStops} delivered`,
    periodSummary.failedStops > 0 ? `${periodSummary.failedStops} failed` : null,
    periodSummary.pickups > 0
      ? `+${periodSummary.pickups} return ${periodSummary.pickups === 1 ? "pickup" : "pickups"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="flex min-w-0 flex-col justify-between rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">
            Delivery Runs ({periodLabel})
          </span>
          <Truck
            className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {periodSummary.totalRuns}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {periodSummary.activeRuns} active · {periodSummary.byStatus.completed}{" "}
          completed
        </p>
      </div>

      <div className="flex min-w-0 flex-col justify-between rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">
            Outbound Stops
          </span>
          <Package
            className="size-4 shrink-0 text-foreground/70"
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {periodSummary.totalStops}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {stopDetail}
        </p>
      </div>

      <div className="flex min-w-0 flex-col justify-between rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">
            On the Road
          </span>
          <Navigation
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {onTheRoad}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {periodSummary.byStatus.in_transit} in transit ·{" "}
          {periodSummary.byStatus.returning} returning
        </p>
      </div>

      {overdueCount > 0 ? (
        <button
          type="button"
          aria-pressed={isOverdueSelected}
          onClick={() =>
            setStatusFilter((current) =>
              current === "overdue" ? "all" : "overdue",
            )
          }
          className={`flex min-w-0 flex-col justify-between rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            isOverdueSelected
              ? "border-rose-600 bg-rose-500/15 ring-1 ring-rose-600"
              : "border-rose-500/40 bg-rose-500/5 hover:border-rose-500"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-rose-700 dark:text-rose-300">
              Overdue Departures
            </span>
            <AlertTriangle
              className="size-4 shrink-0 text-rose-600 dark:text-rose-400"
              aria-hidden="true"
            />
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-rose-700 tabular-nums dark:text-rose-300">
            {overdueCount}
          </p>
          <p className="mt-0.5 truncate text-xs text-rose-700/80 dark:text-rose-300/80">
            {isOverdueSelected
              ? "Filtering overdue · Click to clear"
              : "Past departure · Click to view"}
          </p>
        </button>
      ) : (
        <div className="flex min-w-0 flex-col justify-between rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">
              Schedule Health
            </span>
            <CheckCircle2
              className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            On time
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            No overdue scheduled runs
          </p>
        </div>
      )}
    </div>
  );
}
