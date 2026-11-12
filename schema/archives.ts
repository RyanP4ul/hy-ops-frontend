import { z } from "zod";

export const archiveSchema = z.object({
  entity_id: z.union([z.string(), z.number()]),
  entity_type: z.string().min(1, "Entity type is required"),
  archived_by: z.union([z.number(), z.string()]),
});

export type ArchiveForm = z.infer<typeof archiveSchema>;
export type ArchiveTable = ArchiveForm & {
  id: number;
  archived_at: number;
  delete_after: number | null;
  deletion_requested_at: number | null;
  deletion_error: string | null;
  data: object;
  user: { id: number; name: string };
};
export type ArchiveRow = ArchiveForm & {
  id: number;
  archived_at: number;
};
