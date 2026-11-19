"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  MapPin,
  Package,
  Route,
  Search,
  Truck,
  User,
} from "lucide-react";
import { parseLocalDateTime } from "@/utils/date-util";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ActiveDelivery = {
  run: string;
  customer: string;
  destination: string;
  driver: string;
  status: string;
  progress: string;
};

type UpcomingDelivery = {
  run: string;
  date: string;
  time: string;
  customer: string;
  destination: string;
  driver: string;
};

function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    SCHEDULED: {
      bg: "bg-amber-500/10",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-500/30",
    },
    IN_TRANSIT: {
      bg: "bg-blue-500/10",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-500/30",
    },
    RETURNING: {
      bg: "bg-violet-500/10",
      text: "text-violet-700 dark:text-violet-400",
      border: "border-violet-500/30",
    },
    COMPLETED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-500/30",
    },
    DELIVERED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-500/30",
    },
    CANCELLED: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      border: "border-destructive/30",
    },
  };

  const style = styles[key] ?? {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };

  const formattedName = key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <Badge
      variant="outline"
      className={`h-5 gap-1 text-[11px] font-medium ${style.bg} ${style.text} ${style.border}`}
    >
      {key === "IN_TRANSIT" && (
        <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {formattedName}
    </Badge>
  );
}

export function DeliveryOperations({
  activeDeliveries = [],
  upcomingDeliveries = [],
}: {
  activeDeliveries: ActiveDelivery[];
  upcomingDeliveries: UpcomingDelivery[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredActive = useMemo(() => {
    return activeDeliveries.filter((d) => {
      const matchesSearch =
        d.run.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.destination.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        d.status.toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [activeDeliveries, searchQuery, statusFilter]);

  return (
    <section aria-labelledby="delivery-ops-heading" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="delivery-ops-heading"
            className="text-lg font-bold tracking-tight"
          >
            Delivery Operations in Motion
          </h2>
          <p className="text-xs text-muted-foreground">
            Live route execution and upcoming scheduled hub departures
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-primary"
            render={<Link href="/panel/deliveries" />}
          >
            Manage all deliveries
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Active Deliveries Card */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
          <CardHeader className="border-b bg-muted/20 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Truck className="size-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight">
                      Active Delivery Runs
                    </h3>
                    <Badge variant="secondary" className="h-5 text-xs">
                      {activeDeliveries.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vehicles currently en route, loading, or returning
                  </p>
                </div>
              </div>

              {/* Status filter chips */}
              <div className="flex flex-wrap items-center gap-1">
                {["ALL", "IN_TRANSIT", "SCHEDULED", "RETURNING"].map(
                  (filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setStatusFilter(filterKey)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        statusFilter === filterKey
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {filterKey === "ALL"
                        ? "All"
                        : filterKey === "IN_TRANSIT"
                        ? "In Transit"
                        : filterKey === "SCHEDULED"
                        ? "Scheduled"
                        : "Returning"}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Search filter for active deliveries */}
            {activeDeliveries.length > 3 && (
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter by run, customer, driver, or destination..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background/80"
                />
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-1 p-5">
            {!activeDeliveries.length ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-muted/10">
                <Package className="mb-2 size-8 text-muted-foreground/60" />
                <h4 className="text-sm font-medium">No active deliveries</h4>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Scheduled and dispatched runs will appear here with live route tracking.
                </p>
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs"
                  render={<Link href="/panel/deliveries" />}
                >
                  Create or dispatch a run
                </Button>
              </div>
            ) : !filteredActive.length ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No active runs match the selected filter.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {filteredActive.map((delivery) => (
                  <li
                    key={delivery.run}
                    className="py-4 first:pt-0 last:pb-0 hover:bg-muted/10 rounded-lg transition-colors px-1"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {delivery.run}
                          </span>
                          <StatusBadge status={delivery.status} />
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-foreground/90">
                          {delivery.customer}
                        </p>
                      </div>

                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {delivery.progress}
                      </span>
                    </div>

                    <div className="mt-2.5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{delivery.driver}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="size-3.5 shrink-0 text-rose-500/80" />
                        <span className="truncate">{delivery.destination}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Departures Card */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
          <CardHeader className="border-b bg-muted/20 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarClock className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Upcoming Departures
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Queued schedule in Manila time
                  </p>
                </div>
              </div>

              <Link
                href="/panel/delivery-schedules"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Schedule view
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-5">
            {!upcomingDeliveries.length ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-muted/10">
                <Clock3 className="mb-2 size-8 text-muted-foreground/60" />
                <h4 className="text-sm font-medium">No departures queued</h4>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Future scheduled deliveries will be listed here with departure countdowns.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {upcomingDeliveries.map((delivery) => {
                  const departure = parseLocalDateTime(
                    delivery.date,
                    delivery.time
                  );
                  return (
                    <li
                      key={delivery.run}
                      className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0"
                    >
                      {/* Date block */}
                      <div
                        aria-hidden="true"
                        className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border bg-muted/40 text-center shadow-2xs"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {departure.toLocaleDateString("en-PH", {
                            month: "short",
                          })}
                        </span>
                        <span className="text-lg font-bold tabular-nums leading-none">
                          {departure.getDate()}
                        </span>
                      </div>

                      {/* Run Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {delivery.run}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                            <Clock3 className="size-3" />
                            {departure.toLocaleTimeString("en-PH", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs font-medium text-foreground/90">
                          {delivery.customer}
                        </p>
                        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{delivery.destination}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>Driver: {delivery.driver}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
export default DeliveryOperations;
