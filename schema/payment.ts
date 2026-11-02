import { z } from "zod";

export const paymentRowSchema = z.object({
  id: z.number().int(),
  payment_number: z.string().min(1, "Payment number is required").max(32),
  order_id: z.number().int().min(1, "Order is required"),
  customer_id: z.number().int().min(1, "Customer is required"),
  customer_name: z.string().max(100).nullable(),
  payment_method: z.enum(["CASH", "BANK_TRANSFER", "CARD"]),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "UNVERIFIED"]),
  amount: z.number().nonnegative("Amount must be a non-negative number"),
  refunded_amount: z.number().nonnegative(),
  gross_received: z.number().nonnegative(),
  order_status: z.string(),
  remaining_amount: z.number().nonnegative("Remaining amount must be a non-negative number").nullable(),
  reference_number: z.string().max(100).optional(),
  received_at: z.string().nullable(),
  version: z.number().int(),
});

export const paymentSchema = z.object({
  payment_number: z.string().min(1, "Payment number is required").max(32),
  order_id: z.number().int().min(1, "Order is required"),
  payment_amount: z
    .number()
    .positive("Amount must be greater than zero"),
  version: z.number().int(),
});

export type PaymentRowType = z.infer<typeof paymentRowSchema>;
export type PaymentFormType = z.infer<typeof paymentSchema>;
