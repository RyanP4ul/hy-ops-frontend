"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCheck, ClipboardList, Printer } from "lucide-react";
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
import { resourceQueryRoots } from "@/lib/realtime";

type DraftQty = { picked_qty: number; packed_qty: number };

export function PickPackAction({
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
  const [stagingBay, setStagingBay] = useState("");
  const [drafts, setDrafts] = useState<Record<number, DraftQty>>({});
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  const detailQuery = useQuery<OrderDetail>({
    queryKey: ["order-pick-pack", orderId],
    enabled: open,
    queryFn: async () => {
      const response = await request("GET", `/api/orders/${orderId}`);
      if (!response.ok) throw new Error("Unable to load order items.");
      return response.json();
    },
  });

  const order = detailQuery.data;
  const hydrateKey = order ? `${order.id}:${order.version}` : null;
  if (order && hydrateKey && hydratedId !== hydrateKey) {
    setHydratedId(hydrateKey);
    setStagingBay(order.staging_bay ?? "");
    const next: Record<number, DraftQty> = {};
    for (const item of order.items) {
      next[item.id] = {
        picked_qty: item.picked_qty ?? 0,
        packed_qty: item.packed_qty ?? 0,
      };
    }
    setDrafts(next);
  }

  const items = order?.items ?? [];
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPicked = items.reduce((sum, i) => sum + (drafts[i.id]?.picked_qty ?? 0), 0);
  const totalPacked = items.reduce((sum, i) => sum + (drafts[i.id]?.packed_qty ?? 0), 0);
  const allStaged = items.length > 0 && totalPicked === totalQty && totalPacked === totalQty;

  function markAllStaged() {
    const next: Record<number, DraftQty> = {};
    for (const item of items) {
      next[item.id] = { picked_qty: item.quantity, packed_qty: item.quantity };
    }
    setDrafts(next);
  }

  function printPickList() {
    if (!order) return;
    const win = window.open("", "_blank", "width=820,height=700");
    if (!win) {
      toast.error("Allow popups to print the warehouse pick list.");
      return;
    }
    const rowsHtml = order.items
      .map(
        (item) => `
          <tr>
            <td style="padding:8px;border:1px solid #d4d4d8;">${item.product_variant_sku ?? "—"}</td>
            <td style="padding:8px;border:1px solid #d4d4d8;">${item.product_name ?? ""} ${item.product_variant_name ? `(${item.product_variant_name})` : ""}</td>
            <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${item.quantity}</td>
            <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${item.weight_kg != null ? `${(item.weight_kg * item.quantity).toFixed(2)} kg` : "—"}</td>
            <td style="padding:8px;border:1px solid #d4d4d8;text-align:center;">[ &nbsp; ] Picked &nbsp;&nbsp; [ &nbsp; ] Packed</td>
          </tr>
        `,
      )
      .join("");
    win.document.write(`
      <html>
        <head><title>Warehouse Pick List · ${order.order_number}</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#18181b;">
          <h1 style="margin:0 0 4px;">Warehouse Pick &amp; Pack List</h1>
          <p style="margin:0 0 16px;color:#52525b;font-size:13px;">
            <strong>Order:</strong> ${order.order_number} &nbsp;|&nbsp;
            <strong>Warehouse:</strong> ${order.warehouse_name ?? "—"} &nbsp;|&nbsp;
            <strong>Staging Bay:</strong> ${stagingBay.trim() || "Unassigned"} &nbsp;|&nbsp;
            <strong>Customer:</strong> ${order.customer_company || order.customer_name}
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f4f4f5;">
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">SKU</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Item</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Qty</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Est. Weight</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:center;">Verification</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="margin-top:32px;display:flex;justify-content:space-between;font-size:13px;">
            <div>Picked by: _______________________</div>
            <div>Checked / Staged by: _______________________</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  async function save(advanceToScheduling: boolean) {
    if (!order || busy) return;
    setBusy(true);
    try {
      const response = await request("POST", `/api/orders/${order.id}/pick-pack`, {
        version: order.version,
        staging_bay: stagingBay.trim() || null,
        advance_to_scheduling: advanceToScheduling,
        items: items.map((item) => ({
          order_item_id: item.id,
          picked_qty: drafts[item.id]?.picked_qty ?? 0,
          packed_qty: drafts[item.id]?.packed_qty ?? 0,
        })),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to save pick & pack checklist.");
      }
      toast.success(data.message ?? "Checklist saved.");
      await Promise.all(
        resourceQueryRoots.orders.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
      );
      await cache.invalidateQueries({ queryKey: ["order-pick-pack", orderId] });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update checklist.",
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
                  aria-label="Pick, pack and stage order"
                  disabled={disabled}
                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                />
              }
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
            </DialogTrigger>
          }
        />
        <TooltipContent>
          <p>Pick, Pack &amp; Stage for Scheduling</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Pick, Pack &amp; Stage · {order?.order_number || orderNumber || `#${orderId}`}
          </DialogTitle>
          <DialogDescription>
            Verify physical picking and packing quantities before releasing this
            order to delivery scheduling.
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/25 p-3 text-xs">
              <div className="space-y-1">
                <p className="font-medium">
                  Picked: {totalPicked} / {totalQty} · Packed: {totalPacked} / {totalQty}
                </p>
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${allStaged ? "bg-emerald-500" : "bg-blue-500"}`}
                    style={{
                      width: `${totalQty > 0 ? Math.round((totalPacked / totalQty) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={printPickList}
                >
                  <Printer className="mr-1.5 size-3.5" /> Print Pick List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || allStaged}
                  onClick={markAllStaged}
                >
                  <CheckCheck className="mr-1.5 size-3.5" /> Check All
                </Button>
              </div>
            </div>

            <label className="grid gap-1 text-xs">
              <span className="font-medium">Staging Bay / Loading Dock (optional)</span>
              <Input
                value={stagingBay}
                disabled={busy}
                placeholder="e.g. Bay A-2, North Loading Dock"
                maxLength={64}
                onChange={(e) => setStagingBay(e.target.value)}
              />
            </label>

            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {items.map((item) => {
                const draft = drafts[item.id] ?? { picked_qty: 0, packed_qty: 0 };
                const itemDone =
                  draft.picked_qty === item.quantity &&
                  draft.packed_qty === item.quantity;
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
                        SKU: {item.product_variant_sku ?? "—"} · Required:{" "}
                        <span className="font-medium text-foreground">{item.quantity}</span>
                        {item.weight_kg != null
                          ? ` · ${(item.weight_kg * item.quantity).toFixed(1)} kg`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1">
                        <span>Picked:</span>
                        <Input
                          type="number"
                          min={0}
                          max={item.quantity}
                          disabled={busy}
                          className="h-8 w-16 text-xs"
                          value={draft.picked_qty}
                          onChange={(e) => {
                            const picked = Math.min(
                              item.quantity,
                              Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            );
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: {
                                picked_qty: picked,
                                packed_qty: Math.min(prev[item.id]?.packed_qty ?? 0, picked),
                              },
                            }));
                          }}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span>Packed:</span>
                        <Input
                          type="number"
                          min={0}
                          max={draft.picked_qty}
                          disabled={busy}
                          className="h-8 w-16 text-xs"
                          value={draft.packed_qty}
                          onChange={(e) => {
                            const packed = Math.min(
                              draft.picked_qty,
                              Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            );
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: {
                                picked_qty: prev[item.id]?.picked_qty ?? draft.picked_qty,
                                packed_qty: packed,
                              },
                            }));
                          }}
                        />
                      </label>
                      <span
                        className={`w-14 text-right text-[11px] font-medium ${
                          itemDone
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {itemDone ? "Staged" : "Pending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !order}
            onClick={() => void save(false)}
          >
            Save Progress
          </Button>
          <Button
            type="button"
            disabled={busy || !order || !allStaged}
            onClick={() => void save(true)}
          >
            {busy ? "Updating…" : "Confirm Staged & Move to Scheduling"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
