import z from "zod";

export const productVariantSchema = z.object({
  id: z.number().nonnegative().optional(),
  name: z.string().nonempty({ message: "Name is required" }),
  sku: z.string().nonempty({ message: "SKU is required" }),
  description: z.string().nonempty({ message: "Description is required" }),
  price: z.string().nonempty({ message: "Price is required" }),
  unit: z.string().nonempty({ message: "Unit is required" }),
  weight_kg: z.string().nonempty({ message: "Weight is required" }),
  width_value: z.string().nonempty({ message: "Width is required" }),
  width_unit: z.string().nonempty({ message: "Width unit is required" }),
  length_value: z.string().nonempty({ message: "Length is required" }),
  length_unit: z.string().nonempty({ message: "Length unit is required" }),
});

export const productSchema = z.object({
  id: z.number().nonnegative().optional(),
  name: z.string().nonempty({ message: "Name is required" }),
  variants: z.array(productVariantSchema),
  version: z.number().nonnegative(),
});

export type ProductVariantType = z.infer<typeof productVariantSchema>;
export type ProductType = z.infer<typeof productSchema>;
export type ProductVariantRow = ProductVariantType & {
  id: number;
};
