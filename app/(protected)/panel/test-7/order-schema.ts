import { z } from "zod";

export const orderSchema = z
  .object({
    customer: z.string().trim().min(1, "Please select a customer."),
    product: z.string().trim().min(1, "Please select a product."),
    quantity: z
      .number({ error: "Quantity is required." })
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1."),

    deliveryMethod: z.enum(["truck", "lalamove"]),
    driver: z.string(),
    vehicle: z.string(),

    scheduledDate: z
      .string()
      .min(1, "Please select a delivery date.")
      .refine((value) => {
        const date = new Date(`${value}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return !Number.isNaN(date.getTime()) && date >= today;
      }, "Delivery date cannot be in the past."),

    paymentMethod: z.enum(["cash", "bank_transfer", "card"]),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === "truck") {
      if (!data.driver) {
        ctx.addIssue({
          code: "custom",
          path: ["driver"],
          message: "Please select a driver.",
        });
      }

      if (!data.vehicle) {
        ctx.addIssue({
          code: "custom",
          path: ["vehicle"],
          message: "Please select a vehicle.",
        });
      }
    }
  });

export type OrderWizardData = z.infer<typeof orderSchema>;
