"use client";

import { Button } from "@/components/ui/button";
import { useSetting } from "@/components/providers/setting-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function WarehouseReturnDialog({ open, onOpenChange, busy, onConfirm, error, label = "Confirm warehouse return", warehouseName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: () => Promise<void>;
  error?: string | null;
  label?: string;
  warehouseName?: string;
}) {
  const { settingQuery } = useSetting();
  const radius = settingQuery.data?.returning_automatic_confirm_ms_interval?.value ?? "100";
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogTrigger render={<Button type="button" variant="outline" disabled={busy} />}>{label}</DialogTrigger>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Confirm return to warehouse</DialogTitle>
          <DialogDescription>
            Confirm the vehicle and all collected customer returns have physically reached {warehouseName ?? "the assigned warehouse"}.
            Customer returns will be marked received for inspection, without automatic restocking.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">All goods from failed delivery stops must have returned in full and be suitable for resale. Confirming restores and reserves those goods for rescheduling. If goods are missing or damaged, cancel and contact an administrator.</p>
        <p className="text-xs text-muted-foreground">Returns are automatically confirmed within {radius} metres of the assigned warehouse when a fresh, accurate GPS update is available. Runs with failed deliveries require manual confirmation.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={() => void onConfirm()}>{busy ? "Confirming…" : "Confirm warehouse return"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
