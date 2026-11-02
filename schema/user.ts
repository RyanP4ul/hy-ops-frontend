import { z } from "zod";

const baseUserSchema = {
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
};

const staffProfileSchema = z.object({
  warehouse_id: z.number().min(1, "Warehouse is required"),
  warehouse_name: z.string(),
});

const customerProfileSchema = z.object({
  search_address: z.string(),
  company_name: z.string(),
  phone_number: z.string(),
  address_line: z.string().nonempty("Address is required"),
  barangay: z.string().nonempty("Barangay is required"),
  city_municipality: z.string().nonempty("City/Municipality is required"),
  province: z.string().nonempty("Province is required"),
  postal_code: z.string(),
  latitude: z.string(),
  longitude: z.string(),
});

const driverProfileSchema = z.object({
  warehouse_id: z.number().min(1, "Warehouse is required"),
  warehouse_name: z.string(),
  status: z.string(),
  phone_number: z.string(),
});

export const userSchema = z.discriminatedUnion("role", [
  z.object({
    ...baseUserSchema,
    role: z.enum(["admin"]),
  }),

  z.object({
    ...baseUserSchema,
    role: z.literal("staff"),
    profile: staffProfileSchema.optional(),
  }),

  z.object({
    ...baseUserSchema,
    role: z.literal("customer"),
    profile: customerProfileSchema.optional(),
  }),

  z.object({
    ...baseUserSchema,
    role: z.literal("driver"),
    profile: driverProfileSchema.optional(),
  }),
]);

export type UserForm = z.infer<typeof userSchema>;

export type UserRow = UserForm & {
  id: number;
  password?: never;
  last_login: number | null;
  created_at: number;
  updated_at: number;
};
