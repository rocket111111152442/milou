import { z } from "zod";
import { pageConditionSchema, webTopicConditionSchema } from "./conditions";

export const executionModeSchema = z.enum(["auto", "local_only", "cloud_only"]);
export const renderModeSchema = z.enum(["auto", "http", "browser"]);

export const notifyPrefsSchema = z
  .object({
    inapp: z.boolean().default(true),
    email: z.boolean().default(true),
    desktop: z.boolean().default(true),
  })
  .default({ inapp: true, email: true, desktop: true });

const nameSchema = z.string().trim().min(1, "Nom requis").max(120);
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Domaine invalide");

export const createPageMonitorSchema = z.object({
  kind: z.literal("page"),
  name: nameSchema,
  url: z.string().trim().max(2048).url("Adresse invalide"),
  cssSelector: z.string().trim().max(300).optional(),
  renderMode: renderModeSchema.default("auto"),
  condition: pageConditionSchema,
  intervalMinutes: z.number().int().min(1).max(10080).optional(),
  executionMode: executionModeSchema.default("auto"),
  notify: notifyPrefsSchema,
});
export type CreatePageMonitorInput = z.infer<typeof createPageMonitorSchema>;

export const createWebTopicMonitorSchema = z.object({
  kind: z.literal("web_topic"),
  name: nameSchema,
  /** Demande en langage naturel, ex. « Préviens-moi dès que la date de sortie officielle est annoncée ». */
  request: z.string().trim().min(5).max(500),
  condition: webTopicConditionSchema.optional(),
  officialDomains: z.array(domainSchema).max(5).default([]),
  intervalMinutes: z.number().int().min(60).max(10080).optional(),
  notify: notifyPrefsSchema,
});
export type CreateWebTopicMonitorInput = z.infer<typeof createWebTopicMonitorSchema>;

export const createMonitorSchema = z.discriminatedUnion("kind", [
  createPageMonitorSchema,
  createWebTopicMonitorSchema,
]);
export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;

export const updateMonitorSchema = z.object({
  name: nameSchema.optional(),
  condition: z.union([pageConditionSchema, webTopicConditionSchema]).optional(),
  cssSelector: z.string().trim().max(300).nullable().optional(),
  intervalMinutes: z.number().int().min(1).max(10080).optional(),
  executionMode: executionModeSchema.optional(),
  notify: z
    .object({ inapp: z.boolean(), email: z.boolean(), desktop: z.boolean() })
    .partial()
    .optional(),
  officialDomains: z.array(domainSchema).max(5).optional(),
});
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
