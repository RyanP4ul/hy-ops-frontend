"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resourceQueryRoots } from "@/lib/realtime";
import { toast } from "sonner";

export type ReturnPickup = { id: number; orderNumber: string; customer: string; address: string; reason: string; status: string; version: number; deliveryId: number | null; coordinates: [number, number] | null; items: { name: string; qty: number }[] };
type Candidates = { vehicles: { id: number; plate: string; driverId: number | null; driverName: string | null; distanceKm: number | null }[]; drivers: { id: number; name: string }[] };
async function get<T>(path: string): Promise<T> {
  const response = await request("GET", path);
  if (!response.ok) throw new Error("Unable to load return pickups. Try again.");
  return response.json();
}
export function useReturnPickups() {
  return useQuery({ queryKey: ["customer-return-pickups"], queryFn: () => get<ReturnPickup[]>("/api/deliveries/returns"), refetchInterval: 20000 });
}
export function ReturnPickups({ tasks, onFocus }: { tasks: ReturnPickup[]; onFocus: (point: [number, number]) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const task = tasks.find(item => item.id === selected);
  return <>
    <div className="space-y-3 p-3">
      <h2 className="text-sm font-semibold">Refunded / return pickups ({tasks.length})</h2>
      {tasks.length === 0 && <p className="pt-3 text-sm text-muted-foreground">No pending returns.</p>}
      {tasks.map(item => <button key={item.id} className="mt-2 block w-full rounded border p-3 text-left text-sm hover:bg-muted" onClick={() => { setSelected(item.id); if (item.coordinates) onFocus(item.coordinates); }}><strong>{item.orderNumber}</strong><br />{item.customer}<br /><span className="text-muted-foreground">{item.status === "requested" ? "Awaiting pickup assignment" : item.status === "assigned" ? "Pickup assigned" : "Collected / returning"}{!item.coordinates && " / No coordinates"}</span></button>)}
    </div>
    {task && <AssignPickup key={task.id} task={task} onClose={() => setSelected(null)} />}
  </>;
}
function AssignPickup({ task, onClose }: { task: ReturnPickup; onClose: () => void }) {
  const cache = useQueryClient();
  const [vehicleId, setVehicleId] = useState(""), [driverId, setDriverId] = useState(""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const candidates = useQuery({ queryKey: ["customer-return-candidates", task.id], queryFn: () => get<Candidates>(`/api/deliveries/returns/${task.id}/candidates`), enabled: task.status === "requested" });
  const vehicle = candidates.data?.vehicles.find(item => String(item.id) === vehicleId);
  async function assign() {
    if (!vehicle || !confirmed || busy || !(vehicle.driverId || driverId)) return;
    setBusy(true);
    try {
      const response = await request("POST", `/api/deliveries/returns/${task.id}/assign`, { version: task.version, vehicleId: vehicle.id, driverId: vehicle.driverId ?? Number(driverId), operationKey: key, confirmed: true });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Unable to assign pickup. Refresh before retrying.");
      toast.success("Pickup assigned. The driver will receive the updated trip.");
      await Promise.all(resourceQueryRoots.deliveries.map(root => cache.invalidateQueries({ queryKey: [root] })));
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to assign pickup."); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90vh] overflow-auto">
    <DialogHeader><DialogTitle>Refunded: {task.orderNumber}</DialogTitle><DialogDescription>Arrange retrieval of all goods. This does not record a financial refund or add stock.</DialogDescription></DialogHeader>
    <p className="text-sm"><strong>{task.customer}</strong><br />{task.address}<br />Reason: {task.reason}</p>
    <ul className="text-sm">{task.items.map((item, index) => <li key={index}>{item.qty} × {item.name}</li>)}</ul>
    {task.status !== "requested" ? <p className="text-sm">{task.status === "assigned" ? "Assigned for collection" : "Collected; awaiting warehouse receipt"} / Delivery {task.deliveryId}</p> : <>
      {candidates.isPending && <p role="status">Loading available vehicles...</p>}
      {candidates.isError && <Button variant="outline" onClick={() => void candidates.refetch()}>Retry vehicles</Button>}
      <label className="grid gap-2 text-sm">Vehicle (same warehouse)<select disabled={busy} className="min-h-11 rounded border bg-background px-2" value={vehicleId} onChange={event => { setVehicleId(event.target.value); setDriverId(""); setConfirmed(false); }}><option value="">Select vehicle</option>{candidates.data?.vehicles.map(item => <option key={item.id} value={item.id}>{item.plate} / {item.distanceKm === null ? "No recent GPS" : `approx. ${item.distanceKm.toFixed(1)} km`} / {item.driverName ?? "Available"}</option>)}</select></label>
      {candidates.data?.vehicles.length === 0 && <p className="text-sm">No eligible vehicles in this warehouse.</p>}
      {vehicle && !vehicle.driverId && <label className="grid gap-2 text-sm">Driver<select aria-label="Driver" disabled={busy} className="min-h-11 rounded border bg-background px-2" value={driverId} onChange={event => setDriverId(event.target.value)}><option value="">Select available driver</option>{candidates.data?.drivers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {vehicle?.driverId && <p className="text-sm">Current driver: {vehicle.driverName}. Pickup is added to this active trip.</p>}
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />Confirm this vehicle and driver should retrieve all goods from the customer.</label>
      <Button disabled={busy || !vehicle || !confirmed || !(vehicle.driverId || driverId)} onClick={() => void assign()}>{busy ? "Assigning..." : "Confirm pickup assignment"}</Button>
    </>}
  </DialogContent></Dialog>;
}
