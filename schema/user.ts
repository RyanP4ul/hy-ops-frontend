import { z } from "zod";
import { savedAddressSchema, savedCoordinatesSchema } from "./shipping-address";

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

export const emptyCustomerProfile = {
  search_address: "",
  company_name: "",
  phone_number: "",
  address_line: "",
  barangay: "",
  city_municipality: "",
  province: "",
  postal_code: "",
  latitude: "",
  longitude: "",
} satisfies z.infer<typeof customerProfileSchema>;

const driverProfileSchema = z.object({
  warehouse_id: z.number().min(1, "Warehouse is required"),
  warehouse_name: z.string(),
  status: z.string(),
  phone_number: z.string(),
});

const customerUserSchema = z.object({
  ...baseUserSchema,
  role: z.literal("customer"),
  profile: customerProfileSchema.optional(),
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

  customerUserSchema,

  z.object({
    ...baseUserSchema,
    role: z.literal("driver"),
    profile: driverProfileSchema.optional(),
  }),
]);

export type UserForm = z.infer<typeof userSchema>;

const coordinateText = z.string().trim().min(1, "Search for an address or enter the coordinates");

export const orderCustomerSchema: z.ZodType<UserForm, UserForm> = customerUserSchema.extend({
  name: baseUserSchema.name.trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  profile: customerProfileSchema.extend({
    ...savedAddressSchema.shape,
    company_name: z.string().trim(),
    phone_number: z.string().trim().min(1, "Phone number is required for shipping"),
    latitude: coordinateText,
    longitude: coordinateText,
  }).superRefine(({ latitude, longitude }, ctx) => {
    if (!latitude || !longitude) return;
    const coordinates = savedCoordinatesSchema.safeParse({ latitude: Number(latitude), longitude: Number(longitude) });
    if (!coordinates.success) {
      for (const issue of coordinates.error.issues) {
        ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
      }
    }
  }),
});

export type UserRow = UserForm & {
  id: number;
  password?: never;
  is_active?: boolean;
  is_operational?: boolean;
  last_login: number | null;
  created_at: number;
  updated_at: number;
};
