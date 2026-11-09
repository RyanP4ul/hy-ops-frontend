"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Package,
  PackageX,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Exceptions = {
  overdueDeliveries: number;
  pendingOrders: number;
  lowStock: number;
  outOfStock: number;
};

export function OperationalWatchlist() {
  const query = useQuery<Exceptions>({
    queryKey: ["dashboard_query", "exceptions"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/exceptions");
      if (!response.ok) throw new Error("Operational summary unavailable");
      return response.json();
    },
    refetchInterval: 30_000,
  });

  const overdue = query.data?.overdueDeliveries ?? 0;
  const pending = query.data?.pendingOrders ?? 0;
  const low = query.data?.lowStock ?? 0;
  const out = query.data?.outOfStock ?? 0;
  const totalIssues = overdue + pending + low + out;

  const items = [
    {
      title: "Overdue Deliveries",
      key: "overdueDeliveries" as const,
      value: overdue,
      href: "/panel/deliveries?status=scheduled&overdue=true",
      icon: Clock3,
      description: "Past scheduled departure window",
      urgency: overdue > 0 ? "critical" : "nominal",
      actionText: "Triage deliveries",
      accentBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/15",
      borderAccent: overdue > 0 ? "border-rose-500/30 dark:border-rose-500/20" : "",
    },
    {
      title: "Pending Orders",
      key: "pendingOrders" as const,
      value: pending,
      href: "/panel/orders?status=PENDING",
      icon: Package,
      description: "Awaiting warehouse fulfillment",
      urgency: pending > 0 ? "warning" : "nominal",
      actionText: "Process orders",
      accentBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/15",
      borderAccent: pending > 0 ? "border-amber-500/30 dark:border-amber-500/20" : "",
    },
    {
      title: "Low Stock Items",
      key: "lowStock" as const,
      value: low,
      href: "/panel/inventory?stock_status=Low",
      icon: AlertTriangle,
      description: "Below reorder threshold",
      urgency: low > 0 ? "warning" : "nominal",
      actionText: "Review inventory",
      accentBg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 dark:bg-yellow-500/15",
      borderAccent: low > 0 ? "border-yellow-500/30 dark:border-yellow-500/20" : "",
    },
    {
      title: "Out of Stock Items",
      key: "outOfStock" as const,
      value: out,
      href: "/panel/inventory?stock_status=Out",
      icon: PackageX,
      description: "Zero inventory available",
      urgency: out > 0 ? "critical" : "nominal",
      actionText: "Manage stockouts",
      accentBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/15",
      borderAccent: out > 0 ? "border-rose-500/30 dark:border-rose-500/20" : "",
    },
  ];

  return (
    <section
      aria-labelledby="dashboard-watchlist-heading"
      className="overflow-hidden rounded-2xl border bg-card/60 shadow-xs backdrop-blur-sm transition-all"
    >
      <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-8 items-center justify-center rounded-lg ${
              totalIssues > 0
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {totalIssues > 0 ? (
              <AlertCircle className="size-4.5" />
            ) : (
              <CheckCircle2 className="size-4.5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="dashboard-watchlist-heading"
                className="text-sm font-semibold tracking-tight"
              >
                Operational Watchlist & Health
              </h2>
              {query.isPending ? (
                <Skeleton className="h-4 w-16" />
              ) : totalIssues > 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-400"
                >
                  {totalIssues} action {totalIssues === 1 ? "item" : "items"}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                >
                  All streams nominal
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time bottleneck monitoring across all warehouses and fleet routes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-auto">
          <span>Manila Timezone</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            aria-label="Refresh watchlist counts"
          >
            <RefreshCw
              className={`size-3 mr-1 ${
                query.isFetching ? "animate-spin" : ""
              }`}
            />
            {query.isFetching ? "Updating..." : "Refresh"}
          </Button>
        </div>
      </div>

      {query.isError && (
        <div
          role="alert"
          className="mx-5 my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              Watchlist status unavailable.
              {query.data
                ? " Displaying cached values."
                : " Please retry to reload."}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isHighPriority = item.urgency === "critical" && item.value > 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`group relative flex flex-col justify-between p-5 transition-all hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary ${item.borderAccent}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${item.accentBg}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {item.title}
                    </p>
                    {query.isPending ? (
                      <Skeleton className="mt-1 h-7 w-12" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight tabular-nums">
                          {item.value.toLocaleString()}
                        </span>
                        {isHighPriority && (
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground">{item.description}</span>
                <span className="font-medium text-primary inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.actionText}
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
