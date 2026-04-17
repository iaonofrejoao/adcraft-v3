import { pgTable, uuid, text, varchar, jsonb, integer, boolean, numeric, timestamp, bigint, customType } from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});

export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey(),
  user_id: uuid("user_id"),
  product_id: uuid("product_id"),
  goal: text("goal").notNull(),
  deliverable_agent: text("deliverable_agent").notNull(),
  plan: jsonb("plan").notNull(),
  state: jsonb("state").default('{}'),
  status: text("status").default('pending'),
  product_version: integer("product_version").notNull(),
  force_refresh: boolean("force_refresh").default(false),
  budget_usd: numeric("budget_usd", { precision: 10, scale: 2 }),
  cost_so_far_usd: numeric("cost_so_far_usd", { precision: 10, scale: 4 }).default('0'),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  completed_at: timestamp("completed_at"),
});

export const niches = pgTable("niches", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").default('active'),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  platform: varchar("platform", { length: 100 }),
  niche_id: uuid("niche_id").references(() => niches.id),
  target_language: text("target_language").default('pt-BR'),
  ticket_price: numeric("ticket_price", { precision: 10, scale: 2 }),
  commission_percent: numeric("commission_percent", { precision: 10, scale: 2 }),
  // VSL — Fase D
  vsl_url: text("vsl_url"),
  vsl_source: text("vsl_source"),
  vsl_uploaded_at: timestamp("vsl_uploaded_at"),
  vsl_duration_seconds: integer("vsl_duration_seconds"),
  vsl_file_size_bytes: bigint("vsl_file_size_bytes", { mode: "number" }),
  // Status e score
  viability_score: numeric("viability_score", { precision: 4, scale: 2 }),
  status: text("status").default('active'),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});


export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey(),
  pipeline_id: uuid("pipeline_id"),
  agent_name: text("agent_name").notNull(),
  mode: text("mode"),
  depends_on: text("depends_on").array().default([]),
  status: text("status").default('pending'),
  input_context: jsonb("input_context"),
  output: jsonb("output"),
  error: text("error"),
  retry_count: integer("retry_count").default(0),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow(),
  confirmed_oversized: boolean("confirmed_oversized").default(false), // usuário confirmou execução acima do cap econômico (video_maker)
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey(),
  pipeline_id: uuid("pipeline_id"),
  task_id: uuid("task_id"),
  approval_type: text("approval_type"),
  payload: jsonb("payload"),
  status: text("status").default('pending'),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const copyComponents = pgTable("copy_components", {
  id: uuid("id").primaryKey(),
  pipeline_id: uuid("pipeline_id"),
  product_id: uuid("product_id"),
  product_version: integer("product_version"),
  component_type: text("component_type"),
  slot_number: integer("slot_number"),
  tag: text("tag").notNull().unique(),
  content: text("content"),
  angle_id: uuid("angle_id"),
  rationale: text("rationale"),
  register: text("register"),
  structure: text("structure"),
  intensity: text("intensity"),
  compliance_status: text("compliance_status").default('pending'),
  compliance_violations: jsonb("compliance_violations"),
  approval_status: text("approval_status").default('pending'),
  approved_at: timestamp("approved_at"),
  rejected_at: timestamp("rejected_at"),
  rejection_reason: text("rejection_reason"),
  created_at: timestamp("created_at").defaultNow(),
});

