"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogMode } from "@/types/dialog";
import { useDeliverySchedule } from "../provider";
import { OrderPicker } from "./order-picker";

export default function SubDialog() {
  const { form, sub, setSub, groupPending, removeSelection } = useDeliverySchedule();
  const adding = sub.mode === DialogMode.INSERT;

  function close() {
    setSub({ is_open: false, mode: DialogMode.DEFAULT });
  }

  return (
    <Dialog
      open={sub.is_open}
      onOpenChange={(open, event) => {
        if (open) return;
        if (groupPending) event.cancel();
        else close();
      }}
    >
      {sub.is_open && (
        <DialogContent
          className={adding ? "sm:max-w-2xl" : "sm:max-w-md"}
          showCloseButton={!groupPending}
        >
          <DialogHeader>
            <DialogTitle>{adding ? "Add orders" : "Remove order selection"}</DialogTitle>
            <DialogDescription>
              {adding
                ? "Select ready orders and complete groups to add to this delivery."
                : "Removing a group removes all its orders from this delivery."}
            </DialogDescription>
          </DialogHeader>
          {adding ? (
            <OrderPicker onAdded={close} />
          ) : (
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const orderId = sub.id === undefined ? undefined : form.getValues("order_ids")[sub.id];
                  if (orderId !== undefined) removeSelection(orderId);
                  close();
                }}
              >
                Remove
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
