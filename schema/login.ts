import z from "zod";

export const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type FormSchema = z.infer<typeof formSchema>;
