"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ReturnProofsGallery } from "@/components/return-proofs-gallery";

export type ReturnPickup = {
  id: number;
  orderNumber: string;
  customer: string;
  address: string;
  reason: string;
  failureReason?: string | null;
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
    throw new Error("Unable to load return pickups.");
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

export function ReturnPickupsList({
  tasks,
  onFocus,
}: {
  tasks: ReturnPickup[];
  onFocus: (point: [number, number]) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const task = tasks.find((item) => item.id === selected);

  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-xs text-muted-foreground">
        No pending return pickups.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border/60">
        {tasks.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => {
                setSelected(item.id);
                if (item.coordinates) onFocus(item.coordinates);
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {item.orderNumber}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                  {item.status === "requested"
                    ? "Unassigned"
                    : item.status === "assigned"
                      ? "Assigned"
                      : item.status === "failed"
                        ? "Failed"
                        : "Collected"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-foreground/90">
                {item.customer}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {item.coordinates ? item.address : "No coordinates"}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {task ? (
        <AssignPickupDialog
          key={task.id}
          task={task}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

export function AssignPickupDialog({
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
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
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

  async function invalidateDeliveries() {
    await Promise.all(
      resourceQueryRoots.deliveries.map((root) =>
        cache.invalidateQueries({ queryKey: [root] }),
      ),
    );
  }

  async function unassign() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await request(
        "POST",
        `/api/deliveries/returns/${task.id}/unassign`,
        { version: task.version },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to unassign pickup.");
      }
      toast.success("Pickup returned to unassigned queue.");
      await invalidateDeliveries();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to unassign pickup.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (busy || !cancelReason.trim()) return;
    setBusy(true);
    try {
      const response = await request(
        "POST",
        `/api/deliveries/returns/${task.id}/cancel`,
        {
          version: task.version,
          reason: cancelReason.trim(),
          confirmed: true,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to cancel pickup request.");
      }
      toast.success("Return pickup request cancelled.");
      await invalidateDeliveries();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to cancel pickup request.",
      );
    } finally {
      setBusy(false);
    }
  }

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
        throw new Error(data.message ?? "Unable to assign pickup.");
      }
      toast.success("Return pickup assigned.");
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return pickup · {task.orderNumber}</DialogTitle>
          <DialogDescription>
            Assign retrieval of returned goods. Does not refund or restock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-xs">
          <p className="font-semibold text-foreground">{task.customer}</p>
          <p className="text-muted-foreground">{task.address}</p>
          <p className="text-muted-foreground">Reason: {task.reason}</p>
        </div>

        <ul className="divide-y rounded-md border bg-muted/20 text-xs">
          {task.items.map((item, index) => (
            <li key={index} className="px-3 py-1.5">
              {item.qty} × {item.name}
            </li>
          ))}
        </ul>

        {task.status !== "requested" ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/25 p-3 text-xs space-y-1">
              <p>
                {task.status === "assigned"
                  ? "Assigned for collection"
                  : task.status === "failed"
                    ? "Collection attempt failed"
                    : "Collected · awaiting warehouse receipt"}{" "}
                · Delivery #{task.deliveryId}
              </p>
              {task.failureReason ? (
                <p className="text-rose-700 dark:text-rose-300">
                  Driver note: {task.failureReason}
                </p>
              ) : null}
            </div>

            {task.status === "collected" || task.status === "received" ? (
              <ReturnProofsGallery returnId={task.id} />
            ) : null}

            {task.status === "assigned" || task.status === "failed" ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => void unassign()}
              >
                {busy
                  ? "Updating…"
                  : task.status === "failed"
                    ? "Return to queue for reassignment"
                    : "Unassign pickup"}
              </Button>
            ) : null}

            {task.status === "failed" ? (
              cancelMode ? (
                <div className="space-y-2 rounded-md border p-3 text-xs">
                  <label className="grid gap-1">
                    <span className="font-medium">Cancellation reason</span>
                    <input
                      type="text"
                      disabled={busy}
                      className="h-9 rounded-md border bg-background px-2.5 text-xs"
                      value={cancelReason}
                      placeholder="Explain why retrieval is cancelled"
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={busy || !cancelReason.trim()}
                      onClick={() => void cancelRequest()}
                    >
                      Confirm cancellation
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setCancelMode(false)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-rose-700 hover:text-rose-700 dark:text-rose-300"
                  disabled={busy}
                  onClick={() => setCancelMode(true)}
                >
                  Cancel return request
                </Button>
              )
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.isPending ? (
              <p role="status" className="text-xs text-muted-foreground">
                Loading vehicles…
              </p>
            ) : null}

            {candidates.isError ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void candidates.refetch()}
              >
                Retry
              </Button>
            ) : null}

            <label className="grid gap-1 text-xs">
              <span className="font-medium">Vehicle</span>
              <select
                disabled={busy}
                className="h-9 rounded-md border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      ? "No GPS"
                      : `${item.distanceKm.toFixed(1)} km`}{" "}
                    · {item.driverName ?? "Available"}
                  </option>
                ))}
              </select>
            </label>

            {candidates.data?.vehicles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No eligible vehicles in this warehouse.
              </p>
            ) : null}

            {vehicle && !vehicle.driverId ? (
              <label className="grid gap-1 text-xs">
                <span className="font-medium">Driver</span>
                <select
                  aria-label="Driver"
                  disabled={busy}
                  className="h-9 rounded-md border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={driverId}
                  onChange={(event) => setDriverId(event.target.value)}
                >
                  <option value="">Select driver</option>
                  {candidates.data?.drivers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {vehicle?.driverId ? (
              <p className="text-[11px] text-muted-foreground">
                Driver: {vehicle.driverName}. Added to active trip.
              </p>
            ) : null}

            <label className="flex items-start gap-2 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Confirm pickup assignment for all listed goods.
            </label>

            <Button
              size="sm"
              className="w-full"
              disabled={
                busy ||
                !vehicle ||
                !confirmed ||
                !(vehicle.driverId || driverId)
              }
              onClick={() => void assign()}
            >
              {busy ? "Assigning…" : "Assign pickup"}
            </Button>

            {cancelMode ? (
              <div className="space-y-2 rounded-md border p-3 text-xs">
                <label className="grid gap-1">
                  <span className="font-medium">Cancellation reason</span>
                  <input
                    type="text"
                    disabled={busy}
                    className="h-9 rounded-md border bg-background px-2.5 text-xs"
                    value={cancelReason}
                    placeholder="Explain why retrieval is cancelled"
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={busy || !cancelReason.trim()}
                    onClick={() => void cancelRequest()}
                  >
                    Confirm cancellation
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setCancelMode(false)}
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-rose-700 hover:text-rose-700 dark:text-rose-300"
                disabled={busy}
                onClick={() => setCancelMode(true)}
              >
                Cancel return request
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
