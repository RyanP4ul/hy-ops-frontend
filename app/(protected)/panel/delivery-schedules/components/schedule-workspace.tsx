"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { format } from "date-fns";
import { Check, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryFeedback } from "@/components/query-feedback";
import { formatCurrency } from "@/utils/date-util";
import { useDeliverySchedule } from "../provider";

const labels = ["Warehouse", "Departure", "Orders", "Assignment", "Expenses", "Review"];

export function ScheduleWorkspace({ children, disabled, title, description }: {
  children: ReactNode; disabled: boolean; title: string; description: string;
}) {
  const { form, step, setStep, warehouseCB, vehicleCB, orderDetailQuery, removeSelection } = useDeliverySchedule();
  const values = useWatch({ control: form.control });
  const ids = values.order_ids ?? [];
  const orders = ids.length ? orderDetailQuery.data ?? [] : [];
  const editor = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const expense = Number(values.delivery_allowance ?? 0) + Number(values.fuel ?? 0) + Number(values.toll ?? 0);
  useEffect(() => {
    editor.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  return <div className="grid min-h-0 min-w-0 overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden">
    <aside aria-label="Delivery run summary" className={`${ids.length ? "block" : "hidden lg:block"} min-w-0 border-b bg-muted/25 lg:overflow-y-auto lg:border-r lg:border-b-0`}>
      <div className="space-y-3 p-3 lg:space-y-4 lg:p-5">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Delivery run</h3><span className="rounded-full border px-2 py-0.5 text-xs">{ids.length} stops</span></div>
        <dl className="hidden space-y-3 text-sm lg:block">
          <div><dt className="text-xs text-muted-foreground">Warehouse</dt><dd className="mt-1 font-medium">{warehouseCB.inputValue || (values.warehouse_id && values.warehouse_id > 0 ? `Warehouse #${values.warehouse_id}` : "Choose a warehouse")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Departure (Manila)</dt><dd className="mt-1">{values.scheduled_date ? format(values.scheduled_date, "MMM d, yyyy") : "Choose a date"}<br />{values.scheduled_time || "Choose a time"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Vehicle</dt><dd className="mt-1">{vehicleCB.inputValue || "Not assigned"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Delivery expenses</dt><dd className="mt-1 font-semibold">{formatCurrency(expense)}</dd></div>
        </dl>
        {ids.length > 0 && <QueryFeedback query={orderDetailQuery} label="selected orders" />}
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {ids.map((id, index) => {
            const order = orders.find(row => row.id === id);
            return <li key={id} className="w-56 shrink-0 rounded-xl border bg-background p-2.5 lg:w-full lg:p-3">
              <div className="flex items-start gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="break-all text-xs font-semibold">{order?.order_number || `Order #${id}`}</p><p className="mt-1 hidden truncate text-xs text-muted-foreground lg:block">{order?.customer_company}</p></div>
                {order && (!order.order_group_id || index === orders.findIndex(member => member.order_group_id === order.order_group_id)) && <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={disabled}
                  aria-label={`Remove ${order.order_group_number ? `group ${order.order_group_number}` : order.order_number} from delivery`}
                  onClick={() => removeSelection(id)}><Trash2 className="size-3.5" /></Button>}
              </div>
              {order?.order_group_number && <p className="mt-2 hidden break-all rounded-md bg-muted px-2 py-1 text-[11px] lg:block">{order.order_group_number} / {order.order_group_position} of {order.order_group_size}</p>}
              <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground"><MapPin className="mt-0.5 size-3 shrink-0" /><span className="line-clamp-1 lg:line-clamp-2">{order?.destination || "Loading saved destination..."}</span></p>
            </li>;
          })}
        </ol>
        {!ids.length && <p className="text-xs leading-relaxed text-muted-foreground">Add single orders or complete order groups. Every group member must be ready. Each order keeps its saved shipping destination.</p>}
      </div>
    </aside>
    <main ref={editor} className="min-w-0 px-4 py-5 sm:px-7 lg:min-h-0 lg:overflow-y-auto">
      <nav aria-label="Delivery schedule progress" className="mb-6 grid grid-cols-3 gap-1 rounded-xl border bg-muted/30 p-1 sm:grid-cols-6">
        {labels.map((label, index) => <Button key={label} type="button" variant="ghost" aria-current={step === index ? "step" : undefined}
          disabled={disabled || index > step} onClick={() => setStep(index)}
          className={`h-auto min-w-0 flex-col gap-1 rounded-lg px-1 py-2 text-[11px] ${step === index ? "bg-foreground text-background hover:bg-foreground hover:text-background" : ""}`}>
          <span className="flex size-5 items-center justify-center rounded-full border text-[10px]">{index < step ? <Check className="size-3" /> : index + 1}</span>{label}
        </Button>)}
      </nav>
      <div className="mb-6"><p className="mb-1 text-xs font-medium text-muted-foreground">STEP {step + 1} OF 6</p><h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
      <div className="min-w-0 space-y-5">{children}</div>
    </main>
  </div>;
}
