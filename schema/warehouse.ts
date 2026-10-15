import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  street_address: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(1, "ZIP code is required"),
  search_address: z.string().optional(),
});

export type WarehouseForm = z.infer<typeof warehouseSchema>;
export type WarehouseRow = WarehouseForm & {
  id: number;
  created_at: number;
  updated_at: number;
};
