"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { request } from "@/components/http";
import { resourceQueryRoots } from "@/lib/realtime";
import type { DeliveriesRow } from "@/schema/deliveries";
import { toast } from "sonner";

export function RefundPickupAction({
  orders,
}: {
  orders: DeliveriesRow["orders"];
}) {
  const eligible = orders.filter(
    (order) =>
      order.status === "delivered" && order.stop_id && !order.return_id,
  );
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);

  const [operationKey, setOperationKey] = useState("");
  const cache = useQueryClient();

  if (!eligible.length) {
    console.log("No eligible orders for refund pickup action", orders);
    return null;
  }
  async function submit() {
    if (!confirmed || !selected || !reason.trim() || busy) return;
    setBusy(true);
    try {
      const response = await request(
        "POST",
        `/api/deliveries/stops/${selected}/refunded`,
        { reason: reason.trim(), operationKey, confirmed: true },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message ?? "Unable to flag this order for pickup.",
        );
      toast.success("Refund flagged. Pickup is now visible on the fleet map.");
      setOpen(false);
      await Promise.all(
        resourceQueryRoots.deliveries.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to request pickup.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setSelected(String(eligible[0].stop_id));
          setReason("");
          setConfirmed(false);
          setOperationKey(crypto.randomUUID());
          setOpen(true);
        }}
      >
        Refunded
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag refund and request pickup</DialogTitle>
            <DialogDescription>
              For goods already received by the customer. This creates a pickup
              request only; it does not issue money or restock goods.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm">
            Delivered order
            <select
              className="min-h-11 rounded-md border bg-background px-3"
              value={selected}
              disabled={busy}
              onChange={(event) => setSelected(event.target.value)}
            >
              {eligible.map((order) => (
                <option key={order.stop_id} value={order.stop_id}>
                  {order.order_number}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Reason
            <textarea
              className="min-h-24 rounded-md border bg-background p-3"
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm the customer received this order and all goods should be
            retrieved. Financial refunds are handled separately.
          </label>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !confirmed || !reason.trim()}
              onClick={() => void submit()}
            >
              {busy ? "Requesting..." : "Confirm pickup request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
