import { z } from "zod";
import { orderSchema, type OrderForm } from "./order";

export type PaymentMode = "SEPARATE" | "COMBINED";
export const combinedPaymentSchema = z.object({
  payment_method: z.enum(["CASH", "BANK_TRANSFER", "CARD"]),
  payment_type: z.string().trim().max(100).optional(),
  amount_paid: z.number().positive("Enter the combined amount received").max(9999999999.99),
  reference_number: z.string().trim().max(100).optional(),
}).superRefine((data, ctx) => {
  if (data.payment_method !== "CASH" && !data.payment_type?.trim()) ctx.addIssue({ code: "custom", path: ["payment_type"], message: "Select or enter a payment type" });
  if (Math.round(data.amount_paid * 100) / 100 !== data.amount_paid) ctx.addIssue({ code: "custom", path: ["amount_paid"], message: "Use no more than two decimal places" });
});
export type CombinedPayment = z.infer<typeof combinedPaymentSchema>;
export const emptyCombinedPayment: CombinedPayment = { payment_method: "CASH", payment_type: "", amount_paid: 0, reference_number: "" };

// Per-order payment entries remain in the drafts when the operator switches modes.
export function draftForPaymentMode(order: OrderForm, mode: PaymentMode): OrderForm {
  return mode === "COMBINED" ? { ...order, payment_method: "CASH", payment_type: undefined, payment_arrangement: "NET_30", amount_paid: 0 } : order;
}
export function orderTotal(order: OrderForm): number {
  return order.items.reduce((sum, item) => sum + Math.round((item.price ?? 0) * 100) * item.quantity, 0) / 100;
}
export function allocateCombinedPayment(amount: number, totals: number[]): number[] | null {
  const cents = totals.map(total => Math.round(total * 100));
  const paid = Math.round(amount * 100);
  const total = cents.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(paid) || paid <= 0 || cents.some(value => !Number.isSafeInteger(value) || value < 0) || !Number.isSafeInteger(total) || paid > total) return null;
  const bigPaid = BigInt(paid), bigTotal = BigInt(total);
  const allocations = cents.map(value => bigPaid * BigInt(value) / bigTotal);
  const ranks = cents.map((value, index) => ({ index, remainder: bigPaid * BigInt(value) % bigTotal }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  let remaining = bigPaid - allocations.reduce((sum, value) => sum + value, BigInt(0));
  for (const { index } of ranks) {
    if (remaining === BigInt(0)) break;
    allocations[index] += BigInt(1); remaining -= BigInt(1);
  }
  return allocations.map(value => Number(value) / 100);
}
export function previewCombinedOrders(orders: OrderForm[], payment: CombinedPayment): OrderForm[] {
  const allocations = allocateCombinedPayment(payment.amount_paid, orders.map(orderTotal));
  return orders.map((order, index) => {
    const paid = allocations?.[index] ?? 0;
    return { ...order, payment_method: payment.payment_method, payment_type: payment.payment_type,
      amount_paid: paid, payment_arrangement: paid === orderTotal(order) ? "FULLY_PAID" : paid > 0 ? "PARTIALLY_PAID" : "NET_30" };
  });
}

export const orderBatchFormSchema = z.preprocess(value => {
  if (!value || typeof value !== "object") return value;
  const batch = value as { payment_mode?: PaymentMode; orders?: OrderForm[]; combined_payment?: CombinedPayment };
  return { ...batch, combined_payment: batch.payment_mode === "COMBINED" ? batch.combined_payment : undefined,
    orders: Array.isArray(batch.orders) ? batch.orders.map(order => draftForPaymentMode(order, batch.payment_mode ?? "SEPARATE")) : batch.orders };
}, z.object({
  customer_id: z.number().int().positive("Select a customer"),
  payment_mode: z.enum(["SEPARATE", "COMBINED"]).optional(),
  combined_payment: combinedPaymentSchema.optional(),
  orders: z.array(orderSchema).min(1, "Add at least one order").max(25, "Submit up to 25 orders together"),
})).superRefine((batch, ctx) => {
  batch.orders.forEach((order, index) => {
    const issue = (field: string, message: string) => ctx.addIssue({ code: "custom", path: ["orders", index, field], message });
    if (order.customer_id !== batch.customer_id) issue("customer_id", "All orders must belong to the selected customer");
    if (order.items.some(item => item.price === undefined)) { issue("items", "Confirm item prices before creating orders"); return; }
    if (batch.payment_mode === "COMBINED") return;
    const total = Math.round(orderTotal(order) * 100), paid = Math.round(order.amount_paid * 100);
    if (paid > total || (order.payment_arrangement === "FULLY_PAID" && paid !== total) ||
      (order.payment_arrangement === "PARTIALLY_PAID" && (paid <= 0 || paid >= total))) issue("amount_paid", "Amount must match the payment arrangement and stay within the order total");
  });
  if (batch.payment_mode === "COMBINED") {
    if (!batch.combined_payment) ctx.addIssue({ code: "custom", path: ["combined_payment"], message: "Enter the combined payment details" });
    else if (!allocateCombinedPayment(batch.combined_payment.amount_paid, batch.orders.map(orderTotal))) ctx.addIssue({ code: "custom", path: ["combined_payment", "amount_paid"], message: "Combined payment cannot exceed the combined order total" });
  }
});

export function toOrderBatchPayload(batch: z.infer<typeof orderBatchFormSchema>) {
  const orders = batch.orders.map(data => {
    const { customer_id, ...order } = data;
    if (customer_id !== batch.customer_id) throw new Error("All orders must belong to the selected customer");
    if (batch.payment_mode === "COMBINED") {
      const entry: Partial<typeof order> = { ...order };
      delete entry.payment_method; delete entry.payment_type; delete entry.payment_arrangement; delete entry.amount_paid;
      return { ...entry, expected_total: orderTotal(data) };
    }
    return { ...order, payment_type: order.payment_method === "CASH" ? undefined : order.payment_type?.trim() };
  });
  if (batch.payment_mode === "COMBINED" && batch.combined_payment) return {
    customer_id: batch.customer_id, payment_mode: "COMBINED", orders,
    payment: { ...batch.combined_payment, payment_type: batch.combined_payment.payment_method === "CASH" ? undefined : batch.combined_payment.payment_type?.trim() },
  };
  return { customer_id: batch.customer_id, payment_mode: "SEPARATE", orders };
}
