"use client";

import { useWatch } from "react-hook-form";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/date-util";
import {
  allocateCombinedPayment,
  orderBatchFormSchema,
  draftForPaymentMode,
  previewCombinedOrders,
  orderTotal,
} from "@/schema/order-batch";
import { useOrders } from "../provider";

export function OrderBatchReview({ disabled }: { disabled: boolean }) {
  const {
    form,
    orderCount,
    activeDraftIndex,
    collectDrafts,
    switchDraft,
    removeDraft,
    paymentMode,
    combinedPayment,
    customerCB,
  } = useOrders();
  useWatch({ control: form.control });

  const drafts = collectDrafts();
  const effective =
    paymentMode === "COMBINED"
      ? previewCombinedOrders(
          drafts.map((draft) => draft.data),
          combinedPayment,
        )
      : drafts.map((draft) => draft.data);
  const pricesKnown = drafts.every(
    (draft) =>
      draft.data.items.length > 0 &&
      draft.data.items.every((item) => item.price !== undefined),
  );
  const totals = drafts.map((draft) => orderTotal(draft.data));
  const total =
    totals.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;
  const combinedValid =
    paymentMode !== "COMBINED" ||
    Boolean(allocateCombinedPayment(combinedPayment.amount_paid, totals));
  const paid =
    effective.reduce(
      (sum, order) => sum + Math.round((order.amount_paid || 0) * 100),
      0,
    ) / 100;
  const remaining =
    Math.max(0, Math.round(total * 100) - Math.round(paid * 100)) / 100;

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Orders in this submission"
    >
      <div className="px-4 pt-4 pb-3 lg:px-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {orderCount > 1 ? `${orderCount} orders` : "Draft"}
        </h3>
        <p className="mt-1 truncate text-sm font-medium text-foreground">
          {customerCB.inputValue || "Select a customer"}
        </p>
      </div>

      <ol
        className="flex min-h-0 gap-2 overflow-x-auto px-4 pb-3 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:px-3"
        aria-label="Order drafts"
      >
        {drafts.map((draft, index) => {
          const selected = index === activeDraftIndex;
          const ready = orderBatchFormSchema.safeParse({
            customer_id: draft.data.customer_id,
            orders: [draftForPaymentMode(draft.data, paymentMode)],
          }).success;
          const known =
            draft.data.items.length > 0 &&
            draft.data.items.every((item) => item.price !== undefined);
          const hasDestination =
            draft.destination &&
            draft.destination !== "Choose a saved shipping address";

          return (
            <li
              key={index}
              className={`relative w-56 shrink-0 rounded-xl border transition-colors lg:w-full ${
                selected
                  ? "border-foreground/30 bg-background shadow-2xs"
                  : "border-transparent bg-muted/40 hover:border-border"
              }`}
            >
              <button
                type="button"
                aria-label={`Edit order ${index + 1}`}
                aria-current={selected ? "true" : undefined}
                disabled={disabled || selected}
                onClick={() => switchDraft(index)}
                className="w-full space-y-1.5 p-3 text-left outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-100"
              >
                <div className="flex items-center gap-2 pr-6">
                  <span className="text-xs font-semibold text-foreground">
                    Order {index + 1}
                  </span>
                  {ready && !selected && (
                    <Check
                      className="ml-auto size-3.5 text-emerald-600 dark:text-emerald-400"
                      aria-label="Details complete"
                    />
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {hasDestination ? draft.destination : "No address selected"}
                </p>
                <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {draft.data.items.length}{" "}
                    {draft.data.items.length === 1 ? "item" : "items"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {known ? formatCurrency(totals[index]) : "—"}
                  </span>
                </div>
              </button>
              {orderCount > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-2.5 right-2 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove order ${index + 1}`}
                  disabled={disabled}
                  onClick={() => removeDraft(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="hidden space-y-2.5 border-t bg-background/60 p-4 lg:block lg:px-5">
        {orderCount > 1 && (
          <p className="text-xs text-muted-foreground">
            {paymentMode === "COMBINED"
              ? "Combined payment"
              : "Separate payments"}
          </p>
        )}
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold tabular-nums">
              {pricesKnown ? formatCurrency(total) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="tabular-nums">
              {pricesKnown && combinedValid ? formatCurrency(paid) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-2 text-sm">
            <dt className="font-medium">Balance</dt>
            <dd className="font-semibold tabular-nums">
              {pricesKnown && combinedValid ? formatCurrency(remaining) : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
