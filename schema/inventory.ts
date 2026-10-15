import z from "zod";

export const inventoryTableSchema = z.object({
  id: z.number().nonnegative(),
  product_name: z.string().min(1).nonempty(),
  sku: z.string().min(1).nonempty(),
  reserved: z.number().nonnegative(),
  warehouse_name: z.string().min(1).nonempty(),
  quantity: z.number().nonnegative(),
  price: z.number().nonnegative(),
  version: z.number().nonnegative(),
});

export const inventorySchema = z.object({
  warehouse_id: z.number().nonnegative(),
  product_variant_id: z.number().nonnegative(),
  quantity: z.number().nonnegative(),
  reserved: z.number().nonnegative().optional(),
});

export type InventoryType = z.infer<typeof inventorySchema>;
export type InventoryTableSchemaType = z.infer<typeof inventoryTableSchema>;
