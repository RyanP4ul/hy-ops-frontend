"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitFork } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrderDetail } from "@/schema/order";
import { formatCurrency } from "@/utils/date-util";
import { resourceQueryRoots } from "@/lib/realtime";

export function SplitOrderAction({
  orderId,
  orderNumber,
  disabled,
}: {
  orderId: number;
  orderNumber?: string;
  disabled?: boolean;
}) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [splitMap, setSplitMap] = useState<Record<number, number>>({});
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const detailQuery = useQuery<OrderDetail>({
    queryKey: ["order-split", orderId],
    enabled: open,
    queryFn: async () => {
      const response = await request("GET", `/api/orders/${orderId}`);
      if (!response.ok) throw new Error("Unable to load order items.");
      return response.json();
    },
  });

  const order = detailQuery.data;
  const currentKey = order ? `${order.id}:${order.version}` : null;
  if (order && currentKey && hydratedKey !== currentKey) {
    setHydratedKey(currentKey);
    setSplitMap(Object.fromEntries(order.items.map((item) => [item.id, 0])));
  }

  const items = order?.items ?? [];
  let keepQty = 0;
  let moveQty = 0;
  let keepWeight = 0;
  let moveWeight = 0;
  let keepValue = 0;
  let moveValue = 0;

  for (const item of items) {
    const move = Math.min(item.quantity, Math.max(0, splitMap[item.id] ?? 0));
    const keep = item.quantity - move;
    keepQty += keep;
    moveQty += move;
    const unitW = item.weight_kg ?? 0;
    const unitP = item.price ?? 0;
    keepWeight += keep * unitW;
    moveWeight += move * unitW;
    keepValue += keep * unitP;
    moveValue += move * unitP;
  }

  const canSplit = keepQty > 0 && moveQty > 0;

  function splitHalf() {
    const next: Record<number, number> = {};
    for (const item of items) {
      next[item.id] = Math.floor(item.quantity / 2);
    }
    const moved = Object.values(next).reduce((a, b) => a + b, 0);
    if (moved === 0 && items.length > 1) {
      next[items[items.length - 1].id] = items[items.length - 1].quantity;
    }
    setSplitMap(next);
  }

  async function submit() {
    if (!order || busy || !canSplit) return;
    setBusy(true);
    try {
      const response = await request("POST", `/api/orders/${order.id}/split`, {
        version: order.version,
        reason: reason.trim() || null,
        items: items.map((item) => ({
          order_item_id: item.id,
          split_quantity: Math.min(item.quantity, Math.max(0, splitMap[item.id] ?? 0)),
        })),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to split order.");
      }
      toast.success(data.message ?? "Shipment split created.");
      await Promise.all([
        ...resourceQueryRoots.orders.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
        ...resourceQueryRoots.payments.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
      ]);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to split order.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Split shipment across trucks"
                  disabled={disabled}
                />
              }
            >
              <GitFork className="size-4" aria-hidden="true" />
            </DialogTrigger>
          }
        />
        <TooltipContent>
          <p>Split Shipment Across Trucks</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="size-4" />
            Split Shipment · {order?.order_number || orderNumber || `#${orderId}`}
          </DialogTitle>
          <DialogDescription>
            Move selected quantities into an independent child shipment so they
            can be dispatched on separate trucks while preserving stock
            reservations and proportional payments.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isPending ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Loading order items…
          </p>
        ) : detailQuery.isError || !order ? (
          <p className="py-6 text-center text-xs text-destructive">
            Unable to load order items.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-0.5">
                <p className="font-semibold text-foreground">
                  Shipment 1 (Keep on {order.order_number})
                </p>
                <p className="text-muted-foreground">
                  {keepQty} unit(s) · {keepWeight.toFixed(1)} kg ·{" "}
                  {formatCurrency(keepValue)}
                </p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs space-y-0.5 dark:border-blue-900 dark:bg-blue-950/30">
                <p className="font-semibold text-foreground">
                  Shipment 2 (New Independent Shipment)
                </p>
                <p className="text-muted-foreground">
                  {moveQty} unit(s) · {moveWeight.toFixed(1)} kg ·{" "}
                  {formatCurrency(moveValue)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Choose how many units of each item to move to Shipment 2.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={splitHalf}
              >
                Split 50 / 50
              </Button>
            </div>

            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {items.map((item) => {
                const move = splitMap[item.id] ?? 0;
                const keep = Math.max(0, item.quantity - move);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {item.product_name ? `${item.product_name} — ` : ""}
                        {item.product_variant_name}
                      </p>
                      <p className="text-muted-foreground">
                        Ordered: {item.quantity} · Keep: {keep}
                        {item.weight_kg != null
                          ? ` · ${item.weight_kg} kg/unit`
                          : ""}
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5">
                      <span>Move to S2:</span>
                      <Input
                        type="number"
                        min={0}
                        max={item.quantity}
                        disabled={busy}
                        className="h-8 w-20 text-xs"
                        value={move}
                        onChange={(e) => {
                          const next = Math.min(
                            item.quantity,
                            Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          );
                          setSplitMap((prev) => ({ ...prev, [item.id]: next }));
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <label className="grid gap-1 text-xs">
              <span className="font-medium">Split reason (optional)</span>
              <Input
                value={reason}
                disabled={busy}
                placeholder="e.g. Exceeds 2,000 kg payload capacity of Truck A"
                maxLength={255}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !canSplit}
            onClick={() => void submit()}
          >
            {busy ? "Splitting…" : "Create Split Shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
