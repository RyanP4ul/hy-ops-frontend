"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { VehicleRow } from "@/schema/vehicle";
import { resourceQueryRoots } from "@/lib/realtime";

type MaintenanceLogRow = {
  id: number;
  maintenance_type: string;
  status: string;
  title: string;
  description: string | null;
  workshop_name: string | null;
  odometer_km: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  put_in_maintenance: boolean;
  expected_return_at: string | null;
  completed_at: string | null;
  version: number;
  created_at: string;
  reported_by_name: string | null;
};

type MaintenanceResponse = {
  vehicle: {
    id: number;
    plate_number: string;
    status: string;
    current_odometer_km: number;
    next_service_odometer_km: number | null;
  };
  summary: {
    total_logs: number;
    open_count: number;
    total_actual_cost: number;
    service_due: boolean;
  };
  rows: MaintenanceLogRow[];
};

const MAINT_TYPES = [
  { value: "preventive", label: "Preventive (PMS)" },
  { value: "repair", label: "Mechanical Repair" },
  { value: "tire_battery", label: "Tire / Battery" },
  { value: "inspection", label: "Safety Inspection" },
  { value: "breakdown", label: "Breakdown" },
] as const;

export function VehicleMaintenanceAction({ vehicle }: { vehicle: VehicleRow }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState<(typeof MAINT_TYPES)[number]["value"]>("repair");
  const [title, setTitle] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [odometer, setOdometer] = useState(String(vehicle.current_odometer_km ?? 0));
  const [estimatedCost, setEstimatedCost] = useState("");
  const [description, setDescription] = useState("");
  const [putInMaintenance, setPutInMaintenance] = useState(vehicle.status !== "on_delivery");

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [actualCost, setActualCost] = useState("");
  const [nextServiceKm, setNextServiceKm] = useState("");

  const logsQuery = useQuery<MaintenanceResponse>({
    queryKey: ["vehicle-maintenance", vehicle.id],
    enabled: open,
    queryFn: async () => {
      const response = await request("GET", `/api/vehicles/${vehicle.id}/maintenance`);
      if (!response.ok) throw new Error("Unable to load maintenance logs.");
      return response.json();
    },
  });

  async function refreshAll() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["vehicle-maintenance", vehicle.id] }),
      ...resourceQueryRoots.vehicles.map((root) =>
        cache.invalidateQueries({ queryKey: [root] }),
      ),
    ]);
  }

  async function createLog() {
    if (busy || !title.trim()) return;
    setBusy(true);
    try {
      const response = await request("POST", `/api/vehicles/${vehicle.id}/maintenance`, {
        maintenance_type: type,
        title: title.trim(),
        description: description.trim() || null,
        workshop_name: workshop.trim() || null,
        odometer_km: odometer.trim() ? Number(odometer) : null,
        estimated_cost: estimatedCost.trim() ? Number(estimatedCost) : null,
        put_in_maintenance: putInMaintenance,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Unable to save maintenance log.");
      toast.success(data.message ?? "Maintenance log added.");
      setTitle("");
      setWorkshop("");
      setEstimatedCost("");
      setDescription("");
      setShowForm(false);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add log.");
    } finally {
      setBusy(false);
    }
  }

  async function completeLog(row: MaintenanceLogRow) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await request(
        "PATCH",
        `/api/vehicles/${vehicle.id}/maintenance/${row.id}`,
        {
          version: row.version,
          status: "completed",
          actual_cost: actualCost.trim() ? Number(actualCost) : row.estimated_cost,
          next_service_odometer_km: nextServiceKm.trim() ? Number(nextServiceKm) : undefined,
          restore_to_available: true,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Unable to complete log.");
      toast.success(data.message ?? "Maintenance completed.");
      setCompletingId(null);
      setActualCost("");
      setNextServiceKm("");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete log.");
    } finally {
      setBusy(false);
    }
  }

  const openBadge = vehicle.open_maintenance_count ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" />
        }
      >
        <ClipboardList className="mr-1.5 size-3.5" aria-hidden="true" />
        Service Log
        {openBadge > 0 ? (
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
            {openBadge}
          </Badge>
        ) : null}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4" />
            Maintenance &amp; Odometer · {vehicle.plate_number}
          </DialogTitle>
          <DialogDescription>
            Track repairs, preventive service intervals, driver-reported issues, and
            odometer readings.
          </DialogDescription>
        </DialogHeader>

        {logsQuery.isPending ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Loading service history…
          </p>
        ) : logsQuery.isError || !logsQuery.data ? (
          <p className="py-6 text-center text-xs text-destructive">
            Unable to load maintenance logs.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Odometer</p>
                <p className="font-semibold tabular-nums">
                  {logsQuery.data.vehicle.current_odometer_km.toLocaleString()} km
                </p>
                {logsQuery.data.vehicle.next_service_odometer_km != null ? (
                  <p
                    className={
                      logsQuery.data.summary.service_due
                        ? "text-[11px] font-medium text-amber-700 dark:text-amber-300"
                        : "text-[11px] text-muted-foreground"
                    }
                  >
                    Next PMS: {logsQuery.data.vehicle.next_service_odometer_km.toLocaleString()} km
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-muted-foreground">Open Tickets</p>
                <p className="font-semibold tabular-nums">
                  {logsQuery.data.summary.open_count} / {logsQuery.data.summary.total_logs}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Logged Cost</p>
                <p className="font-semibold tabular-nums">
                  ₱{logsQuery.data.summary.total_actual_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant={showForm ? "outline" : "default"}
                onClick={() => setShowForm((v) => !v)}
              >
                <Plus className="mr-1.5 size-3.5" />
                {showForm ? "Cancel" : "Log Maintenance"}
              </Button>
            </div>

            {showForm ? (
              <div className="space-y-3 rounded-md border p-3 text-xs">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="font-medium">Type</span>
                    <select
                      className="h-9 rounded-md border bg-background px-2.5 text-xs"
                      value={type}
                      onChange={(e) =>
                        setType(e.target.value as (typeof MAINT_TYPES)[number]["value"])
                      }
                    >
                      {MAINT_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="font-medium">Title / Issue *</span>
                    <Input
                      value={title}
                      placeholder="e.g. 50,000 km Oil Change & Brake Pad Check"
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="font-medium">Workshop / Vendor</span>
                    <Input
                      value={workshop}
                      placeholder="e.g. Rapid Auto Service Center"
                      onChange={(e) => setWorkshop(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="font-medium">Odometer (km)</span>
                    <Input
                      type="number"
                      min={0}
                      value={odometer}
                      onChange={(e) => setOdometer(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="font-medium">Estimated Cost (₱)</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={estimatedCost}
                      placeholder="0.00"
                      onChange={(e) => setEstimatedCost(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input
                      type="checkbox"
                      checked={putInMaintenance}
                      disabled={vehicle.status === "on_delivery"}
                      onChange={(e) => setPutInMaintenance(e.target.checked)}
                    />
                    <span>Set vehicle status to Maintenance</span>
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="font-medium">Notes</span>
                  <Input
                    value={description}
                    placeholder="Optional parts replaced or driver notes"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !title.trim()}
                    onClick={() => void createLog()}
                  >
                    {busy ? "Saving…" : "Save Maintenance Log"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {logsQuery.data.rows.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  No maintenance records yet for this vehicle.
                </p>
              ) : (
                logsQuery.data.rows.map((row) => {
                  const isOpen = row.status === "open" || row.status === "in_progress";
                  return (
                    <div key={row.id} className="space-y-2 p-3 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">
                            {row.title}
                          </p>
                          <p className="text-muted-foreground">
                            {row.maintenance_type.replace(/_/g, " ")}
                            {row.workshop_name ? ` · ${row.workshop_name}` : ""}
                            {row.odometer_km != null
                              ? ` · ${row.odometer_km.toLocaleString()} km`
                              : ""}
                            {row.reported_by_name ? ` · by ${row.reported_by_name}` : ""}
                          </p>
                          {row.description ? (
                            <p className="mt-1 text-muted-foreground">{row.description}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isOpen ? "default" : "secondary"}>
                            {row.status.replace(/_/g, " ")}
                          </Badge>
                          {row.actual_cost != null ? (
                            <span className="font-medium tabular-nums">
                              ₱{row.actual_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : row.estimated_cost != null ? (
                            <span className="text-muted-foreground tabular-nums">
                              Est. ₱{row.estimated_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {isOpen ? (
                        completingId === row.id ? (
                          <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/25 p-2">
                            <label className="grid gap-1">
                              <span className="text-[11px]">Actual Cost (₱)</span>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-8 w-28 text-xs"
                                value={actualCost}
                                placeholder={
                                  row.estimated_cost != null
                                    ? String(row.estimated_cost)
                                    : "0.00"
                                }
                                onChange={(e) => setActualCost(e.target.value)}
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[11px]">Next Service Due (km)</span>
                              <Input
                                type="number"
                                min={0}
                                className="h-8 w-32 text-xs"
                                value={nextServiceKm}
                                placeholder="optional"
                                onChange={(e) => setNextServiceKm(e.target.value)}
                              />
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void completeLog(row)}
                            >
                              <CheckCircle2 className="mr-1 size-3.5" />
                              Complete &amp; Restore
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setCompletingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setCompletingId(row.id);
                                setActualCost(
                                  row.estimated_cost != null ? String(row.estimated_cost) : "",
                                );
                              }}
                            >
                              <CheckCircle2 className="mr-1.5 size-3.5" />
                              Mark Completed
                            </Button>
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
