"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerAddressFields, CustomerContactFields, UserTextField } from "@/components/customer-profile-fields";
import { request, requestWithErrorHandling } from "@/components/http";
import { emptyCustomerProfile, orderCustomerSchema, type UserForm } from "@/schema/user";
import type { CustomerOption } from "../provider";

export function CreateCustomerDialog({ onCreated }: { onCreated: (customer: CustomerOption) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const queryClient = useQueryClient();
  const form = useForm<UserForm>({
    resolver: zodResolver(orderCustomerSchema),
    defaultValues: {
      name: "", email: "", role: "customer", profile: emptyCustomerProfile,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function createCustomer(customerDetails: UserForm) {
    const response = await request("POST", "/api/users", customerDetails);
    await requestWithErrorHandling(response, form, (result) => {
      const customer = result.customer as CustomerOption | undefined;
      if (!customer?.id || !customer.addresses?.length) {
        form.setError("root", { message: "Customer saved. Close this dialog and select the customer from the refreshed list." });
      } else {
        onCreated(customer);
        setOpen(false);
      }
      void queryClient.invalidateQueries({ queryKey: ["customer_query"] });
      void queryClient.invalidateQueries({ queryKey: ["walk_in_customers"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen, event) => {
      if (isSubmitting) {
        event.cancel();
        return;
      }
      if (nextOpen) form.reset();
      setOpen(nextOpen);
    }}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <UserPlus aria-hidden="true" /> Add customer
      </DialogTrigger>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={!isSubmitting}>
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6 sm:pr-12">
          <DialogTitle className="text-lg">Add customer</DialogTitle>
          <DialogDescription>The new customer and shipping address will be selected for this order.</DialogDescription>
        </DialogHeader>
        <form id={id} noValidate className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6" onSubmit={(event) => {
          event.stopPropagation();
          void form.handleSubmit(createCustomer)(event);
        }}>
          <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
            <legend className="mb-3 w-full font-semibold">Customer details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <UserTextField control={form.control} name="name" label="Name" placeholder="Enter name" autoComplete="name" required />
              <UserTextField control={form.control} name="email" label="Email" placeholder="Enter email" type="email" autoComplete="email" required />
            </div>
            <CustomerContactFields control={form.control} requirePhone />
          </fieldset>
          <fieldset disabled={isSubmitting} aria-labelledby={`${id}-shipping`} className="min-w-0 border-t pt-4">
            <h3 id={`${id}-shipping`} className="mb-3 font-semibold">Shipping address</h3>
            <CustomerAddressFields form={form} disabled={isSubmitting} showCoordinates />
          </fieldset>
          {errors.root?.message && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
        </form>
        <DialogFooter className="m-0 shrink-0 px-4 sm:px-6">
          <DialogClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>Cancel</DialogClose>
          <Button type="submit" form={id} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
            {isSubmitting ? "Saving customer..." : "Save and select customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
