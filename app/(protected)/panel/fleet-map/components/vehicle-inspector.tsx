import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  LocateFixed,
  Route as RouteIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WarehouseReturnDialog } from "@/components/warehouse-return-dialog";
import { cn } from "@/lib/utils";
import {
  formatDistance,
  formatDuration,
  formatManilaClockTime,
  formatSchedule,
  formatSpeed,
} from "../lib/format";
import type { RoadRoute } from "../lib/road-routing";
import {
  getNextPendingStop,
  getOperationalStatusKey,
  isAvailableVehicle,
} from "../lib/vehicle";
import type {
  Coordinates,
  FollowMode,
  ResolvedPosition,
  StopEnrichment,
  Vehicle,
  WarehouseLocation,
} from "../types";
import { GpsLabel, StatusLabel } from "./status-pill";
import { StopTimeline } from "./stop-timeline";
import { UpcomingTrips } from "./upcoming-trips";

export type InspectorTab = "trip" | "upcoming";

type VehicleInspectorProps = {
  vehicle: Vehicle;
  warehouse: WarehouseLocation;
  warehouses: WarehouseLocation[];
  position: ResolvedPosition;
  roadRoute: RoadRoute | undefined;
  roadRouteError: boolean;
  enrichmentByStopId: Map<string, StopEnrichment>;
  simulationOn: boolean;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  focusedStopId: string | null;
  previewTripId: string | null;
  onPreviewTrip: (tripId: string | null) => void;
  followMode: FollowMode;
  onFollowModeChange: (next: FollowMode) => void;
  onRecenter: () => void;
  onFitTrip: () => void;
  onFocusPoint: (coordinates: Coordinates) => void;
  onClose: () => void;
  onStepPrev?: () => void;
  onStepNext?: () => void;
  showBackLabel?: boolean;
  onDispatch: (tripId: string) => void;
  dispatching: boolean;
  onAssignWarehouse: (warehouseId: string) => void;
  onConfirmStopDelivered: (stopId: string) => Promise<boolean>;
  savingStopId: string | null;
  stopActionError: string | null;
  onCompleteReturn: () => Promise<boolean>;
  completingReturn: boolean;
  returnError: string | null;
  onRetryRoute: () => void;
};

