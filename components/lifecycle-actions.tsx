"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { request } from "@/components/http";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, CircleCheck, CircleX } from "lucide-react";

type Props = {
  resource: "products" | "inventory" | "warehouses" | "vehicles" | "users";
  record: {
    id?: number;
    version?: number;
    is_active?: boolean;
    is_operational?: boolean;
  };
  archive?: boolean;
};

export function LifecycleActions({ resource, record, archive = false }: Props) {
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

  return (
    <>
      {/* <Badge
        title={
          active && record.is_operational === false
            ? "A related product or assigned warehouse is inactive or archived."
            : undefined
        }
        variant={active ? "outline" : "secondary"}
      >
        {!active
          ? "Inactive"
          : record.is_operational === false
            ? "Unavailable"
            : "Active"}
      </Badge> */}
      {userQuery.data?.role === "admin" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={self || mutation.isPending}
            onClick={() => {
              mutation.reset();
              setAction(active ? "deactivate" : "activate");
            }}
          >
            {active ? (
              <CircleX className="size-4" />
            ) : (
              <CircleCheck className="size-4" />
            )}
            <span>{active ? "Deactivate" : "Activate"}</span>
          </Button>
          {archive && (
            <Button
              variant="ghost"
              size="sm"
              disabled={self || mutation.isPending}
              onClick={() => {
                mutation.reset();
                setAction("archive");
              }}
            >
              <Archive className="size-4" />
              <span>Archive</span>
            </Button>
          )}
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
        </>
      )}
    </>
  );
}
