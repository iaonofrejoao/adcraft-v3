-- Migration 020: Creative generation per combination
-- Adds copy_combination_id to product_knowledge and script_status to copy_combinations

ALTER TABLE product_knowledge
  ADD COLUMN IF NOT EXISTS copy_combination_id UUID REFERENCES copy_combinations(id);

ALTER TABLE copy_combinations
  ADD COLUMN IF NOT EXISTS script_status TEXT DEFAULT 'pending'
    CHECK (script_status IN ('pending', 'generating', 'ready', 'error'));

CREATE INDEX IF NOT EXISTS idx_product_knowledge_combination
  ON product_knowledge (copy_combination_id)
  WHERE copy_combination_id IS NOT NULL;
