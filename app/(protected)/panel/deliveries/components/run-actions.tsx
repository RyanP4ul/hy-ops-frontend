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
  DialogTrigger,
} from "@/components/ui/dialog";
import { request } from "@/components/http";
import { resourceQueryRoots } from "@/lib/realtime";
import { toast } from "sonner";

export function RunActions({ id, status, overdue }: { id: number; status: string; overdue?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  if (status !== "scheduled" && status !== "returning") return null;
  async function act() {
    if (busy || (status === "scheduled" && overdue)) return;
    const completing = status === "returning";
    if (completing && !window.confirm("Confirm the vehicle is back and ALL collected customer returns have physically reached the warehouse. Customer returns are recorded as received, without automatic restocking. Also confirm ALL goods from failed stops have physically returned in full and are suitable for resale. This restores and reserves those goods for rescheduling. If goods are missing or damaged, cancel and contact an administrator.")) return;
    setBusy(true);
    try {
      const response = await request("POST", `/api/deliveries/${id}/${completing ? "complete" : "dispatch"}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Unable to confirm delivery action. Refresh before retrying.");
      toast.success(completing ? "Warehouse return confirmed" : "Delivery dispatched");
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to confirm delivery action"); }
    finally {
      await Promise.all(resourceQueryRoots.deliveries.map(root => cache.invalidateQueries({ queryKey: [root] })));
      setBusy(false);
    }
  }
  if (status === "returning") {
    return (
      <Button variant="outline" disabled={busy} onClick={act}>
        {busy ? "Confirming…" : "Confirm warehouse return"}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogTrigger render={<Button type="button" variant="outline" disabled={busy || overdue} />}>
        Dispatch
      </DialogTrigger>
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
          <Button type="button" disabled={busy || overdue} onClick={act}>
            {busy ? "Dispatching…" : "Dispatch delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
