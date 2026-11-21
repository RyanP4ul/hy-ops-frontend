"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { request } from "@/components/http";
import { useAuth } from "@/components/providers/auth-provider";
import { TableActions, type TableActionsProps } from "@/components/table-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, CircleCheck, CircleX } from "lucide-react";

type Props = TableActionsProps & {
  resource: "products" | "inventory" | "warehouses" | "vehicles" | "users";
  record: {
    id?: number;
    version?: number;
    is_active?: boolean;
  };
  archive?: boolean;
};

export function LifecycleActions({ resource, record, archive = false, additional = [], ...props }: Props) {
  const { userQuery } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<
    "activate" | "deactivate" | "archive" | null
  >(null);
  const active = record.is_active !== false;
  const self =
    resource === "users" && Number(userQuery.data?.sub) === record.id;
  const mutation = useMutation({
    mutationFn: async (operation: NonNullable<typeof action>) => {
      const response = await request(
        "POST",
        `/api/${resource}/${record.id}/${operation}`,
        { version: record.version },
      );
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Unable to update this record. Refresh and try again.",
        );
      return result;
    },
    onSuccess: (result) => {
      setAction(null);
      // A status change affects selections across modules as well as this list.
      void queryClient.invalidateQueries();
      toast.success(result?.message ?? "Record updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const label = action ? action[0].toUpperCase() + action.slice(1) : "Update";
  const canManage = userQuery.data?.role === "admin";

  function confirm(operation: NonNullable<typeof action>) {
    mutation.reset();
    setAction(operation);
  }

  return (
    <>
      <TableActions
        {...props}
        additional={[
          canManage && {
            label: active ? "Deactivate" : "Activate",
            icon: active ? CircleX : CircleCheck,
            destructive: active,
            disabled: self || mutation.isPending,
            tooltip: self ? "You cannot deactivate your own account." : undefined,
            onClick: () => confirm(active ? "deactivate" : "activate"),
          },
          canManage && archive && {
            label: "Archive",
            icon: Archive,
            destructive: true,
            disabled: self || mutation.isPending,
            onClick: () => confirm("archive"),
          },
          ...additional,
        ]}
      />
      {canManage && (
          <Dialog
            open={action !== null}
            onOpenChange={(open) => {
              if (!open && !mutation.isPending) setAction(null);
            }}
          >
            <DialogContent showCloseButton={!mutation.isPending}>
              <DialogHeader>
                <DialogTitle>
                  {label} record #{record.id}?
                </DialogTitle>
                <DialogDescription>
                  {action === "activate"
                    ? "Make this record active. Related products, stock and warehouses must also be active before it can be used."
                    : action === "archive"
                      ? "Move this record to Archives and prevent operational use. Existing history is retained. Restore it from Archives when needed."
                      : "Prevent new operational use of this record. Its history remains available, and you can activate it again here."}
                </DialogDescription>
              </DialogHeader>
              {mutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {mutation.error.message}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => setAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={mutation.isPending || !action}
                  onClick={() => {
                    if (action) mutation.mutate(action);
                  }}
                >
                  {mutation.isPending ? "Saving…" : label}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      )}
    </>
  );
}
