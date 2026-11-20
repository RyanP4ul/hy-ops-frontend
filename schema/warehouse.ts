import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone_number: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").nullish(),
  street_address: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "Province is required"),
  zip_code: z.string().min(1, "ZIP code is required"),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  daily_order_limit: z.number().int().min(1).nullish(),
  arrival_radius_m: z.number().int().min(25).max(5000).nullish(),
  operating_days: z.array(z.number().int().min(0).max(6)).nullish(),
  search_address: z.string().optional(),
}).refine(value => (value.latitude == null) === (value.longitude == null), { path: ["longitude"], message: "Enter both latitude and longitude, or leave both blank." });

export type WarehouseForm = z.infer<typeof warehouseSchema>;
export type WarehouseRow = WarehouseForm & {
  id: number;
  is_active?: boolean;
  created_at: number;
  updated_at: number;
};
