"use client";

import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { request, requestWithErrorHandling } from "@/components/http";
import { useVehicles } from "../provider";
import Form from "./form";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";

export default function VehicleDialog() {
  const { state, dispatch } = useModal();
  const { form, vehicleQuery, vehicleDetailQuery, selected } = useVehicles();
  const { send } = useWebSocket();
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (state.isOpen) form.clearErrors(); }, [state.isOpen, state.mode, selected.id, form]);

  async function onDelete() {
    if (deleting) return;
    setDeleting(true);
    try { await requestWithErrorHandling(
      await request(
        "DELETE",
        `/api/vehicles/${selected.id}?version=${selected.version}`,
      ),
      form,
      () => {
        vehicleQuery.refetch();
        send({
          type: REQUESTS.VEHICLE_DELETED,
          payload: [selected.id],
        });
        dispatch({ type: "CLOSE" });
      },
    ); } finally { setDeleting(false); }
  }
  const isDelete = state.mode === DialogMode.DELETE;
  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{state.title}</DialogTitle>
        <DialogDescription>{state.description}</DialogDescription>
      </DialogHeader>
      {!state.isOpen ? (
        <Loader2 className="mx-auto size-6 animate-spin" />
      ) : isDelete ? (
        <form
          id="vehicle-form"
          onSubmit={(event) => {
            event.preventDefault();
            onDelete();
          }}
        />
      ) : (
        <Form />
      )}
      {form.formState.errors.root?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
      <DialogFooter>
        <DialogClose
          render={
            <Button type="button" variant="outline">
              Cancel
            </Button>
          }
        />
        <Button
          variant={isDelete ? "destructive" : "default"}
          disabled={(state.mode === DialogMode.EDIT && (vehicleDetailQuery.isFetching || vehicleDetailQuery.isError || !vehicleDetailQuery.data)) || !state.isOpen || deleting || form.formState.isSubmitting}
          type="submit"
          form="vehicle-form"
        >
          {deleting || form.formState.isSubmitting ? "Saving..." : state.action}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
