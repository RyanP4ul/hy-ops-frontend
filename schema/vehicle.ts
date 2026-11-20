import { z } from "zod";

export const vehicleSchema = z.object({
  warehouse_id: z.number().min(1, "Warehouse ID must be greater than 0"),
  plate_number: z.string().trim().min(1, "Plate number is required"),
  max_weight_kg: z.union([z.number().min(0), z.null()]).optional(),
  max_volume_cbm: z.union([z.number().min(0), z.null()]).optional(),
  current_odometer_km: z.number().min(0).optional(),
  next_service_odometer_km: z.union([z.number().min(0), z.null()]).optional(),
});

export type VehicleForm = z.infer<typeof vehicleSchema>;
export type VehicleRow = VehicleForm & {
  id: number;
  status: "available" | "unavailable" | "maintenance" | "on_delivery";
  type: "truck" | "van" | "other";
  warehouse_name: string;
  open_maintenance_count?: number;
  version: number;
  is_active?: boolean;
  is_operational?: boolean;
  created_at: number;
  updated_at: number;
};
