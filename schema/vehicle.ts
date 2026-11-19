import { z } from "zod";

export const vehicleSchema = z.object({
  warehouse_id: z.number().min(1, "Warehouse ID must be greater than 0"),
  plate_number: z.string().trim().min(1, "Plate number is required"),
});

export type VehicleForm = z.infer<typeof vehicleSchema>;
export type VehicleRow = VehicleForm & {
  id: number;
  status: "available" | "unavailable" | "maintenance" | "on_delivery";
  type: "truck" | "van" | "other";
  warehouse_name: string;
  version: number;
  is_active?: boolean;
  is_operational?: boolean;
  created_at: number;
  updated_at: number;
};
