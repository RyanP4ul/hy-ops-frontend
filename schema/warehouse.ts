import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  street_address: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "Province is required"),
  zip_code: z.string().min(1, "ZIP code is required"),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  search_address: z.string().optional(),
}).refine(value => (value.latitude == null) === (value.longitude == null), { path: ["longitude"], message: "Enter both latitude and longitude, or leave both blank." });

export type WarehouseForm = z.infer<typeof warehouseSchema>;
export type WarehouseRow = WarehouseForm & {
  id: number;
  created_at: number;
  updated_at: number;
};
