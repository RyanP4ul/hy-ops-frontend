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
import { Loader2 } from "lucide-react";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { request, requestWithErrorHandling } from "@/components/http";
import { useVehicles } from "../provider";
import Form from "./form";

export default function VehicleDialog() {
  const { state, dispatch } = useModal();
  const { form, vehicleQuery, selected } = useVehicles();
  async function onDelete() {
    requestWithErrorHandling(
      await request(
        "DELETE",
        `/api/vehicles/${selected.id}?version=${selected.version}`,
      ),
      form,
      () => {
        vehicleQuery.refetch();
        dispatch({ type: "CLOSE" });
      },
    );
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
          disabled={!state.isOpen}
          type="submit"
          form="vehicle-form"
        >
          {state.action}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
