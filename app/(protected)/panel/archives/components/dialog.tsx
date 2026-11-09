"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { useModal } from "@/components/providers/modal-provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogMode } from "@/types/dialog";
import { useArchive } from "../provider";

export default function ArchiveDialog() {
  const { state, closeModal } = useModal();
  const { send } = useWebSocket();
  const { archivesQuery, selected } = useArchive();
  const queryClient = useQueryClient();
  const record = archivesQuery.data?.rows.find((row) => row.id === selected.archived_id);
  const details = record?.data as Record<string, unknown> | undefined;
  const name = typeof details?.name === "string" ? details.name : `Record #${selected.entity_id}`;
  const restoreMutation = useMutation({
    mutationFn: async (target: typeof selected) => {
      const response = await request("PUT", `/api/archives/${target.archived_id}/restore`);
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Unable to restore this record. Please try again.");
      return result;
    },
    onSuccess: (result, target) => {
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ["archives"] });
      send({ type: "ARCHIVE_RESTORED", payload: [Number(target.archived_id), Number(target.entity_id), target.entity_table] });
      toast.success(result?.message ?? "Record restored");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{state.title}</DialogTitle>
        <DialogDescription>{state.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
          <Badge variant="outline">{selected.entity_table.replace(/[_-]+/g, " ")}</Badge>
          <p className="break-words font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">Record #{selected.entity_id} · Archive #{selected.archived_id}</p>
        </div>
        {state.mode === DialogMode.DEFAULT && (
          record ? <>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Archived by</dt><dd className="mt-1 break-words">{record.user?.name ?? "Unknown user"}</dd></div>
              {typeof details?.email === "string" && <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all">{details.email}</dd></div>}
              {typeof details?.role === "string" && <div><dt className="text-xs text-muted-foreground">Role</dt><dd className="mt-1 capitalize">{details.role}</dd></div>}
              {typeof details?.street_address === "string" && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Address</dt><dd className="mt-1 break-words">{[details.street_address, details.city, details.state, details.zip_code].filter((value) => typeof value === "string" && value).join(", ")}</dd></div>}
            </dl>
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">Full recorded details</summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-xs">{JSON.stringify(record, null, 2)}</pre>
            </details>
          </> : <p role="status" className="text-sm text-muted-foreground">This record is no longer on the current page. Close this dialog and refresh the list.</p>
        )}
        {state.mode === DialogMode.ARCHIVE && <p className="text-sm text-muted-foreground">Restoring makes this record available again. Review its details before confirming.</p>}
        {restoreMutation.isError && state.mode === DialogMode.ARCHIVE && <p role="alert" className="text-sm text-destructive">{restoreMutation.error.message}</p>}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={restoreMutation.isPending}>{state.mode === DialogMode.DEFAULT ? "Close" : "Cancel"}</Button>} />
        {state.mode === DialogMode.ARCHIVE && <Button disabled={restoreMutation.isPending || !state.isOpen} onClick={() => restoreMutation.mutate(selected)}>
          {restoreMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArchiveRestore className="size-4" aria-hidden="true" />}
          {restoreMutation.isPending ? "Restoring…" : "Restore record"}
        </Button>}
      </DialogFooter>
    </DialogContent>
  );
}
