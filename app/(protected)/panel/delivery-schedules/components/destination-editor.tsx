"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { request } from "@/components/http";
import type { DeliveryScheduleRow } from "@/schema/delivery-schedule";

export function DestinationEditor({ order }: { order: DeliveryScheduleRow }) {
  const [open, setOpen] = useState(false);
  const [latitude, setLatitude] = useState(order.shipping_latitude ?? "");
  const [longitude, setLongitude] = useState(order.shipping_longitude ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const [version, setVersion] = useState(order.version);
  const lat = Number(order.shipping_latitude), lon = Number(order.shipping_longitude);
  const ready = order.shipping_latitude != null && order.shipping_longitude != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);
  async function save() {
    if (saving) return;
    if (!latitude.trim() || !longitude.trim()) { setError("Enter both latitude and longitude."); return; }
    setSaving(true); setError("");
    try {
      const response = await request("PUT", `/api/orders/${order.id}/destination`, { version, latitude: Number(latitude), longitude: Number(longitude) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to save destination. Refresh the order and try again.");
      await client.invalidateQueries({ queryKey: ["deliveryScheduleQuery"] });
      await client.invalidateQueries({ queryKey: ["order"] });
      await client.invalidateQueries({ queryKey: ["order_detail"] });
      setOpen(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to confirm destination."); }
    finally { setSaving(false); }
  }
  return <Popover open={open} onOpenChange={(next) => {
    if (next && !open) { setLatitude(order.shipping_latitude ?? ""); setLongitude(order.shipping_longitude ?? ""); setVersion(order.version); setError(""); }
    setOpen(next);
  }}>
    <PopoverTrigger render={<Button variant="outline" size="sm" type="button" />}>{ready ? "Location saved" : "Confirm location"}</PopoverTrigger>
    <PopoverContent className="w-80 space-y-3">
      <p className="font-medium">Confirm order destination</p><p className="text-xs text-muted-foreground">{order.shipping_address}</p>
      <Label htmlFor={`lat-${order.id}`}>Latitude</Label><Input id={`lat-${order.id}`} type="number" min={-90} max={90} step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
      <Label htmlFor={`lon-${order.id}`}>Longitude</Label><Input id={`lon-${order.id}`} type="number" min={-180} max={180} step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save location"}</Button>
    </PopoverContent>
  </Popover>;
}
