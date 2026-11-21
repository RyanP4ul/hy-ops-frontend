"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crosshair,
  ExternalLink,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { request } from "@/components/http";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAgo } from "../lib/format";

export type LiveLalamoveStop = {
  id: number;
  order_id: number;
  order_number: string;
  order_status: string;
  stop_index: number;
  recipient_name: string;
  dropoff_address: string;
  pod_status: string | null;
  delivered_at: string | null;
  coordinates: [number, number] | null;
};

export type LiveLalamoveCourier = {
  booking_id: number;
  lalamove_order_id: string | null;
  status: string;
  booking_state: string;
  service_type: string | null;
  stop_count: number;
  is_route_optimized: boolean;
  order_id: number | null;
  order_number: string | null;
  share_link: string | null;
  last_synced_at: string | null;
  picked_up_at: string | null;
  driver: {
    id: string | null;
    name: string | null;
    phone: string | null;
    plate_number: string | null;
    coordinates: {
      lat: number;
      lng: number;
      updated_at: string | null;
    } | null;
  };
  pickup: {
    warehouse_id: number | null;
    name: string | null;
    address: string;
    coordinates: [number, number] | null;
  };
  stops: LiveLalamoveStop[];
};

async function fetchLiveLalamove(): Promise<LiveLalamoveCourier[]> {
  const response = await request("GET", "/api/lalamove/live");
  if (!response.ok) {
    throw new Error("Unable to load active Lalamove couriers.");
  }
  return response.json();
}

