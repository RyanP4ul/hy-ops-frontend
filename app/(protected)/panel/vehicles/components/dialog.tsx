"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { useVehicles } from "../provider";
import Form from "./form";

export default function EntityDialog() {
  const { state } = useModal();
  const { form, selected, vehicleDetailQuery } = useVehicles();
  useEffect(() => { if (state.isOpen) form.clearErrors(); }, [state.isOpen, state.mode, selected.id, form]);
  return <DialogContent className="sm:max-w-2xl">
    <DialogHeader><DialogTitle>{state.title}</DialogTitle><DialogDescription>{state.description}</DialogDescription></DialogHeader>
    {!state.isOpen ? <Loader2 className="mx-auto size-6 animate-spin" aria-label="Loading" /> : <Form />}
    {form.formState.errors.root?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
    <DialogFooter>
      <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
      <Button disabled={!state.isOpen || form.formState.isSubmitting || (state.mode === DialogMode.EDIT && (vehicleDetailQuery.isFetching || vehicleDetailQuery.isError || !vehicleDetailQuery.data))} type="submit" form="vehicle-form">
        {form.formState.isSubmitting ? "Saving..." : state.action}
      </Button>
    </DialogFooter>
  </DialogContent>;
}
