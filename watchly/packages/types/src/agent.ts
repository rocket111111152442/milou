import { z } from "zod";
import { pageObservationSchema } from "./observations";

export const platformSchema = z.enum(["windows", "macos", "linux"]);
export type Platform = z.infer<typeof platformSchema>;

export const linkStartSchema = z.object({
  deviceName: z.string().trim().min(1).max(80),
  platform: platformSchema,
  appVersion: z.string().trim().max(40).optional(),
});

export const linkPollSchema = z.object({ deviceCode: z.string().min(32).max(128) });

export const consentSchema = z.object({
  accepted: z.literal(true),
  consentVersion: z.string().min(1).max(40),
});

export const heartbeatSchema = z.object({
  state: z.enum(["idle", "running", "paused"]),
  runningJobs: z.number().int().min(0).max(16),
  appVersion: z.string().max(40).optional(),
});

export const claimRequestSchema = z.object({ max: z.number().int().min(1).max(3).default(1) });

export interface AgentJob {
  jobId: string;
  claimToken: string;
  leaseExpiresAt: string;
  task: {
    id: string;
    name: string;
    kind: "page";
    url: string;
    cssSelector: string | null;
    renderMode: "auto" | "http" | "browser";
  };
}

export const jobResultSchema = z
  .object({
    claimToken: z.string().uuid(),
    durationMs: z.number().int().min(0).max(600_000),
    observation: pageObservationSchema.optional(),
    error: z
      .object({
        code: z.string().min(1).max(60),
        message: z.string().max(500),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.observation) !== Boolean(v.error), {
    message: "observation XOR error",
  });
export type JobResultInput = z.infer<typeof jobResultSchema>;
