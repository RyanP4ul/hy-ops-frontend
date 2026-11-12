import { z } from "zod";

export type DeliveryExpense = {
  id: number;
  delivery_allowance: string;
  fuel: string;
  toll: string;
  status: "pending" | "approved" | "rejected";
};

export type DeliveriesRow = {
  delivery_id: number;
  driver_name: string;
  is_overdue?: boolean;
  vehicle_plate_number: string;
  vehicle_type: string;
  delivery_type: string;
  scheduled_date: string;
  departure_time: string;
  status: string;
  orders: {
    stop_id?: number;
    return_id?: number | null;
    return_status?: string | null;
    order_id: number;
    order_number: string;
    status: string;
    failure_reason?: string | null;
    shipping_address: string | null;
    customer_address: string | null;
  }[];
  pickups?: { id: number; orderNumber: string; status: string }[];
  warehouse: {
    id: number;
    name: string;
    street_address: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
  version: number;
};

export const DeliveriesEventForm = z
  .object({
    delivery_id: z.number(),
    event_type: z.enum(["CANCELLED", "RESCHEDULED"]),
    reason: z.string().trim().min(1).max(255),
    scheduled_date: z
      .date({
        error: "Scheduled date is required",
      })
      .optional(),
    departure_time: z.string().min(1, "Scheduled time is required").optional(),
    delivery_version: z.number().min(1, "Delivery version is required"),
  })
  .superRefine((data, ctx) => {
    if (data.event_type === "RESCHEDULED") {
      if (!data.scheduled_date) {
        ctx.addIssue({
          code: "custom",
          path: ["scheduled_date"],
          message: "Scheduled date is required when rescheduling a delivery",
        });
      }

      if (!data.departure_time) {
        ctx.addIssue({
          code: "custom",
          path: ["departure_time"],
          message: "Departure time is required when rescheduling a delivery",
        });
      }
    }
  });

export type DeliveriesEventFormType = z.infer<typeof DeliveriesEventForm>;

export const DeliveriesAssignmentForm = z.object({
  delivery_id: z.number().min(1),
  driver_id: z.number().min(1, "Driver is required"),
  vehicle_id: z.number().min(1, "Vehicle is required"),
  delivery_version: z.number().min(1, "Delivery version is required"),
});

export type DeliveriesAssignmentFormType = z.infer<
  typeof DeliveriesAssignmentForm
>;
