"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { Check, MapPin, Package, CreditCard, ClipboardCheck } from "lucide-react";
import { useOrders } from "../provider";
import { OrderBatchReview } from "./order-batch-review";
import { BatchPaymentOptions } from "./batch-payment-options";
import { orderTotal } from "@/schema/order-batch";
import { formatCurrency } from "@/utils/date-util";

const stages = [
  { label: "Destination", title: "Customer & destination", description: "Choose who this order is for, where it is going, and the warehouse supplying it.", icon: MapPin },
  { label: "Items", title: "Build your order", description: "Add products and quantities. Available stock is checked before you continue.", icon: Package },
  { label: "Payment", title: "Set up payment", description: "Record what has been received and confirm how the balance will be paid.", icon: CreditCard },
  { label: "Review", title: "Everything ready to go?", description: "Check this order, add another destination, or create the orders you have prepared.", icon: ClipboardCheck },
];

export function CreateOrderWorkspace({ disabled, error, children }: { disabled: boolean; error?: string; children: ReactNode }) {
  const { step, setStep, activeDraftIndex, orderCount } = useOrders();
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
  const Icon = stage.icon;

  return <div className="grid min-h-0 min-w-0 overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden">
    <aside className={`min-w-0 border-b bg-muted/25 lg:min-h-0 lg:border-r lg:border-b-0 ${orderCount === 1 ? "hidden lg:block" : ""}`} aria-label="Order drafts and totals">
      <OrderBatchReview disabled={disabled} />
    </aside>
    <div ref={content} className="min-w-0 px-4 py-5 sm:px-7 lg:min-h-0 lg:overflow-y-auto" data-testid="order-editor">
      <nav aria-label="Order creation progress" className="mb-6">
        <ol className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1 sm:gap-2">
          {stages.map((item, index) => <li key={item.label} className="min-w-0">
            <button type="button" disabled={disabled || index >= step} onClick={() => setStep(index)}
              aria-current={index === step ? "step" : undefined} aria-label={`${index + 1}. ${item.label}${index === step ? ", current step" : index < step ? ", return to this step" : ", upcoming step"}`}
              className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-1 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3 ${index === step ? "bg-foreground text-background shadow-sm" : index < step ? "text-foreground hover:bg-background" : "text-muted-foreground"}`}>
              <span className="hidden size-5 shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px] sm:inline-flex" aria-hidden="true">{index < step ? <Check className="size-3" /> : index + 1}</span>
              {item.label}
            </button>
          </li>)}
        </ol>
      </nav>
      <header className="mb-6 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/30"><Icon className="size-5" aria-hidden="true" /></div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Order {activeDraftIndex + 1} of {orderCount} / Step {step + 1} of 4</p>
          <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none sm:text-2xl">{stage.title}</h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{stage.description}</p>
        </div>
      </header>
      {error && <p role="alert" className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      <div className="space-y-6">
        {step === 2 && orderCount > 1 && <BatchPaymentOptions disabled={disabled} />}
        {children}
      </div>
    </div>
  </div>;
}

export function OrderSubmissionStatus() {
  const { form, collectDrafts, orderCount } = useOrders();
  useWatch({ control: form.control });
  const drafts = collectDrafts();
  const known = drafts.every(draft => draft.data.items.length > 0 && draft.data.items.every(item => item.price !== undefined));
  const total = drafts.reduce((sum, draft) => sum + Math.round(orderTotal(draft.data) * 100), 0) / 100;
  return <div role="group" className="flex w-full items-center justify-between gap-4 text-xs sm:mr-auto sm:w-auto sm:flex-col sm:items-start sm:gap-1" aria-label="Submission total">
    <span className="text-muted-foreground">{orderCount} {orderCount === 1 ? "order" : "orders"} / Unsaved draft</span>
    <span className="font-semibold tabular-nums">{known ? formatCurrency(total) : "Add items to calculate total"}</span>
  </div>;
}
