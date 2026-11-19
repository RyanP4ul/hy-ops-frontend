import { z } from "zod";

export const paymentRowSchema = z.object({
  id: z.number().int(),
  combined_payment_number: z.string().nullable().optional(),
  combined_payment_reference: z.string().nullable().optional(),
  combined_payment_amount: z.coerce.number().nullable().optional(),
  combined_payment_allocation: z.coerce.number().nullable().optional(),
  payment_number: z.string().min(1, "Payment number is required").max(32),
  order_id: z.number().int().min(1, "Order is required"),
  order_number: z.string().nullable().optional(),
  customer_id: z.number().int().min(1, "Customer is required"),
  customer_name: z.string().max(100).nullable(),
  payment_method: z.enum(["CASH", "BANK_TRANSFER", "CARD"]),
  payment_type: z.string().max(100).nullable().optional(),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "UNVERIFIED"]),
  amount: z.number().nonnegative("Amount must be a non-negative number"),
  refunded_amount: z.number().nonnegative(),
  gross_received: z.number().nonnegative(),
  order_status: z.string(),
  remaining_amount: z.number().nonnegative("Remaining amount must be a non-negative number").nullable(),
  reference_number: z.string().max(100).nullable().optional(),
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
export type GroupedPayment = {
  entry_type: "GROUP";
  group_id: string;
  payment_number: string;
  received_amount: string;
  received_at: string;
  customer_id: number;
  customer_name: string | null;
  payment_method: PaymentRowType["payment_method"];
  payment_type: string | null;
  reference_number: string | null;
  orders: PaymentRowType[];
};
export type PaymentListEntry = GroupedPayment | { entry_type: "SINGLE"; payment: PaymentRowType };
export type PaymentFormType = z.infer<typeof paymentSchema>;
