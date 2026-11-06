"use client";

import { useWatch } from "react-hook-form";
import { Check, MapPin, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/date-util";
import { allocateCombinedPayment, orderBatchFormSchema, draftForPaymentMode, previewCombinedOrders, orderTotal } from "@/schema/order-batch";
import { useOrders } from "../provider";

export function OrderBatchReview({ disabled }: { disabled: boolean }) {
  const { form, orderCount, activeDraftIndex, collectDrafts, switchDraft, removeDraft, paymentMode, combinedPayment, customerCB } = useOrders();
  useWatch({ control: form.control });
  const drafts = collectDrafts();
  const effective = paymentMode === "COMBINED" ? previewCombinedOrders(drafts.map(draft => draft.data), combinedPayment) : drafts.map(draft => draft.data);
  const pricesKnown = drafts.every(draft => draft.data.items.length > 0 && draft.data.items.every(item => item.price !== undefined));
  const totals = drafts.map(draft => orderTotal(draft.data));
  const total = totals.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;
  const combinedValid = paymentMode !== "COMBINED" || Boolean(allocateCombinedPayment(combinedPayment.amount_paid, totals));
  const paid = effective.reduce((sum, order) => sum + Math.round((order.amount_paid || 0) * 100), 0) / 100;

  return <section className="flex h-full min-h-0 flex-col" aria-label="Orders in this submission">
    <div className="px-4 pt-5 pb-3 lg:px-5">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{orderCount > 1 ? `${orderCount} orders for this customer` : "Your order"}</h3><span className="rounded-md border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">DRAFT</span></div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{customerCB.inputValue || "Choose a customer to get started"}</p>
    </div>
    <ol className="flex min-h-0 gap-2 overflow-x-auto px-4 pb-4 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:px-3" aria-label="Order drafts">
      {drafts.map((draft, index) => {
        const selected = index === activeDraftIndex;
        const ready = orderBatchFormSchema.safeParse({ customer_id: draft.data.customer_id, orders: [draftForPaymentMode(draft.data, paymentMode)] }).success;
        const known = draft.data.items.length > 0 && draft.data.items.every(item => item.price !== undefined);
        return <li key={index} className={`relative w-60 shrink-0 rounded-xl border transition-colors lg:w-full ${selected ? "border-foreground/30 bg-background shadow-sm" : "border-transparent bg-muted/35 hover:border-border"}`}>
          <button type="button" aria-label={`Edit order ${index + 1}`} aria-current={selected ? "true" : undefined} disabled={disabled || selected} onClick={() => switchDraft(index)}
            className="w-full space-y-2 p-3 text-left outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-100">
            <div className="flex items-center gap-2 pr-7">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${selected ? "bg-foreground text-background" : "border bg-background"}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="text-sm font-medium">Order {index + 1}</span>
              {ready && !selected && <Check className="ml-auto size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Details complete" />}
            </div>
            <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="line-clamp-1 text-xs leading-relaxed text-muted-foreground lg:line-clamp-2 lg:min-h-8">{draft.destination}</span></div>
            <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{draft.data.items.length} {draft.data.items.length === 1 ? "line item" : "line items"}</span><span className="font-semibold tabular-nums">{known ? formatCurrency(totals[index]) : "No items yet"}</span></div>
            <p className="hidden text-[10px] text-muted-foreground lg:block">{selected ? "Currently editing" : ready ? "Ready for review" : "Needs details"}</p>
          </button>
          {orderCount > 1 && <Button type="button" variant="ghost" size="icon-sm" className="absolute top-2.5 right-2 text-muted-foreground hover:text-destructive" aria-label={`Remove order ${index + 1}`} disabled={disabled} onClick={() => removeDraft(index)}><Trash2 className="size-3.5" /></Button>}
        </li>;
      })}
    </ol>
    <div className="hidden space-y-4 border-t bg-background/50 p-5 lg:block">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="size-3.5" /><span>{orderCount} {orderCount === 1 ? "order" : "orders"} / {paymentMode === "COMBINED" ? "One combined payment" : "Separate payments"}</span></div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total order value</dt><dd className="font-semibold tabular-nums">{pricesKnown ? formatCurrency(total) : "Not set"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Recorded payment</dt><dd className="tabular-nums">{pricesKnown && combinedValid ? formatCurrency(paid) : "Not set"}</dd></div>
        <div className="flex justify-between gap-3 border-t pt-3"><dt className="font-medium">Remaining</dt><dd className="font-semibold tabular-nums">{pricesKnown && combinedValid ? formatCurrency(Math.max(0, Math.round(total * 100) - Math.round(paid * 100)) / 100) : "Not set"}</dd></div>
      </dl>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Need another destination? Add another order from the review step. Nothing is created until you submit.</p>
    </div>
  </section>;
}
