import z from "zod";

export const inventoryTableSchema = z.object({
  id: z.number().nonnegative(),
  product_name: z.string().min(1).nonempty(),
  description: z.string().nullable().optional(),
  sku: z.string().min(1).nonempty(),
  reserved: z.number().nonnegative(),
  warehouse_name: z.string().min(1).nonempty(),
  quantity: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  version: z.number().nonnegative(),
});

export const inventorySchema = z.object({
  warehouse_id: z.number().int().positive("Select a warehouse"),
  product_variant_id: z.number().int().positive("Select a product variant"),
  quantity: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative().optional(),
  reason: z.string().max(500).optional(),
});

export type InventoryType = z.infer<typeof inventorySchema>;
export type InventoryTableSchemaType = z.infer<typeof inventoryTableSchema>;
