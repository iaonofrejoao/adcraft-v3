---
name: database-schema
description: >
  Design and document PostgreSQL database schemas for production applications,
  including tables, columns, relationships, indexes, RLS policies, and migration files.
  Use this skill whenever the user needs to create a database schema, define data models,
  document table structures, write migration files, or design relationships between entities.
  Always use this skill when building any backend system that requires persistent data storage,
  especially when the system involves users, multi-tenancy, or complex entity relationships.
  Triggers on: design the database, create the schema, data model, tables and relationships,
  migration file, Supabase schema, or any request involving PostgreSQL, data persistence,
  or entity design.
---

# Database Schema Design — PostgreSQL / Supabase

A skill for producing complete, production-ready PostgreSQL schemas with full documentation, proper typing, relationships, indexes, and row-level security policies.

---

## Core Conventions

### Naming
- Tables: `snake_case`, plural nouns (`users`, `projects`, `creative_assets`)
- Columns: `snake_case`, singular (`user_id`, `created_at`, `is_active`)
- Indexes: `idx_{table}_{column(s)}` (`idx_projects_user_id`)
- Foreign keys: `fk_{table}_{referenced_table}` (`fk_projects_users`)
- Enum types: `snake_case` with `_type` or `_status` suffix (`execution_status`, `asset_type`)

### Required Columns (every table)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Timestamps
Always use `TIMESTAMPTZ` (with timezone), never `TIMESTAMP`. Set `updated_at` via trigger:
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON {table_name}
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Soft Deletes
Never hard-delete records. Use:
```sql
deleted_at  TIMESTAMPTZ DEFAULT NULL
```
Filter active records with `WHERE deleted_at IS NULL`.

---

## Column Documentation Standard

Every column must have a comment explaining what it stores:
```sql
COMMENT ON COLUMN projects.niche IS 'Market niche this project targets, e.g. weight_loss, hair_growth. Used for memory retrieval and benchmark filtering.';
```

Every table must have a comment:
```sql
COMMENT ON TABLE projects IS 'Top-level container for a marketing campaign. One project per product being promoted. Contains all executions, assets, and campaigns for that product.';
```

---

## Data Types Reference

| Use case | PostgreSQL type |
|---|---|
| Identifiers | `UUID` |
| Short text (<255 chars) | `VARCHAR(255)` |
| Long text | `TEXT` |
| Whole numbers | `INTEGER` or `BIGINT` |
| Decimals / money | `NUMERIC(10,2)` |
| Booleans | `BOOLEAN` |
| Timestamps | `TIMESTAMPTZ` |
| JSON data | `JSONB` |
| Arrays | `TEXT[]` or `UUID[]` |
| Enums | Custom `TYPE` |
| File URLs | `TEXT` |
| Percentages | `NUMERIC(5,2)` |
| Token counts | `INTEGER` |
| Costs in USD | `NUMERIC(10,6)` |

---

## Relationships Pattern

### One-to-Many
```sql
-- Child table references parent
project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
```

### Many-to-Many (junction table)
```sql
CREATE TABLE project_assets (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, asset_id)
);
```

### Self-referential
```sql
-- Execution can reference another execution as its source
source_execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
```

---

## Index Strategy

```sql
-- Foreign keys always get an index
CREATE INDEX idx_executions_project_id ON executions(project_id);

-- Columns used in WHERE clauses for filtering
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_niche ON assets(niche);

-- Columns used in ORDER BY
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_assets_project_niche ON assets(project_id, niche);

-- Partial indexes for soft deletes
CREATE INDEX idx_projects_active ON projects(user_id) WHERE deleted_at IS NULL;
```

---

## Row-Level Security (RLS) — Supabase

Enable RLS on every table that contains user data:
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "users_own_projects" ON projects
  FOR ALL
  USING (user_id = auth.uid());

-- Shared/global data (e.g. niche memory) readable by all authenticated users
CREATE POLICY "authenticated_read_niches" ON niche_memory
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## Enum Types

Define all status and type enumerations as PostgreSQL types:
```sql
CREATE TYPE execution_status AS ENUM (
  'pending',
  'running', 
  'paused_for_approval',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE asset_type AS ENUM (
  'character',
  'keyframe',
  'video_clip',
  'final_video',
  'script',
  'copy',
  'hook'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'approved_with_feedback'
);
```

---

## Full Table Template

```sql
-- ============================================================
-- TABLE: {table_name}
-- Purpose: {one sentence description}
-- Written by: {which agent/service writes to this table}
-- Read by: {which agents/services read from this table}
-- ============================================================

CREATE TABLE {table_name} (
  -- Primary key
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Core fields
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          execution_status NOT NULL DEFAULT 'pending',
  metadata        JSONB DEFAULT '{}',
  
  -- Soft delete
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_{table_name}_user_id ON {table_name}(user_id);
CREATE INDEX idx_{table_name}_project_id ON {table_name}(project_id);
CREATE INDEX idx_{table_name}_status ON {table_name}(status);
CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at DESC);

-- Trigger
CREATE TRIGGER set_{table_name}_updated_at
BEFORE UPDATE ON {table_name}
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_{table_name}" ON {table_name}
  FOR ALL USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE {table_name} IS '{full description of purpose and usage}';
COMMENT ON COLUMN {table_name}.status IS '{description of what each status means}';
COMMENT ON COLUMN {table_name}.metadata IS '{description of JSON structure stored here}';
```

---

## Migration File Structure

Always produce migrations as numbered files:
```
migrations/
├── 001_create_users.sql
├── 002_create_projects.sql
├── 003_create_executions.sql
├── 004_create_assets.sql
├── 005_create_campaigns.sql
├── 006_create_niche_memory.sql
├── 007_create_knowledge_base.sql
└── 008_add_indexes_and_rls.sql
```

Each migration file starts with:
```sql
-- Migration: {number}_{description}
-- Created: {date}
-- Description: {what this migration does}
-- Depends on: {previous migration numbers}

BEGIN;

-- migration content here

COMMIT;
```

---

## JSONB Column Documentation

When a column stores JSONB, always document its schema in the column comment:
```sql
COMMENT ON COLUMN assets.marketing_metadata IS 
'JSON object containing marketing classification data:
{
  "angle_type": "string — e.g. betrayed_authority, transformation, fear",
  "emotional_trigger": "string — primary emotion targeted",
  "hook_text": "string — opening line verbatim",
  "narrative_structure": "string — e.g. pas, aida, bab",
  "format": "string — e.g. ugc, vsl, podcast",
  "duration_seconds": "number",
  "target_audience_summary": "string",
  "pain_addressed": "string",
  "objections_broken": "array of strings",
  "cta_text": "string",
  "confidence_score": "number 0-100"
}';
```

---

## AI Queryability Checklist

Before finalizing a schema, verify:
- [ ] Every table has a `COMMENT ON TABLE` explaining its purpose
- [ ] Every column has a `COMMENT ON COLUMN` explaining what it stores
- [ ] No abbreviations in column names (`usr_id` → `user_id`, `conf` → `confidence_score`)
- [ ] Enum values are human-readable strings, not numeric codes
- [ ] JSONB columns have their structure documented in comments
- [ ] Foreign key relationships are explicit (not just naming convention)
- [ ] Status columns use enum types with all valid values listed
