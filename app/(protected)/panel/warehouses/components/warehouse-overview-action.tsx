"use client";

import type { TableAction } from "@/components/table-actions";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Package, RefreshCw, Truck, Users } from "lucide-react";
import { request } from "@/components/http";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type WarehouseOverview = {
  warehouse: {
    id: number;
    name: string;
    street_address: string;
    city: string;
    state: string;
    daily_order_limit: number | null;
    arrival_radius_m: number | null;
    operating_days: number[] | null;
  };
  vehicles: {
    total: number;
    available: number;
    on_delivery: number;
    maintenance: number;
  };
  drivers: { total: number; available: number; on_delivery: number };
  staff_count: number;
  inventory: { total_skus: number; low_stock: number; out_of_stock: number };
  deliveries: { scheduled: number; in_transit: number; returning: number };
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatOperatingDays(days: number[] | null) {
  const list = [...new Set(days ?? [1, 2, 3, 4, 5, 6])]
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => a - b);

  if (list.length === 7) return "Open daily";
  if (list.length === 0) return null;

  const isContiguous = list.every((day, idx) => idx === 0 || day === list[idx - 1] + 1);
  if (isContiguous && list.length >= 3) {
    return `${DAY_NAMES[list[0]]}–${DAY_NAMES[list[list.length - 1]]}`;
  }

  return list.map((day) => DAY_NAMES[day]).join(", ");
}

function MetricRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "info" | "warning" | "danger";
}) {
  const valueTone =
    value === 0
      ? "text-muted-foreground"
      : {
          default: "text-foreground",
          positive: "text-emerald-700 dark:text-emerald-400",
          info: "text-blue-700 dark:text-blue-400",
          warning: "text-amber-800 dark:text-amber-300",
          danger: "text-destructive",
        }[tone];

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", valueTone)}>
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function HubSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading operations hub"
      className="grid gap-3 sm:grid-cols-2"
    >
      {[0, 1, 2, 3].map((idx) => (
        <div key={idx} className="space-y-4 rounded-xl border p-4">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
            <Skeleton className="h-7 w-10 motion-reduce:animate-none" />
          </div>
          <div className="space-y-2.5 border-t pt-3">
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function useWarehouseOverview({
  warehouseId,
  warehouseName,
}: {
  warehouseId: number;
  warehouseName: string;
}) {
  const [open, setOpen] = useState(false);
  const overview = useQuery<WarehouseOverview>({
    queryKey: ["warehouse-overview", warehouseId],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const res = await request("GET", `/api/warehouses/${warehouseId}/overview`);
      if (!res.ok) throw new Error("Unable to load warehouse hub overview.");
      return res.json();
    },
  });

  const action: TableAction = {
    label: "Operations hub",
    icon: Building2,
    ariaLabel: `Operations hub for ${warehouseName}`,
    onClick: () => setOpen(true),
  };

  const data = overview.data;
  const location = data
    ? [data.warehouse.street_address, data.warehouse.city, data.warehouse.state]
        .filter(Boolean)
        .join(", ")
    : "";
  const healthySkus = data
    ? Math.max(0, data.inventory.total_skus - data.inventory.low_stock - data.inventory.out_of_stock)
    : 0;
  const totalTeam = data ? data.staff_count + data.drivers.total : 0;
  const activeDeliveries = data
    ? data.deliveries.scheduled + data.deliveries.in_transit + data.deliveries.returning
    : 0;
  const scheduleSummary = data ? formatOperatingDays(data.warehouse.operating_days) : null;
  const footerNotes = data
    ? [
        scheduleSummary,
        data.warehouse.daily_order_limit != null
          ? `Daily limit: ${data.warehouse.daily_order_limit.toLocaleString()} orders`
          : null,
      ].filter(Boolean)
    : [];

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {warehouseName}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {location || "Operations overview"}
          </DialogDescription>
        </DialogHeader>

        <QueryFeedback query={overview} label="warehouse overview" />
        {overview.isPending && !overview.isError && <HubSkeleton />}

        {data && (
          <div className="space-y-4">
            <div className="grid gap-3.5 sm:grid-cols-2">
              {/* Fleet */}
              <section className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Truck className="size-4" aria-hidden="true" />
                    Fleet
                  </h3>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {data.vehicles.total.toLocaleString()}
                  </span>
                </div>
                <dl className="divide-y border-t pt-1.5">
                  <MetricRow label="Available" value={data.vehicles.available} tone="positive" />
                  <MetricRow label="On delivery" value={data.vehicles.on_delivery} tone="info" />
                  <MetricRow label="Maintenance" value={data.vehicles.maintenance} tone="warning" />
                </dl>
              </section>

              {/* Team */}
              <section className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="size-4" aria-hidden="true" />
                    Team
                  </h3>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {totalTeam.toLocaleString()}
                  </span>
                </div>
                <dl className="divide-y border-t pt-1.5">
                  <MetricRow label="Staff" value={data.staff_count} />
                  <MetricRow label="Drivers ready" value={data.drivers.available} tone="positive" />
                  <MetricRow label="Drivers on route" value={data.drivers.on_delivery} tone="info" />
                </dl>
              </section>

              {/* Inventory */}
              <section className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Package className="size-4" aria-hidden="true" />
                    Inventory
                  </h3>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {data.inventory.total_skus.toLocaleString()}
                  </span>
                </div>
                <dl className="divide-y border-t pt-1.5">
                  <MetricRow label="In stock" value={healthySkus} tone="positive" />
                  <MetricRow label="Low stock" value={data.inventory.low_stock} tone="warning" />
                  <MetricRow label="Out of stock" value={data.inventory.out_of_stock} tone="danger" />
                </dl>
              </section>

              {/* Deliveries */}
              <section className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Building2 className="size-4" aria-hidden="true" />
                    Deliveries
                  </h3>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {activeDeliveries.toLocaleString()}
                  </span>
                </div>
                <dl className="divide-y border-t pt-1.5">
                  <MetricRow label="Scheduled" value={data.deliveries.scheduled} />
                  <MetricRow label="In transit" value={data.deliveries.in_transit} tone="info" />
                  <MetricRow label="Returning" value={data.deliveries.returning} />
                </dl>
              </section>
            </div>

            {footerNotes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {footerNotes.join(" · ")}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="-mx-5 -mb-5 items-center justify-between sm:-mx-6 sm:-mb-6 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
            disabled={overview.isFetching}
            onClick={() => void overview.refetch()}
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                overview.isFetching && "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden="true"
            />
            {overview.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { action, dialog };
}
