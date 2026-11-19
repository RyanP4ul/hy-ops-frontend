import { Badge } from "@/components/ui/badge";
import type { PaymentRowType } from "@/schema/payment";

export const paymentMethods = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
};

const paymentStatuses = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  UNVERIFIED: "Unverified",
};

export function orderLabel(payment: PaymentRowType) {
  return payment.order_number ?? `Order #${payment.order_id}`;
}

export function canCollect(payment: PaymentRowType) {
  return payment.order_status !== "CANCELLED" && payment.payment_status !== "UNVERIFIED"
    && payment.remaining_amount != null && Number.isFinite(Number(payment.remaining_amount))
    && Number(payment.remaining_amount) > 0;
}

export function OrderPaymentStatus({ payment }: { payment: PaymentRowType }) {
  const fullyRefunded = Number(payment.refunded_amount) > 0 && Number(payment.amount) === 0;
  const label = fullyRefunded ? "Fully refunded" : payment.order_status === "CANCELLED"
    ? "Cancelled"
    : paymentStatuses[payment.payment_status] ?? payment.payment_status;
  return <Badge variant={label === "Paid" ? "default" : label === "Unverified" ? "outline" : "secondary"}>{label}</Badge>;
}
