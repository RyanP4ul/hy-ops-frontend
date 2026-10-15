import { z } from "zod";

const baseUserSchema = {
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
};

const customerProfileSchema = z.object({
  company_name: z.string(),
  phone_number: z.string(),
  address: z.string(),
});

const driverProfileSchema = z.object({
  status: z.string(),
  phone_number: z.string(),
});

export const userSchema = z.discriminatedUnion("role", [
  z.object({
    ...baseUserSchema,
    role: z.enum(["admin", "staff"]),
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
