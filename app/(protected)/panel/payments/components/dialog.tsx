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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { usePayments } from "../provider";
import { Controller } from "react-hook-form";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { useEffect } from "react";
import { PaymentFormType } from "@/schema/payment";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";

export default function PaymentDialog() {
  const { state, dispatch } = useModal();
  const { form, paymentsQuery, selected } = usePayments();

  async function onSubmit(data: PaymentFormType) {
    ToastSubmit(data);

    requestWithErrorHandling(
      await request("POST", `/api/payments`, data),
      form,
      () => {
        paymentsQuery.refetch();
        dispatch({
          type: "CLOSE",
        });
      },
    );
  }

  const selectedPayment = paymentsQuery.data?.rows.find(
    (payment) => payment.payment_number === selected.payment_number,
  );

  useEffect(() => {
    if (selectedPayment) {
      form.reset({
        order_id: selectedPayment.order_id,
        payment_number: selectedPayment.payment_number,
        payment_amount: 0,
        version: selectedPayment.version,
      });
    }
  }, [selectedPayment, form]);

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{state.title}</DialogTitle>
        <DialogDescription>{state.description}</DialogDescription>
        <div className="sm:col-span-2 rounded-md bg-muted p-3 text-sm">
          <p>Order #{selectedPayment?.order_id}</p>
          <p className="text-muted-foreground">
            Remaining balance:{" "}
            {formatCurrency(String(selectedPayment?.remaining_amount) ?? "0")}
          </p>
        </div>
      </DialogHeader>

      {state.mode === DialogMode.CUSTOM && (
        <>
          <form
            id="payment-form"
            onSubmit={form.handleSubmit(onSubmit, (error) =>
              ToastValidationError(error),
            )}
          >
            <Controller
              control={form.control}
              name="payment_amount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="payment_amount">
                    Payment Amount <span className="text-destructive">*</span>
                  </FieldLabel>

                  <Input
                    {...field}
                    id={field.name}
                    type="number"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter payment amount"
                    autoComplete="off"
                    onChange={(event) => {
                      field.onChange(event.target.valueAsNumber);
                    }}
                  />

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </form>
        </>
      )}

      <DialogFooter>
        <DialogClose
          render={
            <Button type="button" variant="outline">
              Cancel
            </Button>
          }
        />
        <Button type="submit" form="payment-form">
          {state.action}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value));
}
