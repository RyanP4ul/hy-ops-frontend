import { z } from "zod";

export const archiveSchema = z.object({
  entity_id: z.number(),
  entity_type: z.string().min(1, "Entity type is required"),
  archived_by: z.string().min(1, "Archived by is required"),
});

export type ArchiveForm = z.infer<typeof archiveSchema>;
export type ArchiveTable = ArchiveForm & {
  id: number;
  data: object;
  user: { id: number; name: string };
};
export type ArchiveRow = ArchiveForm & {
  id: number;
  archived_at: number;
};
