"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";

const addressSchema = z.object({
  address_line: z.string().trim().min(1, "Street address is required").max(255),
  barangay: z.string().trim().min(1, "Barangay is required").max(100),
  city_municipality: z.string().trim().min(1, "City or municipality is required").max(100),
  province: z.string().trim().min(1, "Province is required").max(100),
  postal_code: z.string().trim().max(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).refine(data => data.latitude !== 0 || data.longitude !== 0, {
  path: ["latitude"], message: "Confirm the destination coordinates; (0, 0) is not a verified location.",
});
type AddressForm = z.infer<typeof addressSchema>;

export function SavedAddressForm({ customerId, onSaved }: {
  customerId: number;
  onSaved: (address: { id: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: { address_line: "", barangay: "", city_municipality: "", province: "", postal_code: "" },
  });
  const fields = [
    ["address_line", "Street address"], ["barangay", "Barangay"],
    ["city_municipality", "City / municipality"], ["province", "Province"],
    ["postal_code", "Postal code (optional)"], ["latitude", "Latitude"], ["longitude", "Longitude"],
  ] as const;

  if (!open) return <Button type="button" variant="outline" onClick={() => setOpen(true)}>Save another shipping address</Button>;

  return <div className="space-y-4 rounded-lg border p-4">
    <div>
      <h4 className="text-sm font-medium">Save a shipping address</h4>
      <p className="text-xs text-muted-foreground">This address will be saved to the customer and selected for this order. Confirm its map coordinates for delivery navigation.</p>
    </div>
    <fieldset disabled={form.formState.isSubmitting} className="grid gap-3 sm:grid-cols-2">
      {fields.map(([name, label]) => <Field key={name} data-invalid={!!form.formState.errors[name]}>
        <FieldLabel htmlFor={`saved-${name}`}>{label}</FieldLabel>
        <Input id={`saved-${name}`} type={name === "latitude" || name === "longitude" ? "number" : "text"}
          step={name === "latitude" || name === "longitude" ? "any" : undefined}
          {...form.register(name, { valueAsNumber: name === "latitude" || name === "longitude" })} />
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
            const address = await response.json() as { id: number };
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