export function VehicleInspector({
  vehicle,
  warehouse,
  warehouses,
  position,
  roadRoute,
  roadRouteError,
  enrichmentByStopId,
  simulationOn,
  tab,
  onTabChange,
  focusedStopId,
  previewTripId,
  onPreviewTrip,
  followMode,
  onFollowModeChange,
  onRecenter,
  onFitTrip,
  onFocusPoint,
  onClose,
  onStepPrev,
  onStepNext,
  showBackLabel = true,
  onDispatch,
  dispatching,
  onAssignWarehouse,
  onConfirmStopDelivered,
  savingStopId,
  stopActionError,
  onCompleteReturn,
  completingReturn,
  returnError,
  onRetryRoute,
}: VehicleInspectorProps) {
  const [returnOpen, setReturnOpen] = useState(false);

  const nextStop = getNextPendingStop(vehicle);
  const totalStops = vehicle.stops.length;
  const percent =
    totalStops === 0 ? 0 : (vehicle.completedStops / totalStops) * 100;
  const canReassign = isAvailableVehicle(vehicle);

  const failedStops = vehicle.stops
    .map((stop) => ({
      stop,
      enrichment: enrichmentByStopId.get(stop.id),
    }))
    .filter((entry) => entry.enrichment?.actualStatus === "failed");

  const overdueTrips = vehicle.scheduledTrips.filter(
    (trip) => trip.phase === "overdue",
  );

  const dispatchBlockedReason = vehicle.blockedReason
    ? vehicle.blockedReason.replaceAll("_", " ")
    : vehicle.status !== "available"
      ? "on active trip"
      : null;

  const hasAlerts =
    failedStops.length > 0 ||
    overdueTrips.length > 0 ||
    (vehicle.pickups?.length ?? 0) > 0 ||
    roadRouteError;

  return (
    <section
      aria-label={`Vehicle ${vehicle.plate}`}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      {/* Navigation strip */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-2.5">
        {showBackLabel ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Fleet
          </button>
        ) : (
          <span className="px-1 text-xs font-medium text-muted-foreground">
            Vehicle details
          </span>
        )}

        <div className="flex items-center gap-0.5">
          {onStepPrev && onStepNext ? (
            <>
              <button
                type="button"
                onClick={onStepPrev}
                aria-label="Previous vehicle"
                title="Previous vehicle"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onStepNext}
                aria-label="Next vehicle"
                title="Next vehicle"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : null}
          {!showBackLabel ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Identity + Telemetry + Map actions */}
      <div className="shrink-0 space-y-3 border-b p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: vehicle.color }}
                aria-hidden="true"
              />
              <h2 className="truncate text-base font-semibold tracking-tight">
                {vehicle.plate}
              </h2>
            </div>
            <p className="mt-0.5 truncate pl-4.5 text-xs text-muted-foreground">
              {vehicle.driver}
            </p>
          </div>
          <StatusLabel
            status={getOperationalStatusKey(vehicle)}
            className="mt-0.5"
          />
        </div>

        {/* Compact key facts grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-muted/35 px-2.5 py-2 text-xs">
          <div>
            <span className="block text-[10px] text-muted-foreground">GPS</span>
            <GpsLabel position={position} className="text-xs" />
          </div>
          <div>
            <span className="block text-[10px] text-muted-foreground">
              Speed
            </span>
            <span className="tabular-nums font-medium">
              {formatSpeed(position.speedKph)}
            </span>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
            <span className="text-[11px] text-muted-foreground">Base</span>
            {canReassign ? (
              <select
                aria-label="Home warehouse"
                value={vehicle.warehouseId}
                onChange={(event) => onAssignWarehouse(event.target.value)}
                className="h-6 max-w-[190px] rounded border bg-background px-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate font-medium text-foreground">
                {warehouse.name}
              </span>
            )}
          </div>
          {position.recordedAt ? (
            <div className="col-span-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Last fix</span>
              <span className="tabular-nums">
                {formatManilaClockTime(position.recordedAt)}
                {position.accuracyM != null
                  ? ` · ±${Math.round(position.accuracyM)} m`
                  : ""}
              </span>
            </div>
          ) : null}
        </div>

        {/* Map camera controls */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={followMode === "active" ? "default" : "outline"}
            className="h-7 flex-1 gap-1.5 px-2 text-xs"
            aria-pressed={followMode === "active"}
            onClick={() =>
              onFollowModeChange(followMode === "active" ? "off" : "active")
            }
          >
            <Crosshair className="size-3.5" aria-hidden="true" />
            {followMode === "active"
              ? "Following"
              : followMode === "paused"
                ? "Resume"
                : "Follow"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={onRecenter}
          >
            <LocateFixed className="size-3.5" aria-hidden="true" />
            Center
          </Button>
          {totalStops > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={onFitTrip}
            >
              <RouteIcon className="size-3.5" aria-hidden="true" />
              Route
            </Button>
          ) : null}
        </div>
      </div>

      {/* Subtle underline tab bar */}
      <div
        role="tablist"
        aria-label="Vehicle sections"
        className="flex shrink-0 border-b px-3"
      >
        {(
          [
            { id: "trip", label: "Current trip", count: totalStops || null },
            {
              id: "upcoming",
              label: "Upcoming",
              count: vehicle.scheduledTrips.length,
            },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "relative flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors",
                active
                  ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{item.label}</span>
              {item.count !== null ? (
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div className="fm-scroller min-h-0 flex-1 p-3">
        {tab === "trip" ? (
          <div className="space-y-3">
            {hasAlerts ? (
              <div className="space-y-1.5 text-xs">
                {roadRouteError ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/80 px-2.5 py-1.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    <span>Route unavailable</span>
                    <button
                      type="button"
                      onClick={onRetryRoute}
                      className="font-semibold underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {failedStops.map(({ stop, enrichment }) => (
                  <div
                    key={`fail-${stop.id}`}
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-destructive"
                  >
                    <p className="font-medium">
                      Failed · {stop.order.id} ({stop.name})
                    </p>
                    {enrichment?.failureReason ? (
                      <p className="mt-0.5 text-[11px] opacity-90">
                        {enrichment.failureReason}
                      </p>
                    ) : null}
                  </div>
                ))}

                {vehicle.pickups?.map((pickup) => (
                  <div
                    key={`pickup-${pickup.id}`}
                    className="rounded-md border border-rose-300 bg-rose-50/70 px-2.5 py-1.5 dark:border-rose-900 dark:bg-rose-950/40"
                  >
                    <p className="font-medium text-rose-900 dark:text-rose-200">
                      Return pickup · {pickup.orderNumber}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {pickup.customer} ·{" "}
                      {pickup.status === "assigned"
                        ? "Pending collection"
                        : "Collected"}
                    </p>
                  </div>
                ))}

                {overdueTrips.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/80 px-2.5 py-1.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <span>
                      {overdueTrips.length} overdue{" "}
                      {overdueTrips.length === 1 ? "trip" : "trips"}
                    </span>
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => onTabChange("upcoming")}
                    >
                      View
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!vehicle.trip || totalStops === 0 ? (
              <div className="space-y-2.5 py-6 text-center">
                <p className="text-xs font-medium text-foreground">
                  No active trip
                </p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.blockedReason
                    ? `Marked ${vehicle.blockedReason.replaceAll("_", " ")} at ${warehouse.name}.`
                    : vehicle.scheduledTrips[0]
                      ? `Next: ${vehicle.scheduledTrips[0].label} (${formatSchedule(vehicle.scheduledTrips[0].scheduledAt)})`
                      : `Idle at ${warehouse.name}.`}
                </p>
                {vehicle.scheduledTrips.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onTabChange("upcoming")}
                  >
                    View upcoming ({vehicle.scheduledTrips.length})
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active trip progress summary */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {vehicle.trip.label}
                    </p>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                      {vehicle.completedStops}/{totalStops}
                    </span>
                  </div>

                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={Math.round(percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Trip progress"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {vehicle.status === "delivering" && nextStop
                        ? `Next: ${nextStop.name}`
                        : vehicle.status === "returning"
                          ? `Returning to ${warehouse.name}`
                          : vehicle.status === "delivering"
                            ? "Stops skipped"
                            : "Completed"}
                    </span>
                    {roadRoute ? (
                      <span className="shrink-0 tabular-nums">
                        {formatDuration(roadRoute.duration)} ·{" "}
                        {formatDistance(roadRoute.distance)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {!simulationOn && vehicle.status === "returning" ? (
                  <WarehouseReturnDialog
                    key={vehicle.trip?.id}
                    open={returnOpen}
                    onOpenChange={setReturnOpen}
                    busy={completingReturn}
                    onConfirm={async () => {
                      if (await onCompleteReturn()) setReturnOpen(false);
                    }}
                    error={returnError}
                    warehouseName={warehouse.name}
                    label="Confirm warehouse return"
                  />
                ) : null}

                {/* Stops list */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Stops
                    </span>
                    <Link
                      href="/panel/deliveries"
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Deliveries
                    </Link>
                  </div>

                  <StopTimeline
                    stops={vehicle.stops}
                    vehicleStatus={vehicle.status}
                    nextStopId={
                      vehicle.status === "delivering" ? nextStop?.id : undefined
                    }
                    focusedStopId={focusedStopId}
                    enrichmentByStopId={enrichmentByStopId}
                    simulationOn={simulationOn}
                    savingStopId={savingStopId}
                    stopActionError={stopActionError}
                    onFocusStop={onFocusPoint}
                    onConfirmStopDelivered={onConfirmStopDelivered}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <UpcomingTrips
            trips={vehicle.scheduledTrips}
            previewTripId={previewTripId}
            dispatchBlockedReason={dispatchBlockedReason}
            simulationOn={simulationOn}
            dispatching={dispatching}
            onPreview={onPreviewTrip}
            onDispatch={onDispatch}
          />
        )}
      </div>
    </section>
  );
}
