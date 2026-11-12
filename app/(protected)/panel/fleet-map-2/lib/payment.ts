import type { DeliveryStop, PaymentArrangement } from "../types";

/**
 * Optimistic UI update for a payment-arrangement change.
 *
 * Only the arrangement changes. `amountPaid` is the sum of real payment records on the
 * server, so it is never recomputed here; the refetch that follows the mutation brings
 * back authoritative values (including the NET_30 due date).
 */
export function withPaymentArrangement(
  stop: DeliveryStop,
  arrangement: PaymentArrangement,
): DeliveryStop {
  return {
    ...stop,
    order: {
      ...stop.order,
      paymentArrangement: arrangement,
      dueDate: arrangement === "NET_30" ? stop.order.dueDate : undefined,
    },
  };
}
