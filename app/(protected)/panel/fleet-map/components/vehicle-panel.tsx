import {
  Crosshair,
  Flag,
  Maximize2,
  Truck,
  User,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fleetApi } from "../api/fleet.api";
import { fleetKeys } from "../hooks/use-fleet-query";
import { cn } from "@/lib/utils";
import { formatSchedule, formatSpeed } from "../lib/format";
import { getNextPendingStop, isAvailableVehicle } from "../lib/vehicle";
import type {
  PaymentArrangement,
  ResolvedPosition,
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
  simulationOn: boolean;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  expandedStopId: string | null;
  onToggleStop: (stopId: string) => void;
  previewTripId: string | null;
  onPreviewTrip: (tripId: string | null) => void;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  onFitTrip: () => void;
  onClose: () => void;
  onDispatch: (tripId: string) => void;
  onAssignWarehouse: (warehouseId: string) => void;
  onPaymentChange: (orderId: string, arrangement: PaymentArrangement) => void;
};

export function VehiclePanel({
  vehicle,
  warehouse,
  warehouses,
  position,
  simulationOn,
  tab,
  onTabChange,
  expandedStopId,
  onToggleStop,
  previewTripId,
  onPreviewTrip,
  follow,
  onFollowChange,
  onFitTrip,
  onClose,
  onDispatch,
  onAssignWarehouse,
  onPaymentChange,
}: VehiclePanelProps) {
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  async function completeAction() {
    if (saving || simulationOn || !vehicle.trip) return;
    if (vehicle.status === "returning" && !window.confirm("Confirm the vehicle and ALL collected customer returns are physically back at the warehouse. Customer returns will be marked received without automatic restocking. Any failed-delivery goods must also have returned in full and be suitable for resale.")) return;
    setSaving(true); setActionError(null);
    try {
      if (vehicle.status === "returning") await fleetApi.completeDelivery(vehicle.trip.id);
      else if (nextStop) await fleetApi.markStopDelivered(nextStop.id);
      await queryClient.invalidateQueries({ queryKey: fleetKeys.all });
    } catch (error) { setActionError(error instanceof Error ? error.message : "Action failed. Retry after refreshing."); }
    finally { setSaving(false); }
  }
  const nextStop = getNextPendingStop(vehicle);
  const total = vehicle.stops.length;
  const percent = total === 0 ? 0 : (vehicle.completedStops / total) * 100;
  const canReassign = isAvailableVehicle(vehicle);

  const dispatchBlockedReason = vehicle.blockedReason
    ? `vehicle is in ${vehicle.blockedReason}`
    : vehicle.status !== "available"
      ? "vehicle is currently on a trip"
      : null;

  return (
    <section
      aria-label={`Vehicle ${vehicle.plate}`}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl"
    >
      <header className="space-y-3 border-b p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: vehicle.color }}
          >
            <Truck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold leading-none">
                {vehicle.plate}
              </h2>
              <StatusBadge status={vehicle.blockedReason ?? vehicle.status} />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3" />
              {vehicle.driver}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="-mr-2 -mt-1 size-8"
            onClick={onClose}
            aria-label="Close details"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <SignalBadge position={position} />
          {position.sampleIntervalSeconds != null && <span className="text-xs text-muted-foreground">Last observed interval: {Math.round(position.sampleIntervalSeconds)}s</span>}
          {position.accuracyM != null && <span className="text-xs text-muted-foreground">Accuracy: {Math.round(position.accuracyM)}m</span>}
          <span className="text-xs text-muted-foreground">
            {formatSpeed(position.speedKph)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={follow ? "default" : "outline"}
            className="gap-1.5"
            aria-pressed={follow}
            onClick={() => onFollowChange(!follow)}
          >
            <Crosshair className="size-3.5" />
            {follow ? "Following" : "Follow"}
          </Button>
          {total > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onFitTrip}
            >
              <Maximize2 className="size-3.5" />
              Show route
            </Button>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-xs">
          <WarehouseIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-muted-foreground">Home base</span>
          {canReassign ? (
            <select
              value={vehicle.warehouseId}
              onChange={(event) => onAssignWarehouse(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as PanelTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="mx-4 mt-3 grid grid-cols-2">
          <TabsTrigger value="current">Current trip</TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5">
            Upcoming
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {vehicle.scheduledTrips.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="current"
          className={cn("min-h-0 flex-1 overflow-y-auto p-4")}
        >
          {!vehicle.trip || total === 0 ? (
            <EmptyState icon={Flag} title="No active trip">
              {vehicle.scheduledTrips[0]
                ? `${vehicle.scheduledTrips[0].phase === "overdue" ? "Overdue" : "Next up"}: ${vehicle.scheduledTrips[0].label}, ${formatSchedule(vehicle.scheduledTrips[0].scheduledAt)}. See the Upcoming tab.`
                : "This vehicle has no trip right now."}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {vehicle.trip.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled {formatSchedule(vehicle.trip.scheduledAt)}
                    </p>
                  </div>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {vehicle.completedStops} of {total} delivered
                  </p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Trip progress"
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: vehicle.color,
                    }}
                  />
                </div>
                <p className="text-xs">
                  {vehicle.status === "delivering" && nextStop
                    ? `Heading to ${nextStop.name}`
                    : vehicle.status === "returning"
                      ? `Returning to ${warehouse.name}`
                      : "Trip completed"}
                </p>
              </div>

              {!simulationOn && vehicle.status !== "available" && <div className="space-y-2"><Button type="button" size="sm" disabled={saving || (vehicle.status !== "returning" && !nextStop)} onClick={() => void completeAction()}>{saving ? "Saving?" : vehicle.status === "returning" ? "Confirm return to warehouse" : "Mark next stop delivered"}</Button>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}</div>}
              {vehicle.pickups?.map(pickup => <div key={pickup.id} className="rounded-md border border-rose-500/30 p-3 text-sm"><strong>Refunded / {pickup.orderNumber}</strong><p>{pickup.customer}</p><p>{pickup.address}</p><p>{pickup.status === "assigned" ? "Driver to confirm collection" : "Collected / awaiting warehouse receipt"}</p></div>)}
              <StopTimeline
                stops={vehicle.stops}
                nextStopId={
                  vehicle.status === "delivering" ? nextStop?.id : undefined
                }
                expandedId={expandedStopId}
                onToggle={onToggleStop}
                onPaymentChange={onPaymentChange}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="upcoming"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <UpcomingTrips
            trips={vehicle.scheduledTrips}
            previewTripId={previewTripId}
            dispatchBlockedReason={dispatchBlockedReason}
            simulationOn={simulationOn}
            onPreview={onPreviewTrip}
            onDispatch={onDispatch}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
