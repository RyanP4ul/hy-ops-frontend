"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/utils/date-util";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "../../(main)/provider";

type Exceptions = {
  overdueDeliveries: number;
  pendingOrders: number;
  lowStock: number;
  outOfStock: number;
};

export function KpiStrip() {
  const { dashboardQuery } = useDashboard();
  const data = dashboardQuery.data;

  if (!data) {
    return (
      <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className={[
              "space-y-3 p-5",
              idx < 3 ? "border-b" : "",
              idx < 2 ? "sm:border-b" : "sm:border-b-0",
              idx % 2 === 0 ? "sm:border-r" : "",
              idx < 3 ? "xl:border-r" : "",
              "xl:border-b-0",
            ].join(" ")}
          >
            <Skeleton className="h-3.5 w-24 motion-reduce:animate-none" />
            <Skeleton className="h-8 w-32 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-20 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    );
  }

  const cashFilters = encodeURIComponent(JSON.stringify({ preset: "mtd" }));

  const metrics = [
    {
      label: "Net cashflow",
      value: formatCurrency(data.revenue),
      meta: "This month",
      href: `/panel/analysis-reports?tab=payments&f=${cashFilters}`,
    },
    {
      label: "Active deliveries",
      value: data.total_active_deliveries.toLocaleString(),
      meta: "Scheduled & in transit",
      href: "/panel/deliveries?active=true",
    },
    {
      label: "Pending orders",
      value: data.total_pending.toLocaleString(),
      meta: "Awaiting processing",
      href: "/panel/orders?status=PENDING",
    },
    {
      label: "Total orders",
      value: data.total_orders.toLocaleString(),
      meta: "All time",
      href: "/panel/orders",
    },
  ];

  return (
    <section
      aria-label="Key metrics"
      className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map((metric, idx) => (
        <Link
          key={metric.label}
          href={metric.href}
          className={[
            "group flex min-w-0 flex-col justify-between p-5 transition-colors hover:bg-muted/35 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            idx < 3 ? "border-b" : "",
            idx < 2 ? "sm:border-b" : "sm:border-b-0",
            idx % 2 === 0 ? "sm:border-r" : "",
            idx < 3 ? "xl:border-r" : "",
            "xl:border-b-0",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {metric.label}
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground"
            />
          </div>

          <p className="mt-2.5 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]">
            {metric.value}
          </p>

          <span className="mt-1.5 text-xs text-muted-foreground">
            {metric.meta}
          </span>
        </Link>
      ))}
    </section>
  );
}

export function AttentionBar() {
  const query = useQuery<Exceptions>({
    queryKey: ["dashboard_query", "exceptions"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/exceptions");
      if (!response.ok) throw new Error("Operational summary unavailable");
      return response.json();
    },
    refetchInterval: 30_000,
  });

  const items = [
    {
      label: "Overdue deliveries",
      key: "overdueDeliveries" as const,
      href: "/panel/deliveries?status=scheduled&overdue=true",
      severity: "critical" as const,
    },
    {
      label: "Pending orders",
      key: "pendingOrders" as const,
      href: "/panel/orders?status=PENDING",
      severity: "warning" as const,
    },
    {
      label: "Low stock",
      key: "lowStock" as const,
      href: "/panel/inventory?stock_status=Low",
      severity: "warning" as const,
    },
    {
      label: "Out of stock",
      key: "outOfStock" as const,
      href: "/panel/inventory?stock_status=Out",
      severity: "critical" as const,
    },
  ];

  return (
    <section aria-label="Needs attention" className="space-y-2.5">
      {query.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2 text-xs text-destructive"
        >
          <span>
            {query.data
              ? "Unable to refresh alert counts. Showing last loaded values."
              : "Unable to load alert counts."}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy={query.isFetching}
      >
        {items.map((item) => {
          const count = query.data?.[item.key];
          const active = count !== undefined && count > 0;
          const isCritical = item.severity === "critical";

          const cardTone = active
            ? isCritical
              ? "border-red-500/45 bg-red-500/[0.08] hover:bg-red-500/[0.13] dark:border-red-500/40 dark:bg-red-500/[0.12] dark:hover:bg-red-500/[0.18]"
              : "border-amber-500/50 bg-amber-500/[0.09] hover:bg-amber-500/[0.15] dark:border-amber-500/40 dark:bg-amber-500/[0.12] dark:hover:bg-amber-500/[0.18]"
            : "border-border bg-card hover:bg-muted/35";

          const barTone = active
            ? isCritical
              ? "bg-red-600 dark:bg-red-500"
              : "bg-amber-500 dark:bg-amber-400"
            : "bg-transparent";

          const countTone = active
            ? isCritical
              ? "text-red-700 dark:text-red-400"
              : "text-amber-800 dark:text-amber-300"
            : "text-muted-foreground/60";

          const labelTone = active
            ? isCritical
              ? "text-red-950 dark:text-red-200"
              : "text-amber-950 dark:text-amber-200"
            : "text-muted-foreground";

          const actionTone = active
            ? isCritical
              ? "text-red-700/80 group-hover:text-red-700 dark:text-red-400/80 dark:group-hover:text-red-300"
              : "text-amber-800/80 group-hover:text-amber-800 dark:text-amber-300/80 dark:group-hover:text-amber-200"
            : "text-muted-foreground/50 group-hover:text-foreground";

          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                "group relative flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                cardTone,
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${barTone}`}
              />

              <div className="min-w-0 pl-1">
                <p className={`truncate text-xs font-medium ${labelTone}`}>
                  {item.label}
                </p>
                {query.isPending ? (
                  <Skeleton className="mt-1.5 h-7 w-10 motion-reduce:animate-none" />
                ) : (
                  <p
                    className={`mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums ${countTone}`}
                  >
                    {count !== undefined ? count.toLocaleString() : "—"}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 text-xs font-medium">
                {active && (
                  <span className={actionTone}>Review</span>
                )}
                <ArrowUpRight
                  aria-hidden="true"
                  className={`size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${actionTone}`}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
