import { z } from "zod";

export const vehicleSchema = z.object({
  plate_number: z.string().min(1, "Plate number is required"),
  status: z.enum(["available", "unavailable", "maintenance", "on_delivery"]),
  type: z.enum(["truck", "van", "other"]),
  image: z.string().min(1, "Image path is required"),
});

export type VehicleForm = z.infer<typeof vehicleSchema>;
export type VehicleRow = VehicleForm & {
  id: number;
  version: number;
  created_at: number;
  updated_at: number;
};
