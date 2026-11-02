import { z } from "zod";
import type { DeliveryCalendarEntry } from "./delivery-calendar";

export const CalendarForm = z.object({
  id: z.number().optional(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(50, "Title must be at most 50 characters"),
  category: z.string().min(1, "Category is required"),
  date: z.date({
    error: "Date is required",
  }),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
}).refine((event) => event.end_time > event.start_time, { path: ["end_time"], message: "End time must be after start time" });

export interface CalendarEventResponse {
  delivery?: DeliveryCalendarEntry;
  id: number;
  version: number;
  title: string;
  category: string;
  date: Date;
  start_time: Date;
  end_time: Date;
}

export type CalendarFormType = z.infer<typeof CalendarForm>;
