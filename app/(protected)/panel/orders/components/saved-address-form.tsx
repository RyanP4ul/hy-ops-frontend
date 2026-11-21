"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";
import { savedAddressSchema, shippingAddressFields, type SavedAddressFormValues } from "@/schema/shipping-address";
import type { CustomerAddress } from "../provider";

export function SavedAddressForm({ customerId, onSaved }: {
  customerId: number;
  onSaved: (address: CustomerAddress) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<SavedAddressFormValues>({
    resolver: zodResolver(savedAddressSchema),
    defaultValues: { address_line: "", barangay: "", city_municipality: "", province: "", postal_code: "" },
  });

  if (!open) return <Button type="button" variant="outline" onClick={() => setOpen(true)}>Save another shipping address</Button>;

  return <div className="space-y-4 rounded-lg border p-4">
    <div>
      <h4 className="text-sm font-medium">Save a shipping address</h4>
      <p className="text-xs text-muted-foreground">This address will be saved to the customer and selected for this order. Confirm its map coordinates for delivery navigation.</p>
    </div>
    <fieldset disabled={form.formState.isSubmitting} className="grid gap-3 sm:grid-cols-2">
      {shippingAddressFields.map(({ name, label, type }) => <Field key={name} data-invalid={!!form.formState.errors[name]}>
        <FieldLabel htmlFor={`saved-${name}`}>{label}</FieldLabel>
        <Input id={`saved-${name}`} type={type} step={type === "number" ? "any" : undefined}
          {...form.register(name, { valueAsNumber: type === "number" })} />
        {form.formState.errors[name] && <FieldError errors={[form.formState.errors[name]]} />}
      </Field>)}
    </fieldset>
    {form.formState.errors.root?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
    <div className="flex gap-2">
      <Button type="button" disabled={form.formState.isSubmitting} onClick={() => {
        void form.handleSubmit(async data => {
          form.clearErrors("root");
          try {
            const response = await request("POST", `/api/orders/customers/${customerId}/addresses`, data);
            if (!response.ok) {
              await requestWithErrorHandling(response, form);
              return;
            }
            const address = await response.json() as CustomerAddress;
            await onSaved(address);
            form.reset();
            setOpen(false);
          } catch {
            form.setError("root", { message: "Unable to refresh saved addresses. Refresh the customer before retrying." });
          }
        })();
      }}>{form.formState.isSubmitting ? "Saving address..." : "Save and select address"}</Button>
      <Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  </div>;
}
