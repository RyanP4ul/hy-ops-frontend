import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().min(1, "Warehouse name is required"),

  street_address: z.string().min(1, "Street address is required"),

  city: z.string().min(1, "City is required"),

  state: z.string().min(1, "Province is required"),

  zip_code: z.string().min(1, "ZIP code is required"),

  latitude: z.number().optional(),

  longitude: z.number().optional(),
});

export type WarehouseForm = z.infer<typeof warehouseSchema>;
