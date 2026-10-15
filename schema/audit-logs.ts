import z from "zod";

export const auditLogsTableSchema = z.object({
  id: z.number().nonnegative(),
  user_id: z.number().nonnegative(),
  action: z.string().min(1).nonempty(),
  entity_id: z.number().nonnegative(),
  entity_type: z.string().min(1).nonempty(),
  description: z.string().min(1).nonempty(),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
  metadata: z.string().optional(),
  ip_address: z.string().min(1).nonempty(),
  user_agent: z.string().min(1).nonempty(),
  created_at: z.string().min(1).nonempty(),
});

export type AuditLogsTableSchemaType = z.infer<typeof auditLogsTableSchema>;
