import { z } from "zod";

export const orderPaymentMethodSchema = z.enum(["CASH", "BANK_TRANSFER"]);
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;

export const orderPaymentMethodLabels: Record<OrderPaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
};
