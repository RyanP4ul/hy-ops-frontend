"use client";

import Link from "next/link";
import { formatCurrency } from "@/utils/date-util";
import {
  ArrowUpRight,
  CircleDollarSign,
  PackageCheck,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useDashboard } from "../../provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  periodBadge?: string;
  icon: LucideIcon;
  href: string;
  actionLabel: string;
  iconBg: string;
  iconColor: string;
  live?: boolean;
};

function ModernStatCard({
  title,
  value,
  subtitle,
  periodBadge,
  icon: Icon,
  href,
  actionLabel,
  iconBg,
  iconColor,
  live = false,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            {periodBadge && (
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] font-normal"
              >
                {periodBadge}
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <h3 className="text-3xl font-bold tracking-tight tabular-nums">
              {value}
            </h3>
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${iconBg} ${iconColor}`}
        >
          <Icon className="size-5.5" />
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {subtitle}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        <span>{actionLabel}</span>
        <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}

export function StatsOverview() {
  const { dashboardQuery } = useDashboard();
  const data = dashboardQuery.data;

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const cashFilters = encodeURIComponent(JSON.stringify({ preset: "mtd" }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ModernStatCard
        title="Monthly Net Cashflow"
        value={formatCurrency(data.revenue)}
        subtitle="Receipts minus customer refunds across all active warehouses"
        periodBadge="Current Month"
        icon={CircleDollarSign}
        href={`/panel/analysis-reports?tab=payments&f=${cashFilters}`}
        actionLabel="Inspect cashflow breakdown"
        iconBg="bg-emerald-500/10 dark:bg-emerald-500/15"
        iconColor="text-emerald-600 dark:text-emerald-400"
      />

      <ModernStatCard
        title="Total Orders"
        value={data.total_orders.toLocaleString()}
        subtitle="Cumulative order count recorded across the operations platform"
        periodBadge="All-time"
        icon={ShoppingBag}
        href="/panel/orders"
        actionLabel="Explore order history"
        iconBg="bg-blue-500/10 dark:bg-blue-500/15"
        iconColor="text-blue-600 dark:text-blue-400"
      />

      <ModernStatCard
        title="Active Deliveries"
        value={data.total_active_deliveries.toLocaleString()}
        subtitle="Vehicles currently scheduled, en route, or returning to hubs"
        live={data.total_active_deliveries > 0}
        icon={Truck}
        href="/panel/deliveries?active=true"
        actionLabel="View active fleet runs"
        iconBg="bg-indigo-500/10 dark:bg-indigo-500/15"
        iconColor="text-indigo-600 dark:text-indigo-400"
      />

      <ModernStatCard
        title="Pending Orders"
        value={data.total_pending.toLocaleString()}
        subtitle="Unfulfilled orders awaiting pick, pack, or dispatch assignment"
        periodBadge="Action Required"
        icon={PackageCheck}
        href="/panel/orders?status=PENDING"
        actionLabel="Fulfill pending orders"
        iconBg="bg-amber-500/10 dark:bg-amber-500/15"
        iconColor="text-amber-600 dark:text-amber-400"
      />
    </div>
  );
}
export default StatsOverview;
