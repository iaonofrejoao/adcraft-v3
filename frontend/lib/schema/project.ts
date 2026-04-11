import { z } from "zod";
import { AffiliatePlatformEnum, OrchestratorBehaviorEnum } from "./state";

// ──────────────────────────────────────────────
// Produto (sub-recurso do projeto)
// ──────────────────────────────────────────────

export const ProductBaseSchema = z.object({
  name: z.string().min(1).max(255),
  platform: AffiliatePlatformEnum,
  product_url: z.string(),
  affiliate_link: z.string(),
  commission_percent: z.number().min(0).max(100),
  ticket_price: z.number().positive(),
  target_country: z.string().max(10).default("BR"),
  target_language: z.string().max(20).default("pt-BR"),
  vsl_url: z.string().nullable().default(null)
});
export type ProductBase = z.infer<typeof ProductBaseSchema>;

export const ProductResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  niche_id: z.string().uuid().nullable().default(null),
  name: z.string(),
  platform: z.string(),
  product_url: z.string(),
  affiliate_link: z.string(),
  commission_percent: z.number(),
  ticket_price: z.number(),
  target_country: z.string(),
  target_language: z.string(),
  vsl_url: z.string().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type ProductResponse = z.infer<typeof ProductResponseSchema>;

// ──────────────────────────────────────────────
// Criação de projeto
// ──────────────────────────────────────────────

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255),
  template_id: z.string().nullable().default(null),
  ad_account_facebook: z.string().max(100).nullable().default(null),
  ad_account_google: z.string().max(100).nullable().default(null),
  budget_for_test: z.number().positive(),
  ad_platforms: z.array(z.string()).default(["facebook"]),
  orchestrator_behavior_on_failure: OrchestratorBehaviorEnum.default("agent_decides"),
  product: ProductBaseSchema,
  niche_name: z.string().nullable().default(null)
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ad_account_facebook: z.string().max(100).nullable().optional(),
  ad_account_google: z.string().max(100).nullable().optional(),
  budget_for_test: z.number().positive().optional(),
  orchestrator_behavior_on_failure: OrchestratorBehaviorEnum.optional()
});
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

// ──────────────────────────────────────────────
// Respostas de projeto
// ──────────────────────────────────────────────

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  product: ProductResponseSchema,
  template_id: z.string().nullable().default(null),
  ad_account_facebook: z.string().nullable().default(null),
  ad_account_google: z.string().nullable().default(null),
  budget_for_test: z.number().nullable().default(null),
  orchestrator_behavior_on_failure: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export const ProjectStatsSchema = z.object({
  executions_count: z.number().min(0).default(0),
  creatives_count: z.number().min(0).default(0),
  active_campaigns_count: z.number().min(0).default(0),
  avg_roas: z.number().nullable().default(null),
  total_spend_brl: z.number().min(0).default(0.0)
});
export type ProjectStats = z.infer<typeof ProjectStatsSchema>;

export const ProjectCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  product_name: z.string(),
  niche_name: z.string().nullable().default(null),
  platform: z.string(),
  target_language: z.string().default("pt-BR"),
  status_badge: z.string().default("idle"),
  stats: ProjectStatsSchema.default({}),
  last_updated: z.string().datetime(),
  created_at: z.string().datetime()
});
export type ProjectCard = z.infer<typeof ProjectCardSchema>;

export const ProjectDetailResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  product: ProductResponseSchema,
  template_id: z.string().nullable().default(null),
  ad_account_facebook: z.string().nullable().default(null),
  ad_account_google: z.string().nullable().default(null),
  budget_for_test: z.number().nullable().default(null),
  orchestrator_behavior_on_failure: z.string(),
  stats: ProjectStatsSchema.default({}),
  recent_executions: z.array(z.record(z.any())).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type ProjectDetailResponse = z.infer<typeof ProjectDetailResponseSchema>;
