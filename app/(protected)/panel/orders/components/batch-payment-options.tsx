"use client";

import { useWatch } from "react-hook-form";
import { useOrders } from "../provider";
import { allocateCombinedPayment, orderTotal } from "@/schema/order-batch";
import { orderPaymentMethodLabels, orderPaymentMethodSchema } from "@/schema/order-payment-method";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentTypeCombobox } from "@/components/payment-type-combobox";
import { formatCurrency } from "@/utils/date-util";

export function BatchPaymentOptions({ disabled }: { disabled: boolean }) {
  const {
    form,
    paymentMode,
    setPaymentMode,
    combinedPayment,
    setCombinedPayment,
    collectDrafts,
    orderCount,
  } = useOrders();
  useWatch({ control: form.control });
  if (orderCount < 2) return null;

  const drafts = collectDrafts();
  const totals = drafts.map((draft) => orderTotal(draft.data));
  const total =
    totals.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;
  const pricesKnown = drafts.every(
    (draft) =>
      draft.data.items.length > 0 &&
      draft.data.items.every((item) => item.price !== undefined),
  );
  const allocations = pricesKnown
    ? allocateCombinedPayment(combinedPayment.amount_paid, totals)
    : null;
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-4 rounded-xl border bg-muted/15 p-4"
      aria-label="Batch payment mode"
    >
      <legend className="px-1.5 text-xs font-semibold text-foreground">
        Payment mode ({orderCount} orders)
      </legend>

      <RadioGroup
        aria-label="How these orders are paid"
        value={paymentMode}
        onValueChange={(value) => {
          setPaymentMode(value === "COMBINED" ? "COMBINED" : "SEPARATE");
          form.clearErrors("root");
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <FieldLabel
          htmlFor="separate-payments"
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
            paymentMode === "SEPARATE"
              ? "border-foreground/40 bg-background"
              : "border-border bg-background/50 hover:bg-background"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">Separate per order</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Individual method and terms for each order.
            </span>
          </span>
          <RadioGroupItem
            id="separate-payments"
            value="SEPARATE"
            className="mt-0.5"
          />
        </FieldLabel>

        <FieldLabel
          htmlFor="combined-payment"
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
            paymentMode === "COMBINED"
              ? "border-foreground/40 bg-background"
              : "border-border bg-background/50 hover:bg-background"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              One combined payment
            </span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Split one receipt across all {orderCount} orders.
            </span>
          </span>
          <RadioGroupItem
            id="combined-payment"
            value="COMBINED"
            className="mt-0.5"
          />
        </FieldLabel>
      </RadioGroup>

      {paymentMode === "COMBINED" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs">
            <span className="text-muted-foreground">
              Combined total ({orderCount} orders)
            </span>
            <strong className="text-sm font-semibold tabular-nums">
              {pricesKnown ? formatCurrency(total) : "Add items to all orders"}
            </strong>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="combined-method">Payment method</FieldLabel>
              <Select
                value={combinedPayment.payment_method}
                onValueChange={(value) => {
                  if (value === "CASH" || value === "BANK_TRANSFER") {
                    setCombinedPayment((current) => ({
                      ...current,
                      payment_method: value,
                      payment_type: "",
                    }));
                  }
                }}
              >
                <SelectTrigger id="combined-method">
                  <SelectValue>
                    {orderPaymentMethodLabels[combinedPayment.payment_method]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {orderPaymentMethodSchema.options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {orderPaymentMethodLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {combinedPayment.payment_method === "BANK_TRANSFER" && (
              <Field>
                <FieldLabel htmlFor="combined-payment-type">
                  Bank / e-wallet
                </FieldLabel>
                <PaymentTypeCombobox
                  id="combined-payment-type"
                  method={combinedPayment.payment_method}
                  value={combinedPayment.payment_type ?? ""}
                  onChange={(value) =>
                    setCombinedPayment((current) => ({
                      ...current,
                      payment_type: value,
                    }))
                  }
                  onBlur={() => {}}
                  invalid={false}
                />
              </Field>
            )}

            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="combined-amount">
                  Amount received
                </FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={disabled || !pricesKnown || total <= 0}
                  onClick={() =>
                    setCombinedPayment((current) => ({
                      ...current,
                      amount_paid: total,
                    }))
                  }
                >
                  Full total
                </Button>
              </div>
              <Input
                id="combined-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={
                  Number.isFinite(combinedPayment.amount_paid)
                    ? combinedPayment.amount_paid
                    : ""
                }
                onChange={(event) =>
                  setCombinedPayment((current) => ({
                    ...current,
                    amount_paid: event.target.valueAsNumber,
                  }))
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="combined-reference">
                Reference (optional)
              </FieldLabel>
              <Input
                id="combined-reference"
                maxLength={100}
                value={combinedPayment.reference_number ?? ""}
                onChange={(event) =>
                  setCombinedPayment((current) => ({
                    ...current,
                    reference_number: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          {allocations ? (
            <div className="overflow-hidden rounded-lg border bg-background">
              <div className="grid grid-cols-3 gap-2 border-b bg-muted/35 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
                <span>Order</span>
                <span className="text-right">Allocated</span>
                <span className="text-right">Balance</span>
              </div>
              <ol className="divide-y" aria-label="Combined payment allocations">
                {allocations.map((amount, index) => (
                  <li
                    key={index}
                    className="grid grid-cols-3 items-center gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-medium">Order {index + 1}</span>
                    <span className="text-right font-medium tabular-nums">
                      {formatCurrency(amount)}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {formatCurrency(Math.max(0, totals[index] - amount))}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter an amount to preview allocation across orders.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
