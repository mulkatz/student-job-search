import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });
export const searchRunSummarySchema = z.strictObject({
  id: z.string().uuid(),
  profileVersionId: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum([
    "queued",
    "running",
    "completed",
    "limited",
    "failed",
    "dispatch_uncertain",
  ]),
  target: z.literal(30),
  displayedJobs: z.number().int().min(0).max(30),
  observations: z.number().int().min(0).max(300),
  searchRequests: z.number().int().min(0).max(20),
  httpRequests: z.number().int().min(0).max(120),
  reason: z
    .string()
    .regex(/^[a-z_]{1,80}$/)
    .nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SearchRunSummary = z.infer<typeof searchRunSummarySchema>;
export const searchRunResponseSchema = z.strictObject({
  run: searchRunSummarySchema.nullable(),
});
export const pilotSearchRequestSchema = z.strictObject({
  operationId: z.string().uuid(),
  expectedActiveVersionId: z.string().regex(/^[a-f0-9]{64}$/),
});
