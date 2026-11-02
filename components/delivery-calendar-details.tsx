"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deliveryStatusLabel, type DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import { parseLocalDateTime } from "@/utils/date-util";

export function DeliveryCalendarDetails({ delivery, onClose }: { delivery: DeliveryCalendarEntry | undefined; onClose: () => void }) {
  if (!delivery) return null;
  const start = parseLocalDateTime(delivery.date, delivery.start_time);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-lg">
    <DialogHeader><DialogTitle>Delivery #{delivery.id}</DialogTitle><DialogDescription>Delivery schedule and assignment. Manage changes in Deliveries.</DialogDescription></DialogHeader>
    <dl className="grid grid-cols-2 gap-4 text-sm">
      {[["Status", deliveryStatusLabel[delivery.status]], ["Departure (Manila)", `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}, ${start.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`], ["Driver", delivery.driver], ["Vehicle", delivery.vehicle], ["Warehouse", delivery.warehouse]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}
    </dl>
    <p className="text-xs text-muted-foreground">Departure time only. An arrival time has not been provided.</p>
    {delivery.pickupCount > 0 && <p className="text-sm">{delivery.pickupCount} return {delivery.pickupCount === 1 ? "pickup" : "pickups"}</p>}
    <div className="max-h-60 space-y-3 overflow-y-auto"><h3 className="text-sm font-semibold">Orders ({delivery.orders.length})</h3>
      {delivery.orders.map(order => <div key={order.id} className="border-t pt-2 text-sm"><p className="font-medium">{order.orderNumber}</p><p>{order.recipient || "Recipient unavailable"}</p><p className="break-words text-muted-foreground">{order.address || "Address unavailable"}</p></div>)}
      {delivery.orders.length === 0 && <p className="text-sm text-muted-foreground">{delivery.pickupCount ? "Pickup-only run." : "No outbound orders on this run."}</p>}
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button nativeButton={false} render={<Link href="/panel/deliveries" />}>Open Deliveries</Button></DialogFooter>
  </DialogContent></Dialog>;
}
