import { z } from "zod";

export const CalendarForm = z.object({
  id: z.number().optional(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),
  category: z.string().min(1, "Category is required"),
  date: z.date({
    error: "Date is required",
  }),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
});

export interface CalendarEventResponse {
  id: number;
  title: string;
  category: string;
  date: Date;
  start_time: Date;
  end_time: Date;
}

export type CalendarFormType = z.infer<typeof CalendarForm>;
