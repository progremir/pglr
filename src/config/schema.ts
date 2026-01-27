import { z } from "zod";

export const ConnectionSchema = z.object({
  host: z.string(),
  port: z.number().default(5432),
  database: z.string(),
  user: z.string(),
  password: z.string(),
  ssl: z.boolean().optional(),
  sslVerify: z.boolean().optional(), // true = verify certificates, false = allow self-signed
});

export type Connection = z.infer<typeof ConnectionSchema>;

export const ConnectionStoreSchema = z.object({
  default: z.string().nullable(),
  connections: z.record(z.string(), ConnectionSchema),
});

export type ConnectionStore = z.infer<typeof ConnectionStoreSchema>;

export const SecurityConfigSchema = z.object({
  readOnly: z.boolean().default(true),
  maxRows: z.number().default(1000),
  timeoutMs: z.number().default(30000),
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
