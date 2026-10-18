import { z } from "zod";

export type DeliveriesRow = {
  delivery_id: number;
  driver_name: string;
  vehicle_plate_number: string;
  vehicle_type: string;
  delivery_type: string;
  scheduled_date: string;
  departure_time: string;
  status: string;
  orders: {
    order_id: number;
    order_number: string;
    status: string;
  }[];
  version: number;
};

export const DeliveriesEventForm = z
  .object({
    delivery_id: z.number(),
    event_type: z.enum(["CANCELLED", "RESCHEDULED"]),
    reason: z.string().min(1).max(255),
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
