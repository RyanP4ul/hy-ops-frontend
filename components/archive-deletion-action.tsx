"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ArchiveTable } from "@/schema/archives";

const dateLabel = (seconds: number) => new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

export function ArchiveDeletionDate({ record }: { record: ArchiveTable }) {
  return <div className="max-w-72 space-y-1 whitespace-normal text-sm">
    {record.delete_after != null
      ? <time dateTime={new Date(record.delete_after * 1000).toISOString()}>{dateLabel(record.delete_after)}</time>
      : <span className="text-muted-foreground">Not scheduled</span>}
    {record.deletion_error && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{record.deletion_error}</p>}
  </div>;
}

export function ArchiveDeletionAction({ record }: { record: ArchiveTable }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [estimate, setEstimate] = useState(0);
  const deletion = useMutation({
    mutationFn: async () => {
      const response = await request("DELETE", `/api/archives/${record.id}`);
      const result = await response.json().catch(() => null) as { message?: string; delete_after?: number } | null;
      if (!response.ok) throw new Error(result?.message ?? "Unable to schedule deletion. Refresh and try again.");
      return result;
    },
    onSuccess: (result) => {
      setOpen(false);
      void cache.invalidateQueries();
      toast.success(result?.delete_after ? `Deletion scheduled for ${dateLabel(result.delete_after)}.` : result?.message ?? "Deletion scheduled.");
    },
    onError: (error) => toast.error(error.message),
  });
  return <>
    <Button variant="ghost" size="sm" disabled={record.delete_after != null || deletion.isPending}
      onClick={() => { deletion.reset(); setEstimate(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); setOpen(true); }}>
      {record.delete_after != null ? "Deletion scheduled" : "Delete"}
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!deletion.isPending) setOpen(value); }}>
      <DialogContent showCloseButton={!deletion.isPending}>
        <DialogHeader>
          <DialogTitle>Schedule permanent deletion?</DialogTitle>
          <DialogDescription>This record will remain in Archives for 30 days after you confirm. It cannot be permanently deleted before that date. Automatic cleanup will then delete it if no stock or historical relationships require it to be retained.</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">Estimated permanent deletion date: {dateLabel(estimate)}</p>
        <p className="text-sm text-muted-foreground">The exact scheduled date will appear in Archives after confirmation. Restoring the record cancels scheduled deletion.</p>
        {deletion.isError && <p role="alert" className="text-sm text-destructive">{deletion.error.message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={deletion.isPending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={deletion.isPending} onClick={() => deletion.mutate()}>{deletion.isPending ? "Scheduling…" : "Schedule deletion"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
