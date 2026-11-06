"use client";

import { CreditCard, Layers, Check } from "lucide-react";
import { useWatch } from "react-hook-form";
import { useOrders } from "../provider";
import { allocateCombinedPayment, orderTotal } from "@/schema/order-batch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentTypeCombobox } from "@/components/payment-type-combobox";
import { formatCurrency } from "@/utils/date-util";

export function BatchPaymentOptions({ disabled }: { disabled: boolean }) {
  const { form, paymentMode, setPaymentMode, combinedPayment, setCombinedPayment, collectDrafts, orderCount } = useOrders();
  useWatch({ control: form.control });
  if (orderCount < 2) return null;
  const drafts = collectDrafts();
  const totals = drafts.map(draft => orderTotal(draft.data));
  const total = totals.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;
  const pricesKnown = drafts.every(draft => draft.data.items.length > 0 && draft.data.items.every(item => item.price !== undefined));
  const allocations = pricesKnown ? allocateCombinedPayment(combinedPayment.amount_paid, totals) : null;
  const methods = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", CARD: "Card" };
  return <fieldset disabled={disabled} className="min-w-0 space-y-4 rounded-2xl border bg-muted/10 p-4 sm:p-5" aria-label="Payment for this submission">
    <legend className="px-2 text-sm font-semibold">Payment for this submission</legend>
    <RadioGroup aria-label="How these orders are paid" value={paymentMode} onValueChange={value => {
      setPaymentMode(value === "COMBINED" ? "COMBINED" : "SEPARATE");
      form.clearErrors("root");
    }} className="grid gap-4 sm:grid-cols-2">
      <FieldLabel htmlFor="separate-payments" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${paymentMode === "SEPARATE" ? "border-foreground/35 bg-background shadow-sm" : "border-border bg-background/40 hover:bg-background"}`}>
        <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Separate payments per order</span><span id="separate-payment-description" aria-hidden="true" className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">Each order has its own amount, method and payment terms.</span></span>
        <RadioGroupItem id="separate-payments" value="SEPARATE" aria-describedby="separate-payment-description" className="mt-0.5" />
      </FieldLabel>
      <FieldLabel htmlFor="combined-payment" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${paymentMode === "COMBINED" ? "border-foreground/35 bg-background shadow-sm" : "border-border bg-background/40 hover:bg-background"}`}>
        <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">One payment for all orders</span><span id="combined-payment-description" aria-hidden="true" className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">Record one receipt and split it across these orders.</span></span>
        <RadioGroupItem id="combined-payment" value="COMBINED" aria-describedby="combined-payment-description" className="mt-0.5" />
      </FieldLabel>
    </RadioGroup>
    {paymentMode === "SEPARATE" ? <p className="text-xs text-muted-foreground">Set the active order&rsquo;s payment details below. Other orders keep their own entries.</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3"><span className="text-sm text-muted-foreground">Total across {orderCount} orders</span><strong className="text-lg tracking-tight tabular-nums">{pricesKnown ? formatCurrency(total) : "Add items to all orders"}</strong></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="combined-method">Combined payment method</FieldLabel>
          <Select value={combinedPayment.payment_method} onValueChange={value => {
            if (value === "CASH" || value === "BANK_TRANSFER" || value === "CARD") setCombinedPayment(current => ({ ...current, payment_method: value, payment_type: "" }));
          }}><SelectTrigger id="combined-method"><SelectValue>{methods[combinedPayment.payment_method]}</SelectValue></SelectTrigger><SelectContent>
            {Object.entries(methods).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent></Select>
        </Field>
        {combinedPayment.payment_method !== "CASH" && <Field>
          <FieldLabel htmlFor="combined-payment-type">Combined payment type</FieldLabel>
          <PaymentTypeCombobox id="combined-payment-type" helpId="combined-payment-help" method={combinedPayment.payment_method} value={combinedPayment.payment_type ?? ""}
            onChange={value => setCombinedPayment(current => ({ ...current, payment_type: value }))} onBlur={() => {}} invalid={false} />
          <p id="combined-payment-help" className="text-xs text-muted-foreground">Choose a provider or enter its name.</p>
        </Field>}
        <Field><FieldLabel htmlFor="combined-amount">Combined amount received</FieldLabel>
          <Input id="combined-amount" type="number" min="0.01" step="0.01" value={Number.isFinite(combinedPayment.amount_paid) ? combinedPayment.amount_paid : ""}
            onChange={event => setCombinedPayment(current => ({ ...current, amount_paid: event.target.valueAsNumber }))} />
          <Button type="button" variant="outline" size="sm" disabled={disabled || !pricesKnown || total <= 0} onClick={() => setCombinedPayment(current => ({ ...current, amount_paid: total }))}>Use full total</Button>
        </Field>
        <Field><FieldLabel htmlFor="combined-reference">Payment reference (optional)</FieldLabel>
          <Input id="combined-reference" maxLength={100} value={combinedPayment.reference_number ?? ""} onChange={event => setCombinedPayment(current => ({ ...current, reference_number: event.target.value }))} />
        </Field>
      </div>
<p className="text-xs leading-relaxed text-muted-foreground">Partial payments are split in proportion to order totals. Orders with no allocation use Net 30 terms; choose separate payments for different terms.</p>
      {allocations ? <div className="overflow-hidden rounded-xl border bg-background">
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b bg-muted/35 px-4 py-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"><span>Order</span><span className="text-right">Allocated</span><span className="text-right">Balance</span></div>
        <ol className="divide-y" aria-label="Combined payment allocations">{allocations.map((amount, index) => <li key={index} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-4 py-3 text-xs"><span className="flex items-center gap-2 font-medium"><Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />Order {index + 1}</span><span className="text-right font-medium tabular-nums">{formatCurrency(amount)}</span><span className="text-right text-muted-foreground tabular-nums">{formatCurrency(Math.max(0, totals[index] - amount))}</span></li>)}</ol>
      </div> : <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Enter an amount to preview how it will be applied to each order.</p>}
    </>}
  </fieldset>;
}
