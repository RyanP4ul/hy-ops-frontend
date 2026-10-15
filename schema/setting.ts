import z from "zod";

export const settingSchema = z.object({
  id: z.number().nonnegative(),
  name: z.string().min(1).nonempty(),
  value: z.string().min(1).nonempty(),
});

export const generalSettingSchema = z.object({
  is_form_validation_debug_enabled: z.boolean(),
  refresh_interval_ms: z.number().nonnegative(),
});

export const stockStatusSchema = z.object({
  low_stock_threshold: z.number().nonnegative(),
  high_stock_threshold: z.number().nonnegative(),
});

export type GeneralSettingSchema = z.infer<typeof generalSettingSchema>;
export type SettingSchema = z.infer<typeof settingSchema>;
export type StockStatusSchema = z.infer<typeof stockStatusSchema>;
