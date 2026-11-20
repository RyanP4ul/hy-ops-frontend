"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { Badge } from "@/components/ui/badge";
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
import { QueryFeedback } from "@/components/query-feedback";

type StockTransfer = {
  id: number;
  transfer_number: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  from_warehouse_name: string;
  to_warehouse_name: string;
  status: "draft" | "in_transit" | "received" | "cancelled";
  notes: string | null;
  version: number;
  items: {
    product_variant_id: number;
    quantity_sent: number;
    sku: string;
    product_name: string;
    variant_name: string;
    unit: string;
  }[];
};

type OptionRow = { id: number; name: string };
type VariantRow = { id: number; sku: string; name?: string };

export function StockTransfersPanel() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const transfers = useQuery<StockTransfer[]>({
    queryKey: ["inventory-transfers"],
    enabled: open,
    queryFn: async () => {
      const res = await request("GET", "/api/inventory/transfers");
      if (!res.ok) throw new Error("Unable to load stock transfers.");
      return res.json();
    },
  });

  const warehouses = useQuery<{ rows: OptionRow[] }>({
    queryKey: ["warehouses-transfer-options"],
    enabled: createOpen,
    queryFn: async () => {
      const res = await request("GET", "/api/warehouses/names?limit=50");
      if (!res.ok) throw new Error("Unable to load warehouses.");
      return res.json();
    },
  });

  const variants = useQuery<{ rows: VariantRow[] }>({
    queryKey: ["variants-transfer-options"],
    enabled: createOpen,
    queryFn: async () => {
      const res = await request("GET", "/api/product_variants?limit=50");
      if (!res.ok) throw new Error("Unable to load product variants.");
      return res.json();
    },
  });

  async function refreshAll() {
    await client.invalidateQueries({
      predicate: (query) =>
        [
          "inventory-transfers",
          "inventory",
          "inventory-summary",
          "inventory-reorder",
          "stock-history",
        ].includes(String(query.queryKey[0])),
    });
  }

  async function createTransfer() {
    if (creating || !fromId || !toId || !variantId || Number(qty) < 1) return;
    setCreating(true);
    try {
      const res = await request("POST", "/api/inventory/transfers", {
        from_warehouse_id: Number(fromId),
        to_warehouse_id: Number(toId),
        notes: notes.trim() || undefined,
        items: [{ product_variant_id: Number(variantId), quantity: Math.floor(Number(qty)) }],
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Unable to create stock transfer.");
      toast.success(`Transfer ${data.transfer_number ?? ""} created.`);
      setCreateOpen(false);
      setNotes("");
      setQty("1");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create stock transfer.");
    } finally {
      setCreating(false);
    }
  }

  async function act(transfer: StockTransfer, action: "dispatch" | "receive" | "cancel") {
    if (busyId !== null) return;
    setBusyId(transfer.id);
    try {
      const res = await request(
        "POST",
        `/api/inventory/transfers/${transfer.id}/${action}`,
        { version: transfer.version },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `Unable to ${action} transfer.`);
      toast.success(`Transfer ${transfer.transfer_number} ${action === "dispatch" ? "dispatched" : action === "receive" ? "received" : "cancelled"}.`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to ${action} transfer.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">
        Inter-warehouse stock transfers
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Move stock between warehouses with full in-transit and movement ledger tracking.
          </p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
              <Plus className="mr-1.5 size-3.5" /> New transfer
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New stock transfer</DialogTitle>
                <DialogDescription>
                  Create a draft transfer from a source warehouse to a destination warehouse.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-xs">
                <label className="grid gap-1">
                  <span className="font-medium">Source warehouse</span>
                  <select
                    className="h-9 rounded-md border bg-background px-2.5"
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                  >
                    <option value="">Select source warehouse</option>
                    {warehouses.data?.rows?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Destination warehouse</span>
                  <select
                    className="h-9 rounded-md border bg-background px-2.5"
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                  >
                    <option value="">Select destination warehouse</option>
                    {warehouses.data?.rows
                      ?.filter((w) => String(w.id) !== fromId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Product variant</span>
                  <select
                    className="h-9 rounded-md border bg-background px-2.5"
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                  >
                    <option value="">Select variant (SKU)</option>
                    {variants.data?.rows?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku} {v.name ? `· ${v.name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Quantity</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Notes (optional)</span>
                  <Input
                    type="text"
                    maxLength={500}
                    placeholder="Reason for rebalancing"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={creating || !fromId || !toId || !variantId || Number(qty) < 1}
                  onClick={() => void createTransfer()}
                >
                  {creating ? "Creating…" : "Create draft"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <QueryFeedback query={transfers} label="stock transfers" />
        {transfers.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No stock transfers recorded yet.</p>
        )}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {transfers.data?.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.transfer_number}</span>
                  <Badge variant="outline" className="capitalize">
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <span>{t.from_warehouse_name}</span>
                  <ArrowRightLeft className="size-3" />
                  <span>{t.to_warehouse_name}</span>
                </p>
                <p className="text-muted-foreground">
                  {t.items.map((i) => `${i.quantity_sent} ${i.unit} ${i.sku}`).join(", ")}
                </p>
              </div>
              <div className="flex gap-1.5">
                {t.status === "draft" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === t.id}
                      onClick={() => void act(t, "dispatch")}
                    >
                      Dispatch
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === t.id}
                      onClick={() => void act(t, "cancel")}
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {t.status === "in_transit" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === t.id}
                    onClick={() => void act(t, "receive")}
                  >
                    Confirm receipt
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
