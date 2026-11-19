"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "../../(main)/provider";
import { AttentionBar, KpiStrip } from "./kpi-strip";
import { FleetMapPanel } from "./fleet-map-panel";
import { CalendarPanel } from "./calendar-panel";
import { DeliveriesSection } from "./deliveries-section";
import { PerformanceSection } from "./performance-section";

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="space-y-5 motion-reduce:[&_*]:animate-none"
    >
      <span className="sr-only">Loading dashboard...</span>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[540px] w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-80 w-full rounded-xl xl:col-span-7" />
        <Skeleton className="h-80 w-full rounded-xl xl:col-span-5" />
      </div>
    </div>
  );
}

export default function DashboardTwo() {
  const { dashboardQuery } = useDashboard();
  const cache = useQueryClient();
  const data = dashboardQuery.data;

  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());

  return (
    <main className="min-w-0 px-4 py-5 md:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1520px] space-y-5">
        {/* Clean, minimal header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <span className="text-xs text-muted-foreground">
              {dateLabel} · Manila
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dashboardQuery.isFetching}
              onClick={() =>
                void cache.invalidateQueries({ queryKey: ["dashboard_query"] })
              }
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-3.5 ${
                  dashboardQuery.isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : ""
                }`}
              />
              {dashboardQuery.isFetching ? "Refreshing" : "Refresh"}
            </Button>

            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/panel/orders" />}
            >
              Orders
            </Button>
          </div>
        </header>

        <QueryFeedback query={dashboardQuery} label="dashboard statistics" />

        {dashboardQuery.isPending ? (
          <DashboardSkeleton />
        ) : !data ? (
          <div className="space-y-5">
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
              <p className="text-sm font-medium">Dashboard unavailable</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Retry above to load statistics, or open orders and deliveries
                from the sidebar.
              </p>
            </div>
            <AttentionBar />
          </div>
        ) : (
          <div className="space-y-5">
            <KpiStrip />
            <AttentionBar />

            {/* Full-bleed Fleet Map + Calendar */}
            <section
              aria-label="Fleet map and delivery calendar"
              className="grid min-w-0 overflow-hidden rounded-xl border bg-card xl:grid-cols-[minmax(0,1fr)_340px]"
            >
              <FleetMapPanel />
              <CalendarPanel events={data.delivery_calendar ?? []} />
            </section>

            {/* Active & upcoming deliveries */}
            <DeliveriesSection
              activeDeliveries={data.active_deliveries ?? []}
              upcomingDeliveries={data.upcoming_deliveries ?? []}
            />

            {/* Cashflow and rankings */}
            <PerformanceSection
              currentRevenue={data.revenue ?? 0}
              monthlyRevenue={data.monthly_revenue ?? []}
              dailySales={data.daily_sales ?? []}
              topProducts={data.top_selling_products ?? []}
              topCustomers={data.top_customers ?? []}
            />
          </div>
        )}
      </div>
    </main>
  );
}