export function useLalamoveCouriers(enabled: boolean) {
  return useQuery({
    queryKey: ["lalamove", "live"],
    queryFn: fetchLiveLalamove,
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

function lalamoveStatusLabel(status: string, bookingState: string) {
  if (["UNKNOWN", "REVIEW"].includes(bookingState)) return "Needs review";
  switch (status) {
    case "PICKED_UP":
      return "In transit";
    case "ON_GOING":
      return "Assigned";
    case "ASSIGNING_DRIVER":
      return "Matching";
    default:
      return status.replace(/_/g, " ");
  }
}

export function LalamoveCouriersList({
  couriers,
  selectedId,
  now,
  onSelect,
}: {
  couriers: LiveLalamoveCourier[];
  selectedId: number | null;
  now: number;
  onSelect: (courier: LiveLalamoveCourier) => void;
}) {
  if (couriers.length === 0) {
    return (
      <div className="space-y-2 px-4 py-10 text-center text-xs text-muted-foreground">
        <p>No active Lalamove couriers right now.</p>
        <Link
          href="/panel/lalamove?mode=multi-stop"
          className="inline-flex items-center gap-1 font-medium text-orange-700 underline-offset-4 hover:underline dark:text-orange-400"
        >
          Book Lalamove multi-stop
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {couriers.map((courier) => {
        const selected = courier.booking_id === selectedId;
        const hasGps = Boolean(courier.driver.coordinates);
        const updatedMs = courier.driver.coordinates?.updated_at
          ? Date.parse(courier.driver.coordinates.updated_at)
          : courier.last_synced_at
            ? Date.parse(courier.last_synced_at)
            : NaN;
        const ageMs = Number.isFinite(updatedMs) ? Math.max(0, now - updatedMs) : null;
        const title =
          courier.stop_count > 1
            ? `${courier.order_number || `Booking #${courier.booking_id}`} +${courier.stop_count - 1}`
            : courier.order_number || `Booking #${courier.booking_id}`;

        return (
          <li key={courier.booking_id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(courier)}
              className={cn(
                "w-full px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                selected && "bg-orange-500/10",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground">
                  {title}
                </span>
                <span className="shrink-0 rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400">
                  {lalamoveStatusLabel(courier.status, courier.booking_state)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-foreground/90">
                {courier.driver.name || "Waiting for driver"}
                {courier.driver.plate_number
                  ? ` · ${courier.driver.plate_number}`
                  : ""}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {courier.stop_count}{" "}
                  {courier.stop_count === 1 ? "stop" : "stops"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    hasGps
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  <Navigation className="size-2.5" aria-hidden="true" />
                  {hasGps
                    ? ageMs !== null
                      ? `Live · ${formatAgo(ageMs)}`
                      : "Live GPS"
                    : "No GPS yet"}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LalamoveCourierInspector({
  courier,
  now,
  refreshing,
  onClose,
  onLocate,
  onRefresh,
}: {
  courier: LiveLalamoveCourier;
  now: number;
  refreshing: boolean;
  onClose: () => void;
  onLocate: (point: [number, number]) => void;
  onRefresh: () => void;
}) {
  const detailHref =
    courier.stop_count > 1
      ? `/panel/lalamove?bookingId=${courier.booking_id}`
      : `/panel/lalamove?orderId=${courier.order_id ?? ""}`;
  const driverPoint: [number, number] | null = courier.driver.coordinates
    ? [courier.driver.coordinates.lng, courier.driver.coordinates.lat]
    : null;
  const updatedMs = courier.driver.coordinates?.updated_at
    ? Date.parse(courier.driver.coordinates.updated_at)
    : courier.last_synced_at
      ? Date.parse(courier.last_synced_at)
      : NaN;
  const ageMs = Number.isFinite(updatedMs) ? Math.max(0, now - updatedMs) : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back
        </button>
        <div className="flex items-center gap-1.5">
          {driverPoint && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onLocate(driverPoint)}
            >
              <Crosshair className="size-3" aria-hidden="true" />
              Locate
            </Button>
          )}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={refreshing}
            onClick={onRefresh}
            aria-label="Refresh Lalamove courier location"
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>

      <div className="fm-scroller min-h-0 flex-1 space-y-4 p-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Lalamove
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Booking #{courier.booking_id}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {courier.driver.name || "Assigning courier"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {courier.driver.plate_number || courier.service_type || "External courier"}
            {courier.driver.phone ? ` · ${courier.driver.phone}` : ""}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/25 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-foreground">
              {lalamoveStatusLabel(courier.status, courier.booking_state)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">GPS fix</span>
            <span
              className={cn(
                "font-medium tabular-nums",
                driverPoint
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {driverPoint
                ? ageMs !== null
                  ? `Live (${formatAgo(ageMs)})`
                  : "Live"
                : "Unavailable yet"}
            </span>
          </div>
          {courier.driver.coordinates && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Coordinates</span>
              <span className="font-mono text-[11px] tabular-nums text-foreground">
                {courier.driver.coordinates.lat.toFixed(5)},{" "}
                {courier.driver.coordinates.lng.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {/* Pickup & Stops */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Route ({courier.stops.length || courier.stop_count}{" "}
            {(courier.stops.length || courier.stop_count) === 1
              ? "stop"
              : "stops"}
            )
          </p>
          <div className="rounded-lg border bg-background p-2.5 text-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Pickup
            </p>
            <p className="mt-0.5 font-medium text-foreground">
              {courier.pickup.name || "Warehouse"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-muted-foreground">
              {courier.pickup.address}
            </p>
          </div>

          <ol className="space-y-2">
            {courier.stops.map((stop) => {
              const delivered =
                Boolean(stop.delivered_at) ||
                stop.pod_status === "DELIVERED" ||
                stop.pod_status === "SIGNED" ||
                stop.order_status === "COMPLETED";
              return (
                <li
                  key={stop.id}
                  className="rounded-lg border bg-background p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      #{stop.stop_index} · {stop.order_number}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium",
                        delivered
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {delivered ? (
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                      ) : (
                        <Clock className="size-3" aria-hidden="true" />
                      )}
                      {delivered ? "Delivered" : "Pending"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-foreground/90">
                    {stop.recipient_name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                    {stop.dropoff_address}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href={detailHref}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full")}
          >
            Open in Lalamove workspace
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          {courier.share_link && (
            <a
              href={courier.share_link}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ size: "sm" }),
                "w-full bg-orange-600 text-white hover:bg-orange-700",
              )}
            >
              Open Lalamove share link
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
