"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Package,
  RotateCcw,
  Truck,
  User,
  Warehouse,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RunActions } from "@/app/(protected)/panel/deliveries/components/run-actions";
import {
  getDeliveryStopStats,
  isDeliveryOverdue,
} from "@/lib/delivery-calendar";
import {
  deliveryStatusLabel,
  type DeliveryCalendarEntry,
} from "@/schema/delivery-calendar";
import { parseLocalDateTime } from "@/utils/date-util";

const STATUS_BADGE_STYLES: Record<DeliveryCalendarEntry["status"], string> = {
  scheduled:
    "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  in_transit:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  returning:
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300",
  completed:
    "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const STOP_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  delivered: {
    label: "Delivered",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  },
  pending: {
    label: "Pending",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
};

export function DeliveryCalendarDetails({
  delivery,
  onClose,
}: {
  delivery: DeliveryCalendarEntry | undefined;
  onClose: () => void;
}) {
  if (!delivery) return null;

  const start = parseLocalDateTime(delivery.date, delivery.start_time);
  const overdue = isDeliveryOverdue(delivery);
  const stats = getDeliveryStopStats(delivery);
  const progressPct =
    stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const isTrackable =
    delivery.status === "in_transit" || delivery.status === "returning";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>Delivery #{delivery.id}</DialogTitle>
            <Badge
              variant="outline"
              className={STATUS_BADGE_STYLES[delivery.status]}
            >
              {deliveryStatusLabel[delivery.status]}
            </Badge>
            {overdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" />
                Overdue
              </Badge>
            )}
          </div>
          <DialogDescription>
            Delivery schedule, stop progress, and dispatch actions.
          </DialogDescription>
        </DialogHeader>

        {overdue && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Scheduled departure time has passed without dispatch. Reschedule
              this run in Deliveries before dispatching.
            </span>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/25 p-3.5 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 items-start gap-2">
            <Clock3
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                Departure (Manila)
              </dt>
              <dd className="break-words font-medium">
                {`${start.toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}, ${start.toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
              </dd>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-2">
            <User
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Driver</dt>
              <dd className="break-words font-medium">{delivery.driver}</dd>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-2">
            <Truck
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Vehicle</dt>
              <dd className="break-words font-medium">{delivery.vehicle}</dd>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-2">
            <Warehouse
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Warehouse</dt>
              <dd className="break-words font-medium">{delivery.warehouse}</dd>
            </div>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          Departure time only. An arrival time has not been provided.
        </p>

        {delivery.pickupCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-900 dark:text-violet-200">
            <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">
              {delivery.pickupCount} return{" "}
              {delivery.pickupCount === 1 ? "pickup" : "pickups"} assigned
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Package className="size-4 text-muted-foreground" aria-hidden="true" />
              Orders ({stats.total})
            </h3>
            {stats.total > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  {stats.delivered}/{stats.total} delivered
                </span>
                {stats.failed > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                    <XCircle className="size-3.5" aria-hidden="true" />
                    {stats.failed} failed
                  </span>
                )}
              </div>
            )}
          </div>

          {stats.total > 0 && (
            <div
              className="h-1.5 w-full overflow-clip rounded-full bg-muted"
              role="progressbar"
              aria-label="Stop delivery progress"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <ol className="max-h-60 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            {delivery.orders.map((order, index) => {
              const stopMeta =
                STOP_STATUS_META[order.status] ?? STOP_STATUS_META.pending;
              return (
                <li
                  key={order.id}
                  className="rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <p className="truncate font-semibold">
                        {order.orderNumber}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${stopMeta.className}`}
                    >
                      {stopMeta.label}
                    </Badge>
                  </div>
                  <p className="mt-1.5 font-medium">
                    {order.recipient || "Recipient unavailable"}
                  </p>
                  <p className="mt-0.5 flex items-start gap-1.5 break-words text-xs text-muted-foreground">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{order.address || "Address unavailable"}</span>
                  </p>
                </li>
              );
            })}
            {delivery.orders.length === 0 && (
              <li className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {delivery.pickupCount
                  ? "Pickup-only run."
                  : "No outbound orders on this run."}
              </li>
            )}
          </ol>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <RunActions
              id={delivery.id}
              status={delivery.status}
              overdue={overdue}
              warehouseName={delivery.warehouse}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isTrackable && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/panel/fleet-map" />}
              >
                <Navigation className="mr-1.5 size-4" aria-hidden="true" />
                Track on Fleet Map
              </Button>
            )}
            <Button
              nativeButton={false}
              render={<Link href="/panel/deliveries" />}
            >
              Open Deliveries
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
