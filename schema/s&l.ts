import z from "zod";

export const sessionsAndLogsTableSchema = z.object({
  id: z.number().nonnegative(),
  page: z.string().min(1).nonempty(),
  user: z.object({
    sub: z.string().min(1).nonempty(),
    email: z.string().email().min(1).nonempty(),
    name: z.string().min(1).nonempty(),
    role: z.string().min(1).nonempty(),
    token_version: z.number().nonnegative(),
    user_agent: z.object({
      raw: z.string().min(1).nonempty(),
      browser: z.object({
        name: z.string().min(1).nonempty(),
        version: z.string().min(1).nonempty(),
      }),
      os: z.object({
        name: z.string().min(1).nonempty(),
        version: z.string().min(1).nonempty(),
      }),
      device: z.object({
        type: z.string().min(1).nonempty(),
      }),
    }),
    iat: z.number().nonnegative(),
  }),
});

export type SessionsAndLogsTableSchemaType = z.infer<
  typeof sessionsAndLogsTableSchema
>;

export const wsLogsTableSchema = z.object({
  ws_id: z.number().nonnegative(),
  session_id: z.string().min(1),
  user_id: z.number().nonnegative(),
  action: z.string().min(1),
  payload: z.string(),
});

export type WsLogsTableSchemaType = z.infer<typeof wsLogsTableSchema>;