export const copyCombinations = pgTable("copy_combinations", {
  id: uuid("id").primaryKey(),
  product_id: uuid("product_id"),
  pipeline_id: uuid("pipeline_id"),
  tag: text("tag").notNull().unique(),
  hook_id: uuid("hook_id"),
  body_id: uuid("body_id"),
  cta_id: uuid("cta_id"),
  full_text: text("full_text"),
  selected_for_video: boolean("selected_for_video").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const productKnowledge = pgTable("product_knowledge", {
  id: uuid("id").primaryKey(),
  product_id: uuid("product_id"),
  product_version: integer("product_version"),
  artifact_type: text("artifact_type"),
  artifact_data: jsonb("artifact_data"),
  source_pipeline_id: uuid("source_pipeline_id"),
  source_task_id: uuid("source_task_id"),
  status: text("status").default('fresh'),
  created_at: timestamp("created_at").defaultNow(),
  superseded_at: timestamp("superseded_at"),
  superseded_by: uuid("superseded_by"),
});

export const nicheLearnings = pgTable("niche_learnings", {
  id: uuid("id").primaryKey(),
  niche_id: uuid("niche_id"),
  learning_type: text("learning_type"),
  content: text("content"),
  evidence: jsonb("evidence"),
  confidence: numeric("confidence"),
  occurrences: integer("occurrences").default(1),
  status: text("status").default('active'),
  created_at: timestamp("created_at").defaultNow(),
  last_reinforced_at: timestamp("last_reinforced_at"),
});

export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey(),
  source_table: text("source_table"),
  source_id: uuid("source_id"),
  embedding: vector("embedding"),
  model: text("model").default('gemini-embedding-001'),
  created_at: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  user_id: uuid("user_id"),
  title: text("title"),
  created_at: timestamp("created_at").defaultNow(),
  last_message_at: timestamp("last_message_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey(),
  conversation_id: uuid("conversation_id"),
  role: text("role"),
  content: text("content"),
  references: jsonb("references"),
  pipeline_id: uuid("pipeline_id"),
  created_at: timestamp("created_at").defaultNow(),
});

export const promptCaches = pgTable("prompt_caches", {
  id: uuid("id").primaryKey(),
  cache_key: text("cache_key").unique(),
  gemini_cache_name: text("gemini_cache_name"),
  expires_at: timestamp("expires_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// ── Fase E — Sistema de Memória Cumulativa ────────────────────────────────────

export const executionLearnings = pgTable("execution_learnings", {
  id:                  uuid("id").primaryKey(),
  pipeline_id:         uuid("pipeline_id").references(() => pipelines.id),
  product_id:          uuid("product_id").references(() => products.id),
  niche_id:            uuid("niche_id").references(() => niches.id),
  category:            text("category").notNull(),
  observation:         text("observation").notNull(),
  evidence:            jsonb("evidence"),
  confidence:          numeric("confidence", { precision: 3, scale: 2 }).default('0.50'),
  validated_by_user:   boolean("validated_by_user"),
  invalidation_reason: text("invalidation_reason"),
  status:              text("status").default('active'),
  created_at:          timestamp("created_at").defaultNow(),
});

export const learningPatterns = pgTable("learning_patterns", {
  id:                      uuid("id").primaryKey(),
  pattern_text:            text("pattern_text").notNull(),
  category:                text("category"),
  niche_id:                uuid("niche_id").references(() => niches.id),
  supporting_learning_ids: uuid("supporting_learning_ids").array(),
  supporting_count:        integer("supporting_count").default(0),
  confidence:              numeric("confidence", { precision: 3, scale: 2 }).default('0.50'),
  status:                  text("status").default('active'),
  created_at:              timestamp("created_at").defaultNow(),
  updated_at:              timestamp("updated_at").defaultNow(),
});

export const insights = pgTable("insights", {
  id:                uuid("id").primaryKey(),
  title:             text("title").notNull(),
  body:              text("body").notNull(),
  importance:        integer("importance").default(3),
  source:            text("source").default('aggregator'),
  pattern_ids:       uuid("pattern_ids").array(),
  validated_by_user: boolean("validated_by_user").default(false),
  created_at:        timestamp("created_at").defaultNow(),
  updated_at:        timestamp("updated_at").defaultNow(),
});

export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").primaryKey(),
  agent_name: text("agent_name"),
  pipeline_id: uuid("pipeline_id"),
  product_id: uuid("product_id"),
  niche_id: uuid("niche_id"),
  model: text("model"),
  input_tokens: integer("input_tokens"),
  cached_input_tokens: integer("cached_input_tokens"),
  output_tokens: integer("output_tokens"),
  cost_usd: numeric("cost_usd", { precision: 10, scale: 6 }),
  duration_ms: integer("duration_ms"),
  payload: jsonb("payload"),
  created_at: timestamp("created_at").defaultNow(),
});
