"use client";

import { Controller } from "react-hook-form";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { request, requestWithErrorHandling } from "@/components/http";
import { ToastValidationError } from "@/components/util";
import { useVehicles } from "../provider";

export default function Form() {
  const { form, vehicleQuery, vehicleDetailQuery, selected } = useVehicles();
  const { state, dispatch } = useModal();
  useEffect(() => {
    if (state.mode === DialogMode.EDIT && vehicleDetailQuery.data)
      form.reset(vehicleDetailQuery.data);
    else if (state.mode === DialogMode.INSERT)
      form.reset({
        plate_number: "",
        status: "available",
        type: "truck",
        image: "",
      });
  }, [state.mode, vehicleDetailQuery.data]);
  async function onSubmit(data: any) {
    const response = await request(
      state.mode === DialogMode.EDIT ? "PUT" : "POST",
      state.mode === DialogMode.EDIT
        ? `/api/vehicles/${selected.id}`
        : "/api/vehicles",
      state.mode === DialogMode.EDIT
        ? { ...data, version: selected.version }
        : data,
    );
    requestWithErrorHandling(response, form, () => {
      vehicleQuery.refetch();
      dispatch({ type: "CLOSE" });
    });
  }
  return (
    <form
      id="vehicle-form"
      onSubmit={form.handleSubmit(onSubmit, (error) =>
        ToastValidationError(error),
      )}
      className="grid gap-4 md:grid-cols-2"
    >
      <Controller
        name="plate_number"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Plate Number</FieldLabel>
            <Input {...field} placeholder="ABC-1234" />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="type"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Type</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="status"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Status</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="on_delivery">On delivery</SelectItem>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="image"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Image path</FieldLabel>
            <Input {...field} placeholder="/vehicles/truck.svg" />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
}
