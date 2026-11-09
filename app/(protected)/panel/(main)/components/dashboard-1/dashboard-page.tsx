"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart2,
  Calendar,
  Compass,
  LayoutDashboard,
  Navigation,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Truck,
} from "lucide-react";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "../../provider";
import { StatsOverview } from "./stats-overview";
import { OperationalWatchlist } from "./operational-watchlist";
import { FleetCalendarHub } from "./fleet-calendar-hub";
import { DeliveryOperations } from "./delivery-operations";
import { BusinessAnalytics } from "./business-analytics";

function DashboardLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard operations..."
      className="space-y-6 motion-reduce:[&_*]:animate-none"
    >
      <span className="sr-only">Loading dashboard operations...</span>

      {/* Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-38 w-full rounded-2xl" />
        ))}
      </div>

      {/* Watchlist Skeleton */}
      <Skeleton className="h-32 w-full rounded-2xl" />

      {/* Fleet & Calendar Skeleton */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[520px] w-full rounded-2xl" />
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      </div>

      {/* Deliveries Skeleton */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>

      {/* Financials Skeleton */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { dashboardQuery } = useDashboard();
  const cache = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "logistics" | "analytics">("all");

  const data = dashboardQuery.data;

  // Manila Current Date
  const manilaDateLabel = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());

  const manilaTimeLabel = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());

  return (
    <main className="min-w-0 bg-background/50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1680px] space-y-7">
        {/* Top Header Banner */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Hub Operations
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3.5" />
                {manilaDateLabel} ({manilaTimeLabel} Manila)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              HYOps Command Center
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Unified real-time logistics monitoring, dispatch calendar schedules, and operational business performance.
            </p>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium rounded-xl"
              disabled={dashboardQuery.isFetching}
              onClick={() => void cache.invalidateQueries({ queryKey: ["dashboard_query"] })}
              aria-label="Refresh dashboard overview data"
            >
              <RefreshCw
                className={`size-3.5 ${
                  dashboardQuery.isFetching ? "animate-spin" : ""
                }`}
              />
              {dashboardQuery.isFetching ? "Refreshing..." : "Sync Overview"}
            </Button>

            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium rounded-xl"
              render={<Link href="/panel/fleet-map" />}
            >
              <Navigation className="size-3.5 text-primary" />
              Live Map
            </Button>

            <Button
              nativeButton={false}
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium rounded-xl shadow-xs"
              render={<Link href="/panel/orders" />}
            >
              <Package className="size-3.5" />
              Manage Orders
            </Button>
          </div>
        </header>

        {/* View Mode Filter Tabs */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/40">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="size-3.5" />
              Command Hub
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("logistics")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "logistics"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="size-3.5" />
              Fleet & Dispatch
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "analytics"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart2 className="size-3.5" />
              Financial & Sales
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-blue-500" />
            <span>Auto-synced with active fleet telematics</span>
          </div>
        </div>

        {/* Query Feedback / Error banner */}
        <QueryFeedback query={dashboardQuery} label="dashboard operations overview" />

        {/* Content Body */}
        {dashboardQuery.isPending ? (
          <DashboardLoadingSkeleton />
        ) : !data ? (
          <div className="space-y-6">
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 p-8 text-center shadow-xs">
              <Package className="mb-3 size-10 text-muted-foreground/50" />
              <h3 className="text-base font-semibold">Dashboard Statistics Unavailable</h3>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                We were unable to load the central operations data. You can retry the connection or navigate directly to orders or delivery runs.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2 text-xs"
                onClick={() => void cache.invalidateQueries({ queryKey: ["dashboard_query"] })}
              >
                <RefreshCw className="size-3.5" />
                Retry Connection
              </Button>
            </div>
            <OperationalWatchlist />
          </div>
        ) : (
          <div className="space-y-7">
            {/* Top KPI Metrics Row */}
            <section aria-label="Key performance indicators">
              <StatsOverview />
            </section>

            {/* Operational Watchlist / Action Items */}
            <OperationalWatchlist />

            {/* Logistics & Fleet Section */}
            {(activeTab === "all" || activeTab === "logistics") && (
              <>
                <FleetCalendarHub deliveryCalendar={data.delivery_calendar ?? []} />
                <DeliveryOperations
                  activeDeliveries={data.active_deliveries ?? []}
                  upcomingDeliveries={data.upcoming_deliveries ?? []}
                />
              </>
            )}

            {/* Financial Intelligence & Products Section */}
            {(activeTab === "all" || activeTab === "analytics") && (
              <BusinessAnalytics
                monthlyRevenue={data.monthly_revenue ?? []}
                dailySales={data.daily_sales ?? []}
                currentRevenue={data.revenue ?? 0}
                topProducts={data.top_selling_products ?? []}
                topCustomers={data.top_customers ?? []}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
