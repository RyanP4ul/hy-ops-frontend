import { z } from "zod";

export const savedCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).refine(data => data.latitude !== 0 || data.longitude !== 0, {
  path: ["latitude"], message: "Confirm the destination coordinates; (0, 0) is not a verified location.",
});

export const savedAddressSchema = savedCoordinatesSchema.safeExtend({
  address_line: z.string().trim().min(1, "Street address is required").max(255),
  barangay: z.string().trim().min(1, "Barangay is required").max(100),
  city_municipality: z.string().trim().min(1, "City or municipality is required").max(100),
  province: z.string().trim().min(1, "Province is required").max(100),
  postal_code: z.string().trim().max(20),
});

export const shippingAddressFields = [
  { name: "address_line", label: "Street address", type: "text" },
  { name: "barangay", label: "Barangay", type: "text" },
  { name: "city_municipality", label: "City / municipality", type: "text" },
  { name: "province", label: "Province", type: "text" },
  { name: "postal_code", label: "Postal code (optional)", type: "text" },
  { name: "latitude", label: "Latitude", type: "number" },
  { name: "longitude", label: "Longitude", type: "number" },
] as const;

export type SavedAddressFormValues = z.infer<typeof savedAddressSchema>;
