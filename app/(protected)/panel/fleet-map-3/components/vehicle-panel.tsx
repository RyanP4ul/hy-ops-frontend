import {
  AlertTriangle,
  Crosshair,
  Eye,
  EyeOff,
  Flag,
  LocateFixed,
  Route as RouteIcon,
  Truck,
  User,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarehouseReturnDialog } from "@/components/warehouse-return-dialog";
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
import { EmptyState } from "./empty-state";
import { SignalBadge } from "./signal-badge";
import { StatusBadge } from "./status-badge";
import { StopTimeline } from "./stop-timeline";
import { UpcomingTrips } from "./upcoming-trips";

export type PanelTab = "current" | "upcoming";

type VehiclePanelProps = {
  vehicle: Vehicle;
  warehouse: WarehouseLocation;
  warehouses: WarehouseLocation[];
  position: ResolvedPosition;
  roadRoute: RoadRoute | undefined;
  roadRouteError: boolean;
  enrichmentByStopId: Map<string, StopEnrichment>;
  simulationOn: boolean;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  expandedStopId: string | null;
  onToggleStop: (stopId: string) => void;
  previewTripId: string | null;
  onPreviewTrip: (tripId: string | null) => void;
  followMode: FollowMode;
  onFollowModeChange: (next: FollowMode) => void;
  routesVisible: boolean;
  onToggleRoutesVisible: () => void;
  onRecenter: () => void;
  onFitTrip: () => void;
  onFocusPoint: (coordinates: Coordinates) => void;
  onClose: () => void;
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

export function VehiclePanel({
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
  expandedStopId,
  onToggleStop,
  previewTripId,
  onPreviewTrip,
  followMode,
  onFollowModeChange,
  routesVisible,
  onToggleRoutesVisible,
  onRecenter,
  onFitTrip,
  onFocusPoint,
  onClose,
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
}: VehiclePanelProps) {
  const [returnOpen, setReturnOpen] = useState(false);

  const nextStop = getNextPendingStop(vehicle);
  const total = vehicle.stops.length;
  const percent = total === 0 ? 0 : (vehicle.completedStops / total) * 100;
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
    ? `vehicle status is ${vehicle.blockedReason.replaceAll("_", " ")}`
    : vehicle.status !== "available"
      ? "vehicle is currently on a trip"
      : null;

  const hasExceptions =
    failedStops.length > 0 ||
    (vehicle.status !== "available" &&
      (position.health === "none" || position.health === "stale")) ||
    overdueTrips.length > 0 ||
    (vehicle.pickups?.length ?? 0) > 0 ||
    roadRouteError;

  return (
    <section
      aria-label={`Vehicle ${vehicle.plate} details`}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg"
    >
      {/* 1. Vehicle Identity */}
      <header className="shrink-0 space-y-2.5 border-b p-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: vehicle.color }}
          >
            <Truck className="size-4" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-semibold leading-none tracking-tight sm:text-base">
                {vehicle.plate}
              </h2>
              <StatusBadge status={getOperationalStatusKey(vehicle)} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{vehicle.driver}</span>
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="-mr-1 -mt-1 size-8 shrink-0"
            onClick={onClose}
            aria-label="Close vehicle details"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Home Warehouse */}
        <label className="flex items-center gap-2 text-xs">
          <WarehouseIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="shrink-0 text-muted-foreground">Base:</span>
          {canReassign ? (
            <select
              aria-label="Home warehouse"
              value={vehicle.warehouseId}
              onChange={(event) => onAssignWarehouse(event.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="min-w-0 flex-1 truncate font-medium"
              title="Home base can only be changed while the vehicle is available"
            >
              {warehouse.name}
            </span>
          )}
        </label>

        {/* 2. Tracking / GPS Health */}
        <div className="space-y-1 rounded-lg border bg-muted/30 px-2.5 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SignalBadge position={position} />
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {formatSpeed(position.speedKph)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>
              {position.recordedAt
                ? `Fix time: ${formatManilaClockTime(position.recordedAt)}`
                : position.health === "simulated"
                  ? "Simulated telemetry"
                  : "No GPS fix recorded"}
            </span>
            {position.accuracyM != null ? (
              <span>Accuracy ±{Math.round(position.accuracyM)} m</span>
            ) : null}
            {position.sampleIntervalSeconds != null ? (
              <span>Interval ~{Math.round(position.sampleIntervalSeconds)}s</span>
            ) : null}
          </div>

          {position.health === "stale" ? (
            <p className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
              Showing last known location (not a verified live position).
            </p>
          ) : position.health === "none" ? (
            <p className="text-[11px] text-muted-foreground">
              Map marker shows estimated{" "}
              {vehicle.status === "available"
                ? "warehouse base"
                : "trip progress position"}
              .
            </p>
          ) : null}
        </div>

        {/* 4. Primary Map Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={followMode === "active" ? "default" : "outline"}
            className="h-7 gap-1 px-2 text-xs"
            aria-pressed={followMode === "active"}
            onClick={() =>
              onFollowModeChange(
                followMode === "active" ? "off" : "active",
              )
            }
          >
            <Crosshair className="size-3.5" aria-hidden="true" />
            {followMode === "active"
              ? "Following"
              : followMode === "paused"
                ? "Resume follow"
                : "Follow"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onRecenter}
          >
            <LocateFixed className="size-3.5" aria-hidden="true" />
            Recenter
          </Button>

          {total > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onFitTrip}
            >
              <RouteIcon className="size-3.5" aria-hidden="true" />
              Fit route
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant={routesVisible ? "secondary" : "outline"}
            className="ml-auto h-7 gap-1 px-2 text-xs"
            aria-pressed={routesVisible}
            onClick={onToggleRoutesVisible}
            title={routesVisible ? "Hide road routes" : "Show road routes"}
          >
            {routesVisible ? (
              <Eye className="size-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="size-3.5" aria-hidden="true" />
            )}
            Route
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as PanelTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="mx-3.5 mt-2.5 grid h-8 grid-cols-2">
          <TabsTrigger value="current" className="text-xs">
            Current trip
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 text-xs">
            Upcoming
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {vehicle.scheduledTrips.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="current"
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5"
        >
          {/* 6. Exceptions / Activity */}
          {hasExceptions ? (
            <div className="space-y-2">
              {roadRouteError ? (
                <div
                  role="status"
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <span>Road route geometry unavailable.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={onRetryRoute}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              {failedStops.map(({ stop, enrichment }) => (
                <div
                  key={`fail-${stop.id}`}
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
                >
                  <AlertTriangle
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      Failed stop: {stop.order.id} ({stop.name})
                    </p>
                    {enrichment?.failureReason ? (
                      <p className="mt-0.5 text-[11px]">
                        Reason: {enrichment.failureReason}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

              {vehicle.pickups?.map((pickup) => (
                <div
                  key={`pickup-${pickup.id}`}
                  className="rounded-lg border border-rose-300 bg-rose-50/70 px-2.5 py-2 text-xs dark:border-rose-900 dark:bg-rose-950/40"
                >
                  <p className="font-semibold text-rose-900 dark:text-rose-200">
                    Assigned return pickup · {pickup.orderNumber}
                  </p>
                  <p className="mt-0.5 text-foreground">{pickup.customer}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {pickup.status === "assigned"
                      ? "Driver to confirm collection"
                      : "Collected · awaiting warehouse receipt"}
                  </p>
                </div>
              ))}

              {overdueTrips.length > 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <span>
                    {overdueTrips.length} overdue scheduled trip
                    {overdueTrips.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => onTabChange("upcoming")}
                  >
                    Review
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 3. Current Trip or Deliberate No Active Trip State */}
          {!vehicle.trip || total === 0 ? (
            <EmptyState
              icon={Flag}
              title="No active trip"
              action={
                vehicle.scheduledTrips[0] ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onTabChange("upcoming")}
                  >
                    View upcoming trips ({vehicle.scheduledTrips.length})
                  </Button>
                ) : null
              }
            >
              {vehicle.blockedReason
                ? `This unit is currently marked ${vehicle.blockedReason.replaceAll("_", " ")} at ${warehouse.name}.`
                : vehicle.scheduledTrips[0]
                  ? `${vehicle.scheduledTrips[0].phase === "overdue" ? "Overdue" : "Next up"}: ${vehicle.scheduledTrips[0].label} (${formatSchedule(vehicle.scheduledTrips[0].scheduledAt)}).`
                  : "This vehicle is idle with no active or scheduled trip."}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {vehicle.trip.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled {formatSchedule(vehicle.trip.scheduledAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    {vehicle.completedStops}/{total} stops
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

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    {vehicle.status === "delivering" && nextStop
                      ? `Next stop: ${nextStop.name}`
                      : vehicle.status === "returning"
                        ? `Returning to ${warehouse.name}`
                        : vehicle.status === "delivering"
                          ? vehicle.stops.some(stop => stop.status === "pending")
                            ? "Pending orders skipped for now"
                            : "Return pickups pending"
                          : "Trip completed"}
                  </span>

                  {roadRoute ? (
                    <span
                      className="text-[11px] tabular-nums text-muted-foreground"
                      title="Calculated from OSRM driving route"
                    >
                      Est. drive: {formatDuration(roadRoute.duration)} ·{" "}
                      {formatDistance(roadRoute.distance)}
                    </span>
                  ) : null}
                </div>
              </div>

              {!simulationOn && vehicle.status === "returning" ? (
                <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
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
                    label="Confirm return to warehouse"
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Auto-confirms near {warehouse.name} only with fresh,
                    accurate GPS and no failed stops.
                  </p>
                </div>
              ) : null}

              {/* 5. Delivery Stops */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Delivery stops
                  </h3>
                  <Link
                    href="/panel/deliveries"
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Open Deliveries
                  </Link>
                </div>

                <StopTimeline
                  stops={vehicle.stops}
                  vehicleStatus={vehicle.status}
                  nextStopId={
                    vehicle.status === "delivering" ? nextStop?.id : undefined
                  }
                  expandedId={expandedStopId}
                  enrichmentByStopId={enrichmentByStopId}
                  simulationOn={simulationOn}
                  savingStopId={savingStopId}
                  stopActionError={stopActionError}
                  onToggle={onToggleStop}
                  onFocusStop={onFocusPoint}
                  onConfirmStopDelivered={onConfirmStopDelivered}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="upcoming"
          className="min-h-0 flex-1 overflow-y-auto p-3.5"
        >
          <UpcomingTrips
            trips={vehicle.scheduledTrips}
            previewTripId={previewTripId}
            dispatchBlockedReason={dispatchBlockedReason}
            simulationOn={simulationOn}
            dispatching={dispatching}
            onPreview={onPreviewTrip}
            onDispatch={onDispatch}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
