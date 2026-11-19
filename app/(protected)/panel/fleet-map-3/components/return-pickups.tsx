"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resourceQueryRoots } from "@/lib/realtime";
import { EmptyState } from "./empty-state";

export type ReturnPickup = {
  id: number;
  orderNumber: string;
  customer: string;
  address: string;
  reason: string;
  status: string;
  version: number;
  deliveryId: number | null;
  coordinates: [number, number] | null;
  items: { name: string; qty: number }[];
};

type Candidates = {
  vehicles: {
    id: number;
    plate: string;
    driverId: number | null;
    driverName: string | null;
    distanceKm: number | null;
  }[];
  drivers: { id: number; name: string }[];
};

async function get<T>(path: string): Promise<T> {
  const response = await request("GET", path);
  if (!response.ok) {
    throw new Error("Unable to load return pickups. Try again.");
  }
  return response.json();
}

export function useReturnPickups() {
  return useQuery({
    queryKey: ["customer-return-pickups"],
    queryFn: () => get<ReturnPickup[]>("/api/deliveries/returns"),
    refetchInterval: 20_000,
  });
}

export function ReturnPickups({
  tasks,
  onFocus,
}: {
  tasks: ReturnPickup[];
  onFocus: (point: [number, number]) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const task = tasks.find((item) => item.id === selected);

  return (
    <>
      <div className="space-y-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Return pickups ({tasks.length})
          </h2>
        </div>

        {tasks.length === 0 ? (
          <EmptyState icon={RotateCcw} title="No pending return pickups">
            Customer return retrieval requests will appear here when issued.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {tasks.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setSelected(item.id);
                    if (item.coordinates) onFocus(item.coordinates);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-semibold">
                      {item.orderNumber}
                    </strong>
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                      {item.status === "requested"
                        ? "Awaiting assignment"
                        : item.status === "assigned"
                          ? "Pickup assigned"
                          : "Collected"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-foreground">
                    {item.customer}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    {item.coordinates ? item.address : "No coordinates on file"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {task ? (
        <AssignPickup
          key={task.id}
          task={task}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function AssignPickup({
  task,
  onClose,
}: {
  task: ReturnPickup;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());

  const candidates = useQuery({
    queryKey: ["customer-return-candidates", task.id],
    queryFn: () =>
      get<Candidates>(`/api/deliveries/returns/${task.id}/candidates`),
    enabled: task.status === "requested",
  });

  const vehicle = candidates.data?.vehicles.find(
    (item) => String(item.id) === vehicleId,
  );

  async function assign() {
    if (!vehicle || !confirmed || busy || !(vehicle.driverId || driverId)) {
      return;
    }
    setBusy(true);
    try {
      const response = await request(
        "POST",
        `/api/deliveries/returns/${task.id}/assign`,
        {
          version: task.version,
          vehicleId: vehicle.id,
          driverId: vehicle.driverId ?? Number(driverId),
          operationKey: key,
          confirmed: true,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.message ?? "Unable to assign pickup. Refresh before retrying.",
        );
      }
      toast.success("Pickup assigned. The driver will receive the updated trip.");
      await Promise.all(
        resourceQueryRoots.deliveries.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to assign pickup.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Refunded order pickup: {task.orderNumber}</DialogTitle>
          <DialogDescription>
            Arrange retrieval of all goods. This does not record a financial
            refund or add stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{task.customer}</p>
          <p className="text-muted-foreground">{task.address}</p>
          <p className="text-xs">Reason: {task.reason}</p>
        </div>
        <ul className="divide-y rounded-md border bg-muted/20 text-xs">
          {task.items.map((item, index) => (
            <li key={index} className="px-3 py-1.5">
              {item.qty} × {item.name}
            </li>
          ))}
        </ul>

        {task.status !== "requested" ? (
          <p className="rounded-md border bg-muted/30 p-3 text-sm">
            {task.status === "assigned"
              ? "Assigned for collection"
              : "Collected; awaiting warehouse receipt"}{" "}
            · Delivery #{task.deliveryId}
          </p>
        ) : (
          <>
            {candidates.isPending ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading eligible vehicles…
              </p>
            ) : null}
            {candidates.isError ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void candidates.refetch()}
              >
                Retry vehicles
              </Button>
            ) : null}
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Vehicle (same warehouse)</span>
              <select
                disabled={busy}
                className="min-h-10 rounded-md border bg-background px-2.5 text-sm"
                value={vehicleId}
                onChange={(event) => {
                  setVehicleId(event.target.value);
                  setDriverId("");
                  setConfirmed(false);
                }}
              >
                <option value="">Select vehicle</option>
                {candidates.data?.vehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.plate} ·{" "}
                    {item.distanceKm === null
                      ? "No recent GPS"
                      : `approx. ${item.distanceKm.toFixed(1)} km`}{" "}
                    · {item.driverName ?? "Available"}
                  </option>
                ))}
              </select>
            </label>
            {candidates.data?.vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible vehicles in this warehouse.
              </p>
            ) : null}
            {vehicle && !vehicle.driverId ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Driver</span>
                <select
                  aria-label="Driver"
                  disabled={busy}
                  className="min-h-10 rounded-md border bg-background px-2.5 text-sm"
                  value={driverId}
                  onChange={(event) => setDriverId(event.target.value)}
                >
                  <option value="">Select available driver</option>
                  {candidates.data?.drivers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {vehicle?.driverId ? (
              <p className="text-xs text-muted-foreground">
                Current driver: {vehicle.driverName}. Pickup is added to this
                active trip.
              </p>
            ) : null}
            <label className="flex items-start gap-2.5 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Confirm this vehicle and driver should retrieve all goods from
              the customer.
            </label>
            <Button
              disabled={
                busy ||
                !vehicle ||
                !confirmed ||
                !(vehicle.driverId || driverId)
              }
              onClick={() => void assign()}
            >
              {busy ? "Assigning…" : "Confirm pickup assignment"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
