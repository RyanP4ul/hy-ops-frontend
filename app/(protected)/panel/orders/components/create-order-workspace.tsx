"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { Check } from "lucide-react";
import { useOrders } from "../provider";
import { OrderBatchReview } from "./order-batch-review";
import { BatchPaymentOptions } from "./batch-payment-options";
import { orderTotal } from "@/schema/order-batch";
import { formatCurrency } from "@/utils/date-util";
import { QueryFeedback } from "@/components/query-feedback";

const stages = [
  { label: "Destination", title: "Customer & destination" },
  { label: "Items", title: "Order items" },
  { label: "Payment", title: "Payment" },
  { label: "Review", title: "Review order" },
];

export function CreateOrderWorkspace({
  disabled,
  error,
  children,
}: {
  disabled: boolean;
  error?: string;
  children: ReactNode;
}) {
  const {
    step,
    setStep,
    activeDraftIndex,
    orderCount,
    isStaff,
    assignedWarehouse,
    warehouseQuery,
  } = useOrders();
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(`${activeDraftIndex}:${step}`);

  useEffect(() => {
    const current = `${activeDraftIndex}:${step}`;
    if (current !== previous.current) {
      content.current?.scrollTo({ top: 0 });
      heading.current?.focus({ preventScroll: true });
      previous.current = current;
    }
  }, [step, activeDraftIndex]);

  const stage = stages[step];

  return (
    <div className="grid min-h-0 min-w-0 overflow-y-auto overscroll-contain lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden">
      <aside
        className={`min-w-0 border-b bg-muted/25 lg:min-h-0 lg:border-r lg:border-b-0 ${orderCount === 1 ? "hidden lg:block" : ""}`}
        aria-label="Order drafts and totals"
      >
        <OrderBatchReview disabled={disabled} />
      </aside>

      <div
        ref={content}
        className="min-w-0 px-4 py-5 overscroll-contain sm:px-7 lg:min-h-0 lg:overflow-y-auto"
        data-testid="order-editor"
      >
        <nav aria-label="Order creation progress" className="mb-5">
          <ol className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1 sm:gap-1.5">
            {stages.map((item, index) => (
              <li key={item.label} className="min-w-0">
                <button
                  type="button"
                  disabled={disabled || index >= step}
                  onClick={() => setStep(index)}
                  aria-current={index === step ? "step" : undefined}
                  aria-label={`${index + 1}. ${item.label}${
                    index === step
                      ? ", current step"
                      : index < step
                        ? ", return to this step"
                        : ", upcoming step"
                  }`}
                  className={`flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3 ${
                    index === step
                      ? "bg-foreground text-background shadow-xs"
                      : index < step
                        ? "text-foreground hover:bg-background"
                        : "text-muted-foreground"
                  }`}
                >
                  <span
                    className="hidden size-4 shrink-0 items-center justify-center rounded-full border border-current/25 text-[10px] sm:inline-flex"
                    aria-hidden="true"
                  >
                    {index < step ? <Check className="size-2.5" /> : index + 1}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h3
            ref={heading}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none"
          >
            {stage.title}
          </h3>
          {orderCount > 1 && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              Order {activeDraftIndex + 1} of {orderCount}
            </span>
          )}
        </header>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="space-y-5">
          {isStaff && step === 0 && (
            <div>
              <QueryFeedback query={warehouseQuery} label="assigned warehouse" />
              {warehouseQuery.isError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {warehouseQuery.error.message}
                </p>
              )}
              {assignedWarehouse && (
                <p className="text-xs text-muted-foreground">
                  Warehouse:{" "}
                  <span className="font-medium text-foreground">
                    {assignedWarehouse.name}
                  </span>
                </p>
              )}
            </div>
          )}
          {step === 2 && orderCount > 1 && (
            <BatchPaymentOptions disabled={disabled} />
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function OrderSubmissionStatus() {
  const { form, collectDrafts, orderCount } = useOrders();
  useWatch({ control: form.control });
  const drafts = collectDrafts();
  const known = drafts.every(
    (draft) =>
      draft.data.items.length > 0 &&
      draft.data.items.every((item) => item.price !== undefined),
  );
  const total =
    drafts.reduce(
      (sum, draft) => sum + Math.round(orderTotal(draft.data) * 100),
      0,
    ) / 100;

  return (
    <div
      role="group"
      className="flex w-full items-center justify-between gap-4 text-xs lg:hidden"
      aria-label="Submission total"
    >
      <span className="text-muted-foreground">
        {orderCount} {orderCount === 1 ? "order" : "orders"}
      </span>
      <span className="font-semibold tabular-nums">
        {known ? formatCurrency(total) : "No items yet"}
      </span>
    </div>
  );
}
