"use client";

import { Truck, Warehouse } from "lucide-react";
import type { TableAction } from "@/components/table-actions";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { request } from "@/components/http";
import { resourceQueryRoots } from "@/lib/realtime";
import { toast } from "sonner";
import { WarehouseReturnDialog, type CodCollectionInput } from "@/components/warehouse-return-dialog";

type RunActionProps = { id: number; status: string; overdue?: boolean; warehouseName?: string };

export function RunActions(props: RunActionProps) {
  return useRunAction(props, true)?.dialog ?? null;
}

export function useRunAction({ id, status, overdue, warehouseName }: RunActionProps, showTrigger = false) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cache = useQueryClient();
  if (status !== "scheduled" && status !== "returning") return null;
  async function act(codCollections?: CodCollectionInput[]) {
    if (busy || (status === "scheduled" && overdue)) return;
    const completing = status === "returning";
    setActionError(null);
    setBusy(true);
    try {
      const response = await request(
        "POST",
        `/api/deliveries/${id}/${completing ? "complete" : "dispatch"}`,
        completing && codCollections?.length ? { codCollections } : undefined,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Unable to confirm delivery action. Refresh before retrying.");
      toast.success(completing ? "Warehouse return confirmed" : "Delivery dispatched");
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to confirm delivery action";
      setActionError(message);
      toast.error(message);
    }
    finally {
      await Promise.all([
        ...resourceQueryRoots.deliveries.map(root => cache.invalidateQueries({ queryKey: [root] })),
        ...resourceQueryRoots.payments.map(root => cache.invalidateQueries({ queryKey: [root] })),
      ]);
      setBusy(false);
    }
  }
  if (status === "returning") {
    const action: TableAction = {
      label: "Confirm warehouse return",
      icon: Warehouse,
      busy,
      onClick: () => {
        setActionError(null);
        setOpen(true);
      },
    };
    const dialog = (
      <WarehouseReturnDialog
        open={open}
        showTrigger={showTrigger}
        onOpenChange={(value) => {
          if (value) setActionError(null);
          setOpen(value);
        }}
        busy={busy}
        onConfirm={act}
        error={actionError}
        warehouseName={warehouseName}
        deliveryId={id}
      />
    );
    return { action, dialog };
  }

  const action: TableAction = {
    label: "Dispatch",
    icon: Truck,
    busy,
    disabled: overdue,
    tooltip: overdue ? "Reschedule the overdue delivery before dispatching." : undefined,
    onClick: () => setOpen(true),
  };
  const dialog = (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      {showTrigger && (
        <DialogTrigger render={<Button type="button" variant="outline" disabled={busy || overdue} />}>
          Dispatch
        </DialogTrigger>
      )}
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Dispatch delivery</DialogTitle>
          <DialogDescription>
            Dispatch delivery #{id}? This consumes the reserved stock and makes
            the run active in the driver&apos;s app.
          </DialogDescription>
        </DialogHeader>
        {overdue && (
          <p role="alert" className="text-sm text-destructive">
            This delivery is overdue. Reschedule it before dispatching.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || overdue} onClick={() => void act()}>
            {busy ? "Dispatching…" : "Dispatch delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { action, dialog };
}
