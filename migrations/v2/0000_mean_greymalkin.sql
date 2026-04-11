CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pipeline_id" uuid,
	"task_id" uuid,
	"approval_type" text,
	"payload" jsonb,
	"status" text DEFAULT 'pending',
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"title" text,
	"created_at" timestamp DEFAULT now(),
	"last_message_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "copy_combinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid,
	"pipeline_id" uuid,
	"tag" text NOT NULL,
	"hook_id" uuid,
	"body_id" uuid,
	"cta_id" uuid,
	"full_text" text,
	"selected_for_video" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "copy_combinations_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "copy_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pipeline_id" uuid,
	"product_id" uuid,
	"product_version" integer,
	"component_type" text,
	"slot_number" integer,
	"tag" text NOT NULL,
	"content" text,
	"angle_id" uuid,
	"rationale" text,
	"register" text,
	"structure" text,
	"intensity" text,
	"compliance_status" text DEFAULT 'pending',
	"compliance_violations" jsonb,
	"approval_status" text DEFAULT 'pending',
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "copy_components_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_table" text,
	"source_id" uuid,
	"embedding" vector(768),
	"model" text DEFAULT 'gemini-embedding-001',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_name" text,
	"pipeline_id" uuid,
	"product_id" uuid,
	"niche_id" uuid,
	"model" text,
	"input_tokens" integer,
	"cached_input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid,
	"role" text,
	"content" text,
	"references" jsonb,
	"pipeline_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "niche_learnings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"niche_id" uuid,
	"learning_type" text,
	"content" text,
	"evidence" jsonb,
	"confidence" numeric,
	"occurrences" integer DEFAULT 1,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"last_reinforced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"product_id" uuid,
	"goal" text NOT NULL,
	"deliverable_agent" text NOT NULL,
	"plan" jsonb NOT NULL,
	"state" jsonb DEFAULT '{}',
	"status" text DEFAULT 'pending',
	"product_version" integer NOT NULL,
	"force_refresh" boolean DEFAULT false,
	"budget_usd" numeric(10, 2),
	"cost_so_far_usd" numeric(10, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_knowledge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid,
	"product_version" integer,
	"artifact_type" text,
	"artifact_data" jsonb,
	"source_pipeline_id" uuid,
	"source_task_id" uuid,
	"status" text DEFAULT 'fresh',
	"created_at" timestamp DEFAULT now(),
	"superseded_at" timestamp,
	"superseded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "prompt_caches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cache_key" text,
	"gemini_cache_name" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "prompt_caches_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pipeline_id" uuid,
	"agent_name" text NOT NULL,
	"mode" text,
	"depends_on" text[] DEFAULT '{}',
	"status" text DEFAULT 'pending',
	"input_context" jsonb,
	"output" jsonb,
	"error" text,
	"retry_count" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
