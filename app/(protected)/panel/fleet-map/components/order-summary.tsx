import { Phone } from "lucide-react";
import {
  formatCurrency,
  formatDueDate,
  getPaymentArrangementLabel,
} from "../lib/format";
import type { OrderDetails, PaymentArrangement } from "../types";

export function OrderSummary({
  order,
}: {
  order: OrderDetails;
  onPaymentChange: (orderId: string, arrangement: PaymentArrangement) => void;
}) {
  const balance =
    order.totalAmount === null
      ? null
      : Math.max(0, order.totalAmount - order.amountPaid);

  return (
    <div className="mt-2 space-y-3 rounded-lg border bg-muted/30 p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{order.customer.name}</p>
          <p className="text-muted-foreground">
            {order.customer.code} · Order {order.id}
          </p>
        </div>
        <a
          href={`tel:${order.customer.phone}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 font-medium hover:bg-accent"
        >
          <Phone className="size-3" />
          {order.customer.phone}
        </a>
      </div>

      <ul className="divide-y rounded-md border bg-background">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-3 px-2.5 py-1.5"
          >
            <span className="min-w-0 truncate">
              {item.quantity} × {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.unitPrice === null
                ? "Unverified"
                : formatCurrency(item.quantity * item.unitPrice)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="tabular-nums">{formatCurrency(order.totalAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            Paid
            {order.paymentMethod
              ? ` (${order.paymentMethod.replaceAll("_", " ").toLowerCase()})`
              : ""}
          </dt>
          <dd className="tabular-nums">{formatCurrency(order.amountPaid)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Balance</dt>
          <dd className="tabular-nums">{formatCurrency(balance)}</dd>
        </div>
        {order.dueDate ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Due</dt>
            <dd>{formatDueDate(order.dueDate)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-1"><p className="font-medium">Payment arrangement</p><p>{getPaymentArrangementLabel(order.paymentArrangement)}</p><p className="text-muted-foreground">Recorded at checkout. Record collections and refunds in Payments.</p></div>
    </div>
  );
}
