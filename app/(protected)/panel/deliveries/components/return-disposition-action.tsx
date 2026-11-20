"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
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
import { resourceQueryRoots } from "@/lib/realtime";
import { ReturnProofsGallery } from "@/components/return-proofs-gallery";

type ReturnPickupItem = {
  inventoryId?: number;
  name: string;
  qty: number;
};

type ReceivedPickup = {
  id: number;
  orderNumber: string;
  status: string;
  version?: number;
  disposition?: string | null;
  items?: ReturnPickupItem[];
};

export function ReturnDispositionAction({
  pickup,
}: {
  pickup: ReceivedPickup;
}) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [operationKey] = useState(() => crypto.randomUUID());

  const items = pickup.items ?? [];
  const [restockedMap, setRestockedMap] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      items
        .filter((i): i is Required<ReturnPickupItem> => i.inventoryId != null)
        .map((i) => [i.inventoryId, i.qty]),
    ),
  );

  if (pickup.status !== "received" || pickup.disposition) return null;

  async function submit() {
    if (busy || !confirmed || !notes.trim()) return;
    const payloadItems = items
      .filter((i): i is Required<ReturnPickupItem> => i.inventoryId != null)
      .map((item) => {
        const restocked = Math.min(
          item.qty,
          Math.max(0, restockedMap[item.inventoryId] ?? 0),
        );
        return {
          inventoryId: item.inventoryId,
          restockedQty: restocked,
          damagedQty: item.qty - restocked,
        };
      });
    if (!payloadItems.length) return;

    setBusy(true);
    try {
      const response = await request(
        "POST",
        `/api/deliveries/returns/${pickup.id}/dispose`,
        {
          version: pickup.version ?? 1,
          operationKey,
          notes: notes.trim(),
          items: payloadItems,
          confirmed: true,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to record return inspection.");
      }
      toast.success(`Inspection recorded (${data.disposition}).`);
      await Promise.all([
        ...resourceQueryRoots.deliveries.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
        ...resourceQueryRoots.inventory.map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
      ]);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to record return inspection.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" />
        }
      >
        <ClipboardCheck className="mr-1.5 size-3.5" /> Inspect return
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inspect return · {pickup.orderNumber}</DialogTitle>
          <DialogDescription>
            Split physically received units between resellable stock (added back
            to warehouse inventory) and damaged write-offs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {open ? <ReturnProofsGallery returnId={pickup.id} /> : null}
          <div className="divide-y rounded-md border">
            {items.map((item) => {
              const invId = item.inventoryId;
              if (invId == null) return null;
              const restocked = restockedMap[invId] ?? item.qty;
              const damaged = Math.max(0, item.qty - restocked);
              return (
                <div
                  key={invId}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">
                      Total returned: {item.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1">
                      <span>Restock:</span>
                      <Input
                        type="number"
                        min={0}
                        max={item.qty}
                        disabled={busy}
                        className="h-8 w-20 text-xs"
                        value={restocked}
                        onChange={(e) => {
                          const next = Math.min(
                            item.qty,
                            Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          );
                          setRestockedMap((prev) => ({ ...prev, [invId]: next }));
                        }}
                      />
                    </label>
                    <span className="w-24 text-right text-muted-foreground">
                      Damaged: {damaged}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="grid gap-1 text-xs">
            <span className="font-medium">Inspection notes</span>
            <Input
              type="text"
              maxLength={500}
              disabled={busy}
              placeholder="e.g., Seals intact, 2 units crushed in transit"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Confirm physical inspection count. Resellable units will be added to
            warehouse inventory immediately.
          </label>
        </div>

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
            disabled={busy || !confirmed || !notes.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Recording…" : "Save inspection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
