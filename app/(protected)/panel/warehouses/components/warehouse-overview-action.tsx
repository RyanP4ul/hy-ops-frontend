"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Package, Truck, Users } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

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

export function WarehouseOverviewAction({
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Operations overview for ${warehouseName}`}
            title="Operations hub"
          />
        }
      >
        <Building2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{warehouseName} · Operations Hub</DialogTitle>
          <DialogDescription>
            Live snapshot of stationed fleet, personnel, stock alerts, and active dispatches.
          </DialogDescription>
        </DialogHeader>

        <QueryFeedback query={overview} label="warehouse overview" />
        {overview.isPending && !overview.isError && (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            Loading operations hub…
          </p>
        )}

        {overview.data && (
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <section className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <Truck className="size-4" /> Fleet ({overview.data.vehicles.total})
              </div>
              <p className="text-muted-foreground">
                Available: <strong className="text-foreground">{overview.data.vehicles.available}</strong> · On delivery:{" "}
                <strong className="text-foreground">{overview.data.vehicles.on_delivery}</strong> · Maintenance:{" "}
                <strong className="text-foreground">{overview.data.vehicles.maintenance}</strong>
              </p>
            </section>

            <section className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <Users className="size-4" /> Personnel
              </div>
              <p className="text-muted-foreground">
                Staff: <strong className="text-foreground">{overview.data.staff_count}</strong> · Drivers:{" "}
                <strong className="text-foreground">{overview.data.drivers.total}</strong> ({overview.data.drivers.available} available)
              </p>
            </section>

            <section className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <Package className="size-4" /> Inventory ({overview.data.inventory.total_skus} SKUs)
              </div>
              <p className="text-muted-foreground">
                Low stock: <strong className="text-amber-600">{overview.data.inventory.low_stock}</strong> · Out of stock:{" "}
                <strong className="text-destructive">{overview.data.inventory.out_of_stock}</strong>
              </p>
            </section>

            <section className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <Building2 className="size-4" /> Active Dispatches
              </div>
              <p className="text-muted-foreground">
                Scheduled: <strong className="text-foreground">{overview.data.deliveries.scheduled}</strong> · In transit:{" "}
                <strong className="text-foreground">{overview.data.deliveries.in_transit}</strong> · Returning:{" "}
                <strong className="text-foreground">{overview.data.deliveries.returning}</strong>
              </p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
