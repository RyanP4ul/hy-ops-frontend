import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../lib/format";
import type { DeliveryStop, PaymentArrangement } from "../types";
import { OrderSummary } from "./order-summary";

type StopTimelineProps = {
  stops: DeliveryStop[];
  /** Highlighted as "Next stop". */
  nextStopId: string | undefined;
  expandedId: string | null;
  onToggle: (stopId: string) => void;
  onPaymentChange: (orderId: string, arrangement: PaymentArrangement) => void;
};

export function StopTimeline({
  stops,
  nextStopId,
  expandedId,
  onToggle,
  onPaymentChange,
}: StopTimelineProps) {
  return (
    <ol>
      {stops.map((stop, index) => {
        const completed = stop.status === "completed";
        const isNext = stop.id === nextStopId;
        const expanded = expandedId === stop.id;
        const isLast = index === stops.length - 1;

        return (
          <li key={stop.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-3 top-7 -ml-px h-[calc(100%-1.75rem)] w-0.5",
                  completed ? "bg-emerald-500/60" : "bg-border",
                )}
              />
            ) : null}

            <span
              className={cn(
                "z-[1] flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                completed && "border-emerald-500 bg-emerald-500 text-white",
                isNext && "border-primary bg-primary text-primary-foreground",
                !completed &&
                  !isNext &&
                  "border-border bg-background text-muted-foreground",
              )}
            >
              {completed ? <Check className="size-3.5" /> : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onToggle(stop.id)}
                aria-expanded={expanded}
                className="group flex w-full items-start justify-between gap-2 rounded-md text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {stop.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {stop.address}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      completed && "text-emerald-700 dark:text-emerald-400",
                      isNext && "font-medium text-primary",
                      !completed && !isNext && "text-muted-foreground",
                    )}
                  >
                    {completed ? "Delivered" : isNext ? "Next stop" : "Pending"}
                    <span className="text-muted-foreground">
                      {" "}
                      · {stop.order.id} ·{" "}
                      {formatCurrency(stop.order.totalAmount)}
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              {expanded ? (
                <OrderSummary
                  order={stop.order}
                  onPaymentChange={onPaymentChange}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
