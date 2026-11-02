import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Package,
  UserRound,
} from "lucide-react";
import type { ChangeEvent } from "react";
import {
  formatCurrency,
  formatDueDate,
  getPaymentArrangementLabel,
} from "../lib/format";
import type { DeliveryStop, PaymentArrangement } from "../types";

// One delivery stop with its order popover. Reused by the current and scheduled lists.
export function StopRow({
  stop,
  index,
  orderOpen,
  onOrderOpenChange,
  onPaymentChange,
}: {
  stop: DeliveryStop;
  index: number;
  orderOpen: boolean;
  onOrderOpenChange: (open: boolean) => void;
  onPaymentChange: (orderId: string, arrangement: PaymentArrangement) => void;
}) {
  const completed = stop.status === "completed";

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
      {completed ? (
        <CheckCircle2 className="size-5 shrink-0 text-green-600" />
      ) : (
        <Clock3 className="size-5 shrink-0 text-amber-500" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {index + 1}. {stop.name}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {stop.address}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {stop.order.id} · {formatCurrency(stop.order.totalAmount)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${
            completed
              ? "bg-green-500/10 text-green-600"
              : "bg-amber-500/10 text-amber-700"
          }`}
        >
          {completed ? "Completed" : "Pending"}
        </span>
        <Popover open={orderOpen} onOpenChange={onOrderOpenChange}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition hover:bg-muted"
              >
                View order
              </button>
            }
          />
          <PopoverContent
            side="right"
            align="start"
            className="z-[100] max-h-[min(70vh,640px)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
          >
            <div className="overflow-hidden rounded-lg">
              <div className="flex items-start justify-between gap-3 border-b bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">ORDER DETAILS</p>
                  <p className="mt-1 text-sm font-semibold">{stop.order.id}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                  {getPaymentArrangementLabel(stop.order.paymentArrangement)}
                </span>
              </div>

              <div className="space-y-3 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <UserRound className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {stop.order.customer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {stop.order.customer.code} · {stop.order.customer.phone}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`payment-arrangement-${stop.order.id}`}
                    className="flex items-center gap-2 text-xs font-semibold"
                  >
                    <CreditCard className="size-3.5 text-muted-foreground" />
                    Payment arrangement
                  </label>
                  <select
                    id={`payment-arrangement-${stop.order.id}`}
                    value={stop.order.paymentArrangement}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      onPaymentChange(
                        stop.order.id,
                        event.target.value as PaymentArrangement,
                      )
                    }
                    className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="FULLY_PAID">Fully paid</option>
                    <option value="PARTIALLY_PAID">Partially paid</option>
                    <option value="PAY_ON_DELIVERY">Pay on delivery</option>
                    <option value="NET_30">Net 30</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold">
                    <Package className="size-3.5 text-muted-foreground" />
                    Items
                  </p>
                  {stop.order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      Payment method
                    </span>
                    <span className="font-medium">
                      {stop.order.paymentMethod?.replaceAll("_", " ") ??
                        "None yet"}
                    </span>
                  </div>
                  {stop.order.paymentArrangement === "NET_30" &&
                    stop.order.dueDate && (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Due date</span>
                        <span className="font-medium">
                          {formatDueDate(stop.order.dueDate)}
                        </span>
                      </div>
                    )}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Order total</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(stop.order.totalAmount)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Amount paid</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(stop.order.amountPaid)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 border-t pt-2">
                    <span className="font-medium">Balance due</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(
                        Math.max(
                          0,
                          stop.order.totalAmount - stop.order.amountPaid,
                        ),
                      )}
                    </span>
                  </div>
                </div>
                {stop.order.paymentArrangement === "NET_30" && (
                  <p className="text-[11px] text-muted-foreground">
                    Net 30 orders are payable within 30 days of the agreed
                    invoice/credit date. Track the actual due date in the order
                    record.
                  </p>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
